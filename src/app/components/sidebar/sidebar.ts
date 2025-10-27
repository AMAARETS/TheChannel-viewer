import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, Renderer2 } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest, map, Subscription } from 'rxjs';

import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { Category, Site, AvailableSite } from '../../core/models/site.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, NgStyle, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);
  renderer = inject(Renderer2);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // --- State Observables from Services ---
  isSidebarCollapsed$ = this.uiStateService.isSidebarCollapsed$;
  activeSiteUrl$: Observable<string | null> = this.uiStateService.selectedSite$.pipe(map(s => s?.url ?? null));

  // --- Reactive Filtering Logic ---
  private searchTerm$ = new BehaviorSubject<string>('');
  filteredCategories$!: Observable<Category[]>;
  filteredAvailableSites$!: Observable<AvailableSite[]>;

  // --- UI State ---
  private isTemporarilyExpanded$ = new BehaviorSubject<boolean>(false);
  isExpanded$: Observable<boolean>;
  categoryCollapseState$: Observable<Record<string, boolean>> = this.uiStateService.collapsedCategories$;
  private globalClickListener!: () => void;
  private subscriptions = new Subscription();

  // --- Context Menu State ---
  contextMenuSiteUrl: string | null = null;
  contextMenuPosition = { top: '0px', left: '0px', bottom: 'auto' };
  isMenuOpeningUp = false; // <-- משתנה חדש למעקב אחר כיוון הפתיחה
  activeMenuData: { site: Site, category: Category } | null = null;


  // --- Drag and Drop State ---
  private draggedItem: { site: Site, fromCategory: Category } | null = null;
  private draggedCategory: Category | null = null;

  // --- Favicon and UI Helpers ---
  faviconErrorUrls = new Set<string>();
  private colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'
  ];

  constructor() {
    this.isExpanded$ = combineLatest([
      this.isSidebarCollapsed$,
      this.isTemporarilyExpanded$
    ]).pipe(
      map(([isCollapsed, isTempExpanded]) => !isCollapsed || isTempExpanded)
    );
  }

  ngOnInit(): void {
    this.filteredCategories$ = combineLatest([
      this.siteDataService.categories$,
      this.searchTerm$
    ]).pipe(
      map(([categories, term]) => {
        if (!term) return categories;
        return categories
          .map(category => ({
            ...category,
            sites: category.sites.filter(site => site.name.toLowerCase().includes(term))
          }))
          .filter(category => category.sites.length > 0);
      })
    );

    this.filteredAvailableSites$ = combineLatest([
        this.siteDataService.availableSites$,
        this.siteDataService.categories$,
        this.searchTerm$
    ]).pipe(
        map(([availableSites, currentCategories, term]) => {
            if (!term) return [];
            const termLower = term.toLowerCase();
            const existingUrls = new Set(currentCategories.flatMap(c => c.sites.map(s => s.url)));
            return availableSites.filter(site =>
                !existingUrls.has(site.url) && site.name.toLowerCase().includes(termLower)
            );
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.closeContextMenu(); // Ensure listener is removed
  }


  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm$.next(term);
  }

  selectSite(site: Site): void { this.uiStateService.selectSite(site); }
  toggleSidebar(): void { this.uiStateService.toggleSidebar(); }
  openAddSiteDialog(): void { this.uiStateService.openAddSiteDialog(); }

  expandAndFocusSearch(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.uiStateService.toggleSidebar();
      setTimeout(() => this.searchInput.nativeElement.focus(), 300);
    } else {
      this.searchInput.nativeElement.focus();
    }
  }

  addSiteFromAvailable(site: AvailableSite): void {
    const categoryName = site.category || 'כללי';
    this.siteDataService.addSite({ name: site.name, url: site.url }, categoryName);
    this.searchInput.nativeElement.value = '';
    this.searchTerm$.next('');
  }

  // --- Category Collapse Logic ---
  toggleCategory(categoryName: string): void {
    const currentState = this.uiStateService.collapsedCategories$.getValue();
    const newState = {
      ...currentState,
      [categoryName]: !currentState[categoryName]
    };
    this.uiStateService.saveCollapsedCategories(newState);
  }

  isCategoryCollapsed(categoryName: string): Observable<boolean> {
    return this.categoryCollapseState$.pipe(
      map(state => state[categoryName] ?? false)
    );
  }

  // --- Context Menu Logic ---
  toggleContextMenu(site: Site, category: Category, event: MouseEvent): void {
    event.stopPropagation();
    if (this.contextMenuSiteUrl === site.url) {
      this.closeContextMenu();
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const MENU_ESTIMATED_HEIGHT = 250; // הערכה גסה לגובה התפריד והתת-תפריט

      this.isMenuOpeningUp = (rect.bottom + MENU_ESTIMATED_HEIGHT > viewportHeight);

      if (this.isMenuOpeningUp) {
        // אם אין מקום למטה, פתח את התפריט הראשי כלפי מעלה
        this.contextMenuPosition = {
          top: 'auto',
          bottom: `${viewportHeight - rect.top}px`,
          left: `${rect.left}px`
        };
      } else {
        // אחרת, פתח כרגיל כלפי מטה
        this.contextMenuPosition = {
          top: `${rect.bottom}px`,
          bottom: 'auto',
          left: `${rect.left}px`
        };
      }

      this.activeMenuData = { site, category };
      this.contextMenuSiteUrl = site.url;

      this.globalClickListener = this.renderer.listen('document', 'click', () => {
        this.closeContextMenu();
      });
    }
  }

  isContextMenuOpenFor(site: Site): boolean {
    return this.contextMenuSiteUrl === site.url;
  }

  closeContextMenu(): void {
    this.contextMenuSiteUrl = null;
    this.activeMenuData = null;
    if (this.globalClickListener) {
      this.globalClickListener();
    }
  }

  openConfirmDeleteDialog(site: Site, event: Event): void {
    event.stopPropagation();
    this.uiStateService.openConfirmDeleteDialog(site);
    this.closeContextMenu();
  }

  changeSiteCategory(site: Site, fromCategory: Category, toCategory: Category): void {
    this.siteDataService.moveSiteToCategory(site, fromCategory.name, toCategory.name);
    this.closeContextMenu();
  }

  promptForNewCategory(site: Site, fromCategory: Category): void {
    this.uiStateService.openInputDialog({
      title: 'קטגוריה חדשה',
      label: 'שם הקטגוריה:',
      confirmButtonText: 'הוסף והעבר',
      callback: (newCategoryName) => {
        this.siteDataService.moveSiteToCategory(site, fromCategory.name, newCategoryName);
      }
    });
    this.closeContextMenu();
  }


  // --- Sidebar Hover Logic ---
  onSidebarMouseEnter(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.isTemporarilyExpanded$.next(true);
    }
  }

  onSidebarMouseLeave(): void {
    this.isTemporarilyExpanded$.next(false);
  }

  // --- Favicon & Fallback Logic ---
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch { return ''; }
  }
  onFaviconError(site: Site | AvailableSite): void { this.faviconErrorUrls.add(site.url); }
  hasFaviconError(site: Site | AvailableSite): boolean { return this.faviconErrorUrls.has(site.url); }
  getFirstLetter(name: string): string { return name ? name.charAt(0).toUpperCase() : ''; }
  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return this.colorPalette[Math.abs(hash % this.colorPalette.length)];
  }

  // --- Drag and Drop Logic ---
  onDragStart(event: DragEvent, site: Site, fromCategory: Category): void {
    event.stopPropagation();
    this.draggedItem = { site, fromCategory };
    (event.target as HTMLElement).classList.add('dragging');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOverSite(event: DragEvent, targetElement: HTMLElement): void {
    if (!this.draggedItem) return;
    event.preventDefault();
    targetElement.classList.add('drag-over');
  }

  onDragLeaveSite(event: DragEvent, targetElement: HTMLElement): void {
    targetElement.classList.remove('drag-over');
  }

  onDragOverCategory(event: DragEvent, targetCategory: Category): void {
    if (!this.draggedItem || this.draggedItem.fromCategory.name === targetCategory.name) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('site-drag-over');
  }

  onDragLeaveCategory(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('site-drag-over');
  }

  onDropOnSite(event: DragEvent, targetSite: Site, targetCategory: Category): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggedItem || this.draggedItem.site.url === targetSite.url) return;

    const currentCategories = JSON.parse(JSON.stringify(this.siteDataService.categories$.getValue()));
    const realFromCategory = currentCategories.find((c: Category) => c.name === this.draggedItem!.fromCategory.name)!;
    const realTargetCategory = currentCategories.find((c: Category) => c.name === targetCategory.name)!;

    realFromCategory.sites = realFromCategory.sites.filter((s: Site) => s.url !== this.draggedItem!.site.url);
    const targetIndex = realTargetCategory.sites.findIndex((s: Site) => s.url === targetSite.url);
    realTargetCategory.sites.splice(targetIndex, 0, this.draggedItem.site);

    this.siteDataService.updateCategories(currentCategories);
  }

  onDropInCategory(event: DragEvent, targetCategory: Category): void {
    event.preventDefault();
    if (!this.draggedItem || this.draggedItem.fromCategory.name === targetCategory.name) return;

    const currentCategories = JSON.parse(JSON.stringify(this.siteDataService.categories$.getValue()));
    const realFromCategory = currentCategories.find((c: Category) => c.name === this.draggedItem!.fromCategory.name)!;
    const realTargetCategory = currentCategories.find((c: Category) => c.name === targetCategory.name)!;

    realFromCategory.sites = realFromCategory.sites.filter((s: Site) => s.url !== this.draggedItem!.site.url);
    realTargetCategory.sites.push(this.draggedItem.site);

    this.siteDataService.updateCategories(currentCategories);
  }

  onDragEnd(): void {
    document.querySelectorAll('.dragging, .drag-over, .site-drag-over').forEach(el => el.classList.remove('dragging', 'drag-over', 'site-drag-over'));
    this.draggedItem = null;
  }

  onCategoryDragStart(event: DragEvent, category: Category): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) { event.preventDefault(); return; }
    this.draggedCategory = category;
    (event.currentTarget as HTMLElement).classList.add('dragging');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onCategoryDragEnter(event: DragEvent): void {
    if (this.draggedCategory) event.preventDefault();
  }

  onCategoryDragOver(event: DragEvent): void {
    if (!this.draggedCategory) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('category-drag-over');
  }

  onCategoryDragLeave(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('category-drag-over');
  }

  onCategoryDrop(event: DragEvent, targetCategory: Category): void {
    event.preventDefault();
    if (!this.draggedCategory || this.draggedCategory.name === targetCategory.name) return;

    const currentCategories = this.siteDataService.categories$.getValue();
    const fromIndex = currentCategories.findIndex((c: Category) => c.name === this.draggedCategory!.name);
    const toIndex = currentCategories.findIndex((c: Category) => c.name === targetCategory.name);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [movedCategory] = currentCategories.splice(fromIndex, 1);
      currentCategories.splice(toIndex, 0, movedCategory);
      this.siteDataService.updateCategories(currentCategories);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCategoryDragEnd(event: DragEvent): void {
    document.querySelectorAll('.dragging, .category-drag-over').forEach(el => el.classList.remove('dragging', 'category-drag-over'));
    this.draggedCategory = null;
  }
}

import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest, map, startWith } from 'rxjs';

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
export class SidebarComponent implements OnInit {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // --- State Observables from Services ---
  isSidebarCollapsed$ = this.uiStateService.isSidebarCollapsed$;
  activeSiteName$ = this.uiStateService.activeSiteName$;

  // --- Reactive Filtering Logic ---
  // A subject to hold the current search term.
  private searchTerm$ = new BehaviorSubject<string>('');

  // Public observables for the filtered lists, derived from the data sources and search term.
  filteredCategories$!: Observable<Category[]>;
  filteredAvailableSites$!: Observable<AvailableSite[]>;

  // --- Drag and Drop State ---
  private draggedItem: { site: Site, fromCategory: Category } | null = null;
  private draggedCategory: Category | null = null;

  // --- Favicon and UI Helpers ---
  faviconErrorUrls = new Set<string>();
  private colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'
  ];

  ngOnInit(): void {
    // Combine the latest values from categories and the search term to compute the filtered list.
    this.filteredCategories$ = combineLatest([
      this.siteDataService.categories$,
      this.searchTerm$
    ]).pipe(
      map(([categories, term]) => {
        if (!term) {
          return categories; // If no search term, return all categories.
        }
        // Filter categories and sites within them based on the search term.
        return categories
          .map(category => ({
            ...category,
            sites: category.sites.filter(site => site.name.toLowerCase().includes(term))
          }))
          .filter(category => category.sites.length > 0); // Only include categories that have matching sites.
      })
    );

    // Combine multiple sources to filter available sites.
    this.filteredAvailableSites$ = combineLatest([
        this.siteDataService.availableSites$,
        this.siteDataService.categories$,
        this.searchTerm$
    ]).pipe(
        map(([availableSites, currentCategories, term]) => {
            if (!term) {
                return []; // Only show available sites when searching.
            }
            const existingUrls = new Set(currentCategories.flatMap(c => c.sites.map(s => s.url)));
            return availableSites.filter(site =>
                !existingUrls.has(site.url) && site.name.toLowerCase().includes(term)
            );
        })
    );
  }

  /** Pushes a new value to the search term subject. */
  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm$.next(term);
  }

  // --- User Actions ---
  selectSite(site: Site): void {
    this.uiStateService.selectSite(site);
  }

  toggleSidebar(): void {
    this.uiStateService.toggleSidebar();
  }

  expandAndFocusSearch(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.uiStateService.toggleSidebar();
      // Wait for sidebar expansion animation to finish before focusing.
      setTimeout(() => this.searchInput.nativeElement.focus(), 300);
    } else {
      this.searchInput.nativeElement.focus();
    }
  }

  openAddSiteDialog(): void {
    this.uiStateService.openAddSiteDialog();
  }

  addSiteFromAvailable(site: AvailableSite): void {
    const categoryName = site.category || 'כללי';
    this.siteDataService.addSite({ name: site.name, url: site.url }, categoryName);
    // Reset search after adding.
    this.searchInput.nativeElement.value = '';
    this.searchTerm$.next('');
  }

  openConfirmDeleteDialog(site: Site, event: MouseEvent): void {
    event.stopPropagation();
    this.uiStateService.openConfirmDeleteDialog(site);
  }

  // --- Favicon & Fallback Logic ---
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch (e) { return ''; }
  }
  onFaviconError(site: Site | AvailableSite): void { this.faviconErrorUrls.add(site.url); }
  hasFaviconError(site: Site | AvailableSite): boolean { return this.faviconErrorUrls.has(site.url); }
  getFirstLetter(name: string): string { return name ? name.charAt(0).toUpperCase() : ''; }
  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return this.colorPalette[Math.abs(hash % this.colorPalette.length)];
  }

  // --- Drag and Drop Logic (Largely unchanged, but now relies on a solid data service) ---
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

  onCategoryDragEnd(event: DragEvent): void {
    document.querySelectorAll('.dragging, .category-drag-over').forEach(el => el.classList.remove('dragging', 'category-drag-over'));
    this.draggedCategory = null;
  }
}

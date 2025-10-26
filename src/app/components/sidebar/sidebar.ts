import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Observable, BehaviorSubject } from 'rxjs';
import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { Category, Site, AvailableSite } from '../../core/models/site.model';
import { FormsModule } from '@angular/forms';


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

  isSidebarCollapsed$ = this.uiStateService.isSidebarCollapsed$;
  activeSiteName$ = this.uiStateService.activeSiteName$;

  searchTerm = '';
  filteredCategories$: Observable<Category[]> | undefined;
  filteredAvailableSites$: Observable<AvailableSite[]> | undefined;

  // Favicon error handling
  faviconErrorUrls = new Set<string>();
  private colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'
  ];

  // Drag and Drop state
  private draggedItem: { site: Site, fromCategory: Category } | null = null;
  private draggedCategory: Category | null = null;

  ngOnInit(): void {
    this.filteredCategories$ = this.siteDataService.categories$;
  }

  onSearch(term: string): void {
    this.searchTerm = term.toLowerCase();
    const allCategories = this.siteDataService.categories$.getValue();

    if (!this.searchTerm) {
      this.filteredCategories$ = this.siteDataService.categories$;
      this.filteredAvailableSites$ = undefined;
      return;
    }

    const filtered = allCategories.map(category => ({
      ...category,
      sites: category.sites.filter(site => site.name.toLowerCase().includes(this.searchTerm))
    })).filter(category => category.sites.length > 0);
    this.filteredCategories$ = new BehaviorSubject(filtered).asObservable();

    const existingUrls = new Set(allCategories.flatMap((c: Category) => c.sites.map((s: Site) => s.url)));
    const availableSites = this.siteDataService.availableSites$.getValue();
    const filteredAvailable = availableSites.filter(as =>
      !existingUrls.has(as.url) && as.name.toLowerCase().includes(this.searchTerm)
    );
    this.filteredAvailableSites$ = new BehaviorSubject(filteredAvailable).asObservable();
  }


  selectSite(site: Site): void {
    this.uiStateService.selectSite(site);
  }

  toggleSidebar(): void {
    this.uiStateService.toggleSidebar();
  }

  expandAndFocusSearch(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.uiStateService.toggleSidebar();
      setTimeout(() => this.searchInput.nativeElement.focus(), 300); // wait for animation
    } else {
      this.searchInput.nativeElement.focus();
    }
  }

  openAddSiteDialog(): void {
    this.uiStateService.openAddSiteDialog();
  }

  addSiteFromAvailable(site: AvailableSite) {
    const categoryName = site.category || 'כללי';
    this.siteDataService.addSite({ name: site.name, url: site.url }, categoryName);
    this.onSearch(''); // Reset search
  }

  openConfirmDeleteDialog(site: Site, event: MouseEvent): void {
    event.stopPropagation();
    this.uiStateService.openConfirmDeleteDialog(site);
  }

  // Favicon & Fallback Logic
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

  // --- Drag and Drop Logic ---
  onDragStart(event: DragEvent, site: Site, fromCategory: Category): void {
    event.stopPropagation();
    this.draggedItem = { site, fromCategory };
    (event.target as HTMLElement).classList.add('dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; }
  }

  onDragOverSite(event: DragEvent, targetElement: HTMLElement): void {
    if (!this.draggedItem) return;
    event.preventDefault();
    targetElement.classList.add('drag-over');
  }

  onDragLeaveSite(event: DragEvent, targetElement: HTMLElement): void {
    targetElement.classList.remove('drag-over');
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

  onDragEnd(event: DragEvent): void {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => el.classList.remove('dragging', 'drag-over'));
    this.draggedItem = null;
  }

  onCategoryDragStart(event: DragEvent, category: Category): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) { event.preventDefault(); return; }
    this.draggedCategory = category;
    (event.currentTarget as HTMLElement).classList.add('dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; }
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

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Category, Site } from '../../../core/models/site.model';

export interface ContextMenuOpenEvent {
  site: Site;
  category: Category;
  event: MouseEvent;
  isFirst: boolean;
  isLast: boolean;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './category-list.html',
  styleUrl: './category-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryListComponent {
  @Input() categories: Category[] = [];
  @Input() isExpanded = true;
  @Input() activeSiteUrl: string | null = null;
  @Input() collapsedState: Record<string, boolean> = {};

  @Output() siteSelected = new EventEmitter<{ site: Site, category: Category }>();
  @Output() categoryToggled = new EventEmitter<string>();
  @Output() contextMenuOpened = new EventEmitter<ContextMenuOpenEvent>();
  @Output() categoriesUpdated = new EventEmitter<Category[]>();

  private draggedSite: { site: Site, fromCategory: Category } | null = null;
  private draggedCategory: Category | null = null;

  faviconErrorUrls = new Set<string>();
  private colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'
  ];

  isCategoryCollapsed(categoryName: string): boolean {
    return this.collapsedState[categoryName] ?? false;
  }

  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch { return ''; }
  }
  onFaviconError(site: Site): void { this.faviconErrorUrls.add(site.url); }
  hasFaviconError(site: Site): boolean { return this.faviconErrorUrls.has(site.url); }
  getFirstLetter(name: string): string { return name ? name.charAt(0).toUpperCase() : ''; }
  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return this.colorPalette[Math.abs(hash % this.colorPalette.length)];
  }

  onSiteDragStart(event: DragEvent, site: Site, fromCategory: Category): void {
    event.stopPropagation();
    this.draggedSite = { site, fromCategory };
    (event.target as HTMLElement).classList.add('dragging');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSiteDragOver(event: DragEvent, targetElement: HTMLElement): void {
    if (!this.draggedSite) return;
    event.preventDefault();
    targetElement.classList.add('drag-over');
  }

  onSiteDragLeave(event: DragEvent, targetElement: HTMLElement): void {
    targetElement.classList.remove('drag-over');
  }

  onCategoryDragOverForSite(event: DragEvent, targetCategory: Category): void {
    if (!this.draggedSite || this.draggedSite.fromCategory.name === targetCategory.name) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('site-drag-over');
  }

  onCategoryDragLeaveForSite(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('site-drag-over');
  }

  onDropOnSite(event: DragEvent, targetSite: Site, targetCategory: Category): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggedSite || this.draggedSite.site.url === targetSite.url) return;

    const currentCategories = JSON.parse(JSON.stringify(this.categories));
    const fromCat = currentCategories.find((c: Category) => c.name === this.draggedSite!.fromCategory.name)!;
    const toCat = currentCategories.find((c: Category) => c.name === targetCategory.name)!;

    fromCat.sites = fromCat.sites.filter((s: Site) => s.url !== this.draggedSite!.site.url);
    const targetIndex = toCat.sites.findIndex((s: Site) => s.url === targetSite.url);
    toCat.sites.splice(targetIndex, 0, this.draggedSite.site);

    this.categoriesUpdated.emit(currentCategories);
  }

  onDropInEmptyCategory(event: DragEvent, targetCategory: Category): void {
    event.preventDefault();
    if (!this.draggedSite || this.draggedSite.fromCategory.name === targetCategory.name) return;

    const currentCategories = JSON.parse(JSON.stringify(this.categories));
    const fromCat = currentCategories.find((c: Category) => c.name === this.draggedSite!.fromCategory.name)!;
    const toCat = currentCategories.find((c: Category) => c.name === targetCategory.name)!;

    fromCat.sites = fromCat.sites.filter((s: Site) => s.url !== this.draggedSite!.site.url);
    toCat.sites.push(this.draggedSite.site);

    this.categoriesUpdated.emit(currentCategories);
  }

  onSiteDragEnd(): void {
    document.querySelectorAll('.dragging, .drag-over, .site-drag-over').forEach(el => el.classList.remove('dragging', 'drag-over', 'site-drag-over'));
    this.draggedSite = null;
  }

  onCategoryDragStart(event: DragEvent, category: Category): void {
    if (!this.isExpanded) { event.preventDefault(); return; }
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

    const currentCategories = [...this.categories];
    const fromIndex = currentCategories.findIndex(c => c.name === this.draggedCategory!.name);
    const toIndex = currentCategories.findIndex(c => c.name === targetCategory.name);

    if (fromIndex !== -1 && toIndex !== -1) {
      const [movedCategory] = currentCategories.splice(fromIndex, 1);
      currentCategories.splice(toIndex, 0, movedCategory);
      this.categoriesUpdated.emit(currentCategories);
    }
  }

  onCategoryDragEnd(): void {
    document.querySelectorAll('.dragging, .category-drag-over').forEach(el => el.classList.remove('dragging', 'category-drag-over'));
    this.draggedCategory = null;
  }
}

import { Component, OnInit, OnDestroy, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, BehaviorSubject, combineLatest, map, Subscription } from 'rxjs';

// --- Child Component Imports ---
import { SearchBarComponent } from './search-bar/search-bar';
import { CategoryListComponent, ContextMenuOpenEvent } from './category-list/category-list';
import { AvailableSitesComponent } from './available-sites/available-sites';
import { ContextMenuComponent, ContextMenuData } from './context-menu/context-menu';

// --- Service and Model Imports ---
import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { Category, Site, AvailableSite } from '../../core/models/site.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    SearchBarComponent,
    CategoryListComponent,
    AvailableSitesComponent,
    ContextMenuComponent
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit, OnDestroy {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);

  @ViewChild(SearchBarComponent) searchBar!: SearchBarComponent;

  dataLoadingState$ = this.uiStateService.dataLoadingState$;
  isSidebarCollapsed$ = this.uiStateService.isSidebarCollapsed$;
  activeSiteUrl$: Observable<string | null> = this.uiStateService.selectedSite$.pipe(map(s => s?.url ?? null));
  categoryCollapseState$: Observable<Record<string, boolean>> = this.uiStateService.collapsedCategories$;

  searchTerm$ = new BehaviorSubject<string>('');
  filteredCategories$!: Observable<Category[]>;
  filteredAvailableSites$!: Observable<AvailableSite[]>;

  private isTemporarilyExpanded$ = new BehaviorSubject<boolean>(false);
  isExpanded$: Observable<boolean>;
  private subscriptions = new Subscription();

  contextMenuData: ContextMenuData | null = null;

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
        const termLower = term.toLowerCase();
        return categories
          .map(category => ({
            ...category,
            sites: category.sites.filter(site => site.name.toLowerCase().includes(termLower))
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
  }

  onSearchChanged(term: string): void {
    this.searchTerm$.next(term);
  }

  onSelectSite(site: Site): void {
    this.uiStateService.selectSite(site);
  }

  onToggleCategory(categoryName: string): void {
    const currentState = this.uiStateService.collapsedCategories$.getValue();
    const newState = { ...currentState, [categoryName]: !currentState[categoryName] };
    this.uiStateService.saveCollapsedCategories(newState);
  }

  onAddSiteFromAvailable(site: AvailableSite): void {
    const categoryName = site.category || 'כללי';
    this.siteDataService.addSite({ name: site.name, url: site.url }, categoryName);
    this.searchBar.clearSearch();
  }

  onContextMenuOpen(data: ContextMenuOpenEvent): void {
    this.contextMenuData = data;
  }

  onContextMenuClose(): void {
    this.contextMenuData = null;
  }

  onDeleteSite(site: Site): void {
    this.uiStateService.openConfirmDeleteDialog(site);
    this.onContextMenuClose();
  }

  onChangeSiteCategory(event: { site: Site, fromCategory: Category, toCategory: Category }): void {
    this.siteDataService.moveSiteToCategory(event.site, event.fromCategory.name, event.toCategory.name);
    this.onContextMenuClose();
  }

  onNewSiteCategory(event: { site: Site, fromCategory: Category }): void {
    this.uiStateService.openInputDialog({
      title: 'קטגוריה חדשה',
      label: 'שם הקטגוריה:',
      confirmButtonText: 'הוסף והעבר',
      callback: (newCategoryName) => {
        if (newCategoryName) {
          this.siteDataService.moveSiteToCategory(event.site, event.fromCategory.name, newCategoryName);
        }
      }
    });
    this.onContextMenuClose();
  }

  onMoveSiteUp(event: { site: Site, fromCategory: Category }): void {
    this.siteDataService.moveSite(event.site, event.fromCategory.name, 'up');
    this.onContextMenuClose();
  }

  onMoveSiteDown(event: { site: Site, fromCategory: Category }): void {
    this.siteDataService.moveSite(event.site, event.fromCategory.name, 'down');
    this.onContextMenuClose();
  }

  onUpdateCategories(categories: Category[]): void {
    this.siteDataService.updateCategories(categories);
  }

  toggleSidebar(): void {
    this.uiStateService.toggleSidebar();
  }

  expandAndFocusSearch(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.uiStateService.toggleSidebar();
      setTimeout(() => this.searchBar.focus(), 300);
    } else {
      this.searchBar.focus();
    }
  }

  openAddSiteDialog(): void {
    this.uiStateService.openAddSiteDialog();
  }

  onSidebarMouseEnter(): void {
    if (this.uiStateService.isSidebarCollapsed$.getValue()) {
      this.isTemporarilyExpanded$.next(true);
    }
  }

  onSidebarMouseLeave(): void {
    this.isTemporarilyExpanded$.next(false);
  }
}

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
import { AnalyticsService } from '../../core/services/analytics.service';
import { Category, Site, AvailableSite } from '../../core/models/site.model';
import { ToastService } from '../../core/services/toast.service';
import { ExtensionCommunicationService } from '../../core/services/extension-communication.service';

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
  analyticsService = inject(AnalyticsService);
  toastService = inject(ToastService);
  extensionCommService = inject(ExtensionCommunicationService);

  @ViewChild(SearchBarComponent) searchBar!: SearchBarComponent;

  dataLoadingState$ = this.uiStateService.dataLoadingState$;
  isSidebarCollapsed$ = this.uiStateService.isSidebarCollapsed$;
  activeSiteUrl$: Observable<string | null> = this.uiStateService.selectedSite$.pipe(map(s => s?.url ?? null));
  categoryCollapseState$: Observable<Record<string, boolean>> = this.uiStateService.collapsedCategories$;
  mutedDomains$ = this.siteDataService.mutedDomains$; // הוספת המשתנה

  searchTerm$ = new BehaviorSubject<string>('');
  filteredCategories$!: Observable<Category[]>;
  filteredAvailableSites$!: Observable<AvailableSite[]>;

  showInstallBanner$: Observable<boolean>;

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

    this.showInstallBanner$ = this.extensionCommService.isExtensionActive$.pipe(
      map((isActive) => !isActive)
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

  onSelectSite(event: { site: Site, category: Category }): void {
    this.uiStateService.selectSite(event.site, event.category.name);
  }

  onToggleCategory(categoryName: string): void {
    const currentState = this.uiStateService.collapsedCategories$.getValue();
    const newState = { ...currentState, [categoryName]: !currentState[categoryName] };
    this.uiStateService.saveCollapsedCategories(newState);
  }

  onAddSiteFromAvailable(site: AvailableSite): void {
    const categoryName = site.category || 'כללי';
    this.siteDataService.addSite(site, categoryName);
    this.searchBar.clearSearch();
  }

  onContextMenuOpen(data: ContextMenuOpenEvent): void {
    // בדיקה סינכרונית האם האתר מושתק לצורך בניית התפריט
    const mutedSet = new Set(this.getExtensionMutedDomainsSync());
    const isMuted = this.siteDataService.isSiteMuted(data.site.url, mutedSet);

    this.contextMenuData = {
        ...data,
        isMuted: isMuted // הוספת הסטטוס לנתוני התפריט
    };
  }

  // פונקציית עזר לשליפת הערך הנוכחי (הכי עדכני)
  private getExtensionMutedDomainsSync(): Set<string> {
      let currentSet = new Set<string>();
      this.mutedDomains$.subscribe(set => currentSet = set).unsubscribe();
      return currentSet;
  }

  onContextMenuClose(): void {
    this.contextMenuData = null;
  }

  onDeleteSite(site: Site): void {
    this.uiStateService.openConfirmDeleteDialog(site);
    this.onContextMenuClose();
  }

  onCopySiteLink(event: { site: Site, category: Category }): void {
    const { site, category } = event;
    const url = `${window.location.origin}${window.location.pathname}?name=${encodeURIComponent(site.name)}&url=${encodeURIComponent(site.url)}&category=${encodeURIComponent(category.name)}`;

    navigator.clipboard.writeText(url).then(() => {
      this.toastService.show('הקישור הועתק', 'info');
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      this.toastService.show('שגיאה בהעתקת הקישור', 'error');
    });

    this.onContextMenuClose();
  }

  // פונקציה לטיפול בלחיצה על השתקה
  onToggleSiteMute(site: Site): void {
    if (!this.extensionCommService.isExtensionActiveValue) {
        this.toastService.show('אפשרות זו זמינה רק כאשר התוסף מותקן ופעיל', 'error');
        return;
    }
    this.siteDataService.toggleMuteForSite(site);
    this.toastService.show('הגדרת ההתראות עודכנה', 'success');
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

  onShowAdvertisePage(): void {
    this.analyticsService.trackButtonClick({
      button_name: 'sidebar_advertise',
      button_location: 'sidebar',
    });
    this.uiStateService.loadCustomContentFromSource('advertise', {});
  }

  onShowContactPage(): void {
    this.analyticsService.trackButtonClick({
      button_name: 'sidebar_contact',
      button_location: 'sidebar',
    });
    this.uiStateService.loadCustomContentFromSource('contact', {});
  }

  onShowHelpPage(): void {
    this.analyticsService.trackButtonClick({
      button_name: 'sidebar_help',
      button_location: 'sidebar',
    });
    this.uiStateService.loadCustomContentFromSource('help', {});
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
    this.analyticsService.trackButtonClick({
      button_name: 'open_add_channel_dialog',
      button_location: 'sidebar',
    });
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

  onLogoClick(event: MouseEvent): void {
    // בדיקה האם זו לחיצה רגילה (כפתור שמאלי ללא מקשי עזר)
    const isNormalClick = event.button === 0 &&
                          !event.ctrlKey &&
                          !event.metaKey &&
                          !event.shiftKey &&
                          !event.altKey;

    if (isNormalClick) {
      event.preventDefault(); // עצירת הטעינה מחדש של הדפדפן
      this.uiStateService.resetToHome();

      // ניקוי שדה החיפוש אם הוא פתוח
      this.searchTerm$.next('');
      if (this.searchBar) {
        this.searchBar.clearSearch();
      }
    }
    // אם זה לא Normal Click (למשל קליק אמצעי או Ctrl+קליק), הדפדפן ימשיך כרגיל ל-href
  }
}

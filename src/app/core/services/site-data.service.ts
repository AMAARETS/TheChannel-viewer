import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, BehaviorSubject, catchError, of, tap, Observable, map } from 'rxjs';
import { Category, Site, AvailableSite } from '../models/site.model';
import { UiStateService } from './ui-state.service';
import { ToastService } from './toast.service';
import { ExtensionCommunicationService } from './extension-communication.service';

@Injectable({
  providedIn: 'root'
})
export class SiteDataService {
  private readonly userCategoriesKey = 'userChannelCategories';
  private readonly removedDefaultSitesKey = 'removedDefaultSites';
  private readonly oldStorageKey = 'userSites';

  private defaultSites: Site[] = [];
  private http = inject(HttpClient);
  private uiStateService = inject(UiStateService);
  private toastService = inject(ToastService);
  private extensionCommService = inject(ExtensionCommunicationService);

  categories$ = new BehaviorSubject<Category[]>([]);
  availableSites$ = new BehaviorSubject<AvailableSite[]>([]);

  // חשיפת סטטוס המושתקים
  mutedDomains$ = this.extensionCommService.mutedDomains$;

  constructor() {
    this.loadInitialData();
    this.listenToExternalUpdates();
  }


  private loadInitialData(): void {
    this.uiStateService.dataLoadingState$.next('loading');
    forkJoin({
      defaultCategories: this.http.get<Category[]>('assets/sites.json'),
      availableSites: this.http.get<AvailableSite[]>('assets/available-sites.json')
    }).pipe(
      tap(() => this.uiStateService.dataLoadingState$.next('loaded')),
      catchError(error => {
        console.error("Failed to load site data", error);
        this.uiStateService.dataLoadingState$.next('error');
        this.toastService.show('אירעה שגיאה בטעינת הערוצים', 'error');
        return of({ defaultCategories: [], availableSites: [] });
      })
    ).subscribe(({ defaultCategories, availableSites }) => {
      this.availableSites$.next(availableSites);
      this.defaultSites = defaultCategories.flatMap(cat => cat.sites);
      this.loadUserCategoriesAndMerge(defaultCategories);
    });
  }

  private listenToExternalUpdates(): void {
  this.extensionCommService.settingsUpdate$.subscribe(response => {
    if (response && response.settings) {
      // מניעת לולאה: אם ה-timestamp ב-Extension חדש יותר ממה שיש לנו כרגע ב-UI
      // (אפשר להוסיף בדיקת timestamp אם רוצים להיות מאוד מדויקים,
      // אבל אנגולר יטפל בכך שה-UI לא יתרענן אם הנתונים זהים)

      this.uiStateService.dataLoadingState$.next('loaded');
      this.categories$.next(response.settings.categories);

      // עדכון מצב הסרגל אם השתנה בטאב אחר
      if (response.settings.sidebarCollapsed !== undefined) {
        this.uiStateService.isSidebarCollapsed$.next(response.settings.sidebarCollapsed);
      }
      if (response.settings.collapsedCategories) {
        this.uiStateService.collapsedCategories$.next(response.settings.collapsedCategories);
      }
    }
  });

  // בונוס: סנכרון בין טאבים של Localhost גם ללא תוסף (באמצעות LocalStorage Event)
  window.addEventListener('storage', (event) => {
    if (event.key === this.userCategoriesKey && event.newValue) {
      this.categories$.next(JSON.parse(event.newValue));
    }
  });
}

  private async loadUserCategoriesAndMerge(defaultCategories: Category[]): Promise<void> {
    const extensionResponse = await this.extensionCommService.requestSettingsFromExtension();

    let userCategories: Category[] | null = null;

    if (extensionResponse?.settings) {
      console.log('TheChannel: Using settings from extension');
      userCategories = extensionResponse.settings.categories;

      if (extensionResponse.settings.sidebarCollapsed !== undefined) {
        this.uiStateService.isSidebarCollapsed$.next(extensionResponse.settings.sidebarCollapsed);
      }
      if (extensionResponse.settings.collapsedCategories) {
        this.uiStateService.saveCollapsedCategories(extensionResponse.settings.collapsedCategories);
      }
      if (extensionResponse.settings.removedDefaultSites) {
          const removedSet = new Set(extensionResponse.settings.removedDefaultSites);
          this.saveRemovedDefaultSites(removedSet);
      }
    } else {
      console.log('TheChannel: Extension not available, using localStorage');
      userCategories = this.loadCategoriesFromStorage();
    }

    if (!userCategories) {
        this.categories$.next(defaultCategories.filter(cat => cat.sites.length > 0));
    } else {
        const merged = this.mergeDefaultSites(userCategories, defaultCategories);
        this.categories$.next(merged);
    }
    this.saveCategories();
  }

  private loadCategoriesFromStorage(): Category[] | null {
    const savedCategoriesRaw = localStorage.getItem(this.userCategoriesKey);
    if (savedCategoriesRaw) {
        try {
            const parsed = JSON.parse(savedCategoriesRaw);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { console.error("Error parsing categories, ignoring.", e); }
    }

    const oldSitesRaw = localStorage.getItem(this.oldStorageKey);
    if (oldSitesRaw) {
        try {
            const oldSites = JSON.parse(oldSitesRaw);
            if (Array.isArray(oldSites) && oldSites.length > 0) {
                console.log('Migrating data from old format.');
                localStorage.removeItem(this.oldStorageKey);
                return [{ name: 'הערוצים שלי', sites: oldSites }];
            }
        } catch(e) { console.error("Error parsing old sites, ignoring.", e); }
    }
    return null;
  }

  private mergeDefaultSites(userCategories: Category[], defaultCategories: Category[]): Category[] {
    const removedSites = this.getRemovedDefaultSites();
    const userSitesUrls = new Set(userCategories.flatMap(cat => cat.sites.map(s => s.url)));

    defaultCategories.forEach(defaultCategory => {
        defaultCategory.sites.forEach(defaultSite => {
            if (!userSitesUrls.has(defaultSite.url) && !removedSites.has(defaultSite.url)) {
                let targetCategory = userCategories.find(c => c.name === defaultCategory.name);
                if (!targetCategory) {
                    targetCategory = { name: defaultCategory.name, sites: [] };
                    userCategories.push(targetCategory);
                }
                targetCategory.sites.push(defaultSite);
            }
        });
    });
    return userCategories;
  }

  private saveCategories(): void {
    const categories = this.categories$.getValue();
    localStorage.setItem(this.userCategoriesKey, JSON.stringify(categories));

    if (this.extensionCommService.isExtensionActiveValue) {
      const sidebarCollapsed = this.uiStateService.isSidebarCollapsed$.getValue();
      const collapsedCategories = this.uiStateService.collapsedCategories$.getValue();
      const removedDefaultSites = Array.from(this.getRemovedDefaultSites());

      this.extensionCommService.updateSettingsInExtension({
        categories,
        sidebarCollapsed,
        collapsedCategories,
        removedDefaultSites,
        lastModified: Date.now()
      });
    }
  }

  private getRemovedDefaultSites(): Set<string> {
    const removedRaw = localStorage.getItem(this.removedDefaultSitesKey);
    return new Set<string>(removedRaw ? JSON.parse(removedRaw) : []);
  }

  private saveRemovedDefaultSites(removedSet: Set<string>): void {
    localStorage.setItem(this.removedDefaultSitesKey, JSON.stringify(Array.from(removedSet)));
  }

  // --- Mute Functionality ---
  toggleMuteForSite(site: Site): void {
      try {
          const domain = new URL(site.url).hostname;
          this.extensionCommService.toggleMuteDomain(domain);
      } catch (e) {
          console.error('Invalid URL for mute toggle', site.url);
      }
  }

  isSiteMuted(siteUrl: string, mutedSet: Set<string>): boolean {
      try {
          const domain = new URL(siteUrl).hostname;
          return mutedSet.has(domain);
      } catch { return false; }
  }
  // --------------------------

  addSite(newSite: Site, categoryName: string): boolean {
    const currentCategories = this.categories$.getValue();
    if (currentCategories.some(c => c.sites.some(s => s.url === newSite.url))) {
      this.toastService.show('הערוץ כבר קיים ברשימה', 'error');
      return false;
    }

    const targetCategory = currentCategories.find(c => c.name === categoryName);
    if (targetCategory) {
      targetCategory.sites.push(newSite);
    } else {
      currentCategories.push({ name: categoryName, sites: [newSite] });
    }

    this.categories$.next(currentCategories);
    this.saveCategories();
    this.toastService.show(`הערוץ '${newSite.name}' נוסף בהצלחה`);
    return true;
  }

  removeSite(siteToRemove: Site): void {
    if (this.defaultSites.some(s => s.url === siteToRemove.url)) {
      const removedSites = this.getRemovedDefaultSites();
      removedSites.add(siteToRemove.url);
      this.saveRemovedDefaultSites(removedSites);
    }

    let currentCategories = this.categories$.getValue();
    currentCategories.forEach(cat => { cat.sites = cat.sites.filter(s => s.url !== siteToRemove.url); });
    currentCategories = currentCategories.filter(cat => cat.sites.length > 0);

    this.categories$.next(currentCategories);
    this.saveCategories();
    this.toastService.show(`הערוץ '${siteToRemove.name}' נמחק`);
  }

  moveSiteToCategory(siteToMove: Site, fromCategoryName: string, toCategoryName: string): void {
    if (fromCategoryName === toCategoryName) return;

    const currentCategories = JSON.parse(JSON.stringify(this.categories$.getValue()));
    const fromCategory = currentCategories.find((c: Category) => c.name === fromCategoryName);
    const toCategory = currentCategories.find((c: Category) => c.name === toCategoryName);

    if (!fromCategory) return;

    fromCategory.sites = fromCategory.sites.filter((s: Site) => s.url !== siteToMove.url);

    if (toCategory) {
      toCategory.sites.push(siteToMove);
    } else {
      currentCategories.push({ name: toCategoryName, sites: [siteToMove] });
    }

    const updatedCategories = currentCategories.filter((c: Category) => c.sites.length > 0);
    this.updateCategories(updatedCategories);
    this.toastService.show(`'${siteToMove.name}' הועבר לקטגוריית '${toCategoryName}'`, 'info');
  }

  getCategoryForSite(siteToFind: Site): string | null {
    const categories = this.categories$.getValue();
    for (const category of categories) {
      if (category.sites.some(site => site.url === siteToFind.url)) {
        return category.name;
      }
    }
    return null;
  }

  moveSite(site: Site, fromCategoryName: string, direction: 'up' | 'down'): void {
    const categories = [...this.categories$.getValue()];
    const category = categories.find(c => c.name === fromCategoryName);
    if (!category) return;

    const index = category.sites.findIndex(s => s.url === site.url);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [category.sites[index], category.sites[index - 1]] = [category.sites[index - 1], category.sites[index]];
    } else if (direction === 'down' && index < category.sites.length - 1) {
      [category.sites[index], category.sites[index + 1]] = [category.sites[index + 1], category.sites[index]];
    } else {
      return; // No move was possible
    }

    this.updateCategories(categories);
  }

  updateCategories(updatedCategories: Category[]): void {
    const cleanedCategories = updatedCategories.filter(c => c.sites.length > 0);
    this.categories$.next(cleanedCategories);
    this.saveCategories();
  }
}

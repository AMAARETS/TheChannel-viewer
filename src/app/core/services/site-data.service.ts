import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, BehaviorSubject, catchError, of } from 'rxjs';
import { Category, Site, AvailableSite } from '../models/site.model';
import { UiStateService } from './ui-state.service';
import { ToastService } from './toast.service';
import { ExtensionCommunicationService, AppSettings } from './extension-communication.service';

@Injectable({
  providedIn: 'root'
})
export class SiteDataService {
  private readonly userSettingsKey = 'userChannelSettings';
  private readonly removedDefaultSitesKey = 'removedDefaultSites';
  private readonly oldStorageKey = 'userSites';

  private defaultSites: Site[] = [];
  private http = inject(HttpClient);
  private uiStateService = inject(UiStateService);
  private toastService = inject(ToastService);
  private extensionCommService = inject(ExtensionCommunicationService);

  categories$ = new BehaviorSubject<Category[]>([]);
  availableSites$ = new BehaviorSubject<AvailableSite[]>([]);

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.uiStateService.dataLoadingState$.next('loading');

    forkJoin({
      defaultCategories: this.http.get<Category[]>('assets/sites.json'),
      availableSites: this.http.get<AvailableSite[]>('assets/available-sites.json')
    }).pipe(
      catchError(error => {
        console.error("Failed to load site data", error);
        this.uiStateService.dataLoadingState$.next('error');
        this.toastService.show('אירעה שגיאה בטעינת הערוצים', 'error');
        return of({ defaultCategories: [], availableSites: [] });
      })
    ).subscribe(async ({ defaultCategories, availableSites }) => {
      this.availableSites$.next(availableSites);
      this.defaultSites = defaultCategories.flatMap(cat => cat.sites);

      const extensionResponse = await this.extensionCommService.requestSettingsFromExtension();
      const localSettings = this.loadSettingsFromStorage();

      const extSettings = extensionResponse?.settings;
      const extTimestamp = extensionResponse?.lastModified || 0;
      const localTimestamp = localSettings?.lastModified || 0;

      let finalSettings: AppSettings;
      let winningSource: 'extension' | 'local' | 'default' = 'default';

      if (extTimestamp > localTimestamp) {
        console.log("Loading settings from extension (newer).");
        finalSettings = extSettings!;
        winningSource = 'extension';
      } else if (localTimestamp > 0) {
        console.log("Loading settings from localStorage (newer or extension unavailable).");
        finalSettings = localSettings!;
        winningSource = 'local';
      } else {
        console.log("Loading default settings.");
        finalSettings = { categories: defaultCategories, sidebarCollapsed: false, collapsedCategories: {}, lastModified: 0 };
      }
      
      const mergedCategories = this.mergeDefaultSites(finalSettings.categories, defaultCategories);
      this.categories$.next(mergedCategories);
      this.uiStateService.loadInitialStateFromExtension(finalSettings);

      if (winningSource === 'local') {
        this.saveCategories(false);
      } else {
        this.saveCategoriesToStorageOnly();
      }
      
      this.uiStateService.dataLoadingState$.next('loaded');
    });
  }
  
  // <--- תיקון: הפונקציה מחזירה AppSettings מלא
  private loadSettingsFromStorage(): AppSettings | null {
    const savedSettingsRaw = localStorage.getItem(this.userSettingsKey);
    if (savedSettingsRaw) {
      try {
        const parsed = JSON.parse(savedSettingsRaw);
        if (Array.isArray(parsed.categories) && typeof parsed.lastModified === 'number') {
          return {
            categories: parsed.categories,
            sidebarCollapsed: parsed.sidebarCollapsed ?? false,
            collapsedCategories: parsed.collapsedCategories ?? {},
            lastModified: parsed.lastModified
          };
        }
      } catch (e) { console.error("Error parsing settings, ignoring.", e); }
    }
    // מיגרציה
    const oldSitesRaw = localStorage.getItem(this.oldStorageKey);
    if (oldSitesRaw) {
        try {
            const oldSites = JSON.parse(oldSitesRaw);
            if (Array.isArray(oldSites) && oldSites.length > 0) {
                console.log('Migrating data from old format.');
                localStorage.removeItem(this.oldStorageKey);
                return { 
                  categories: [{ name: 'הערוצים שלי', sites: oldSites }],
                  sidebarCollapsed: false,
                  collapsedCategories: {},
                  lastModified: Date.now() 
                };
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
    return userCategories.filter(cat => cat.sites && cat.sites.length > 0);
  }

  private saveCategories(showToast = true): void {
    const settings = {
        ...this.uiStateService.getCurrentSettings(),
        lastModified: Date.now()
    };
    localStorage.setItem(this.userSettingsKey, JSON.stringify(settings));
    this.extensionCommService.updateSettingsInExtension(settings);
    if (showToast) {
        this.toastService.show('ההגדרות נשמרו והסתנכרנו', 'info');
    }
  }

  private saveCategoriesToStorageOnly(): void {
    const settings = {
        ...this.uiStateService.getCurrentSettings(),
        lastModified: Date.now()
    };
    localStorage.setItem(this.userSettingsKey, JSON.stringify(settings));
  }
  
  private getRemovedDefaultSites(): Set<string> {
    const removedRaw = localStorage.getItem(this.removedDefaultSitesKey);
    return new Set<string>(removedRaw ? JSON.parse(removedRaw) : []);
  }

  private saveRemovedDefaultSites(removedSet: Set<string>): void {
    localStorage.setItem(this.removedDefaultSitesKey, JSON.stringify(Array.from(removedSet)));
  }

  addSite(newSite: Site, categoryName: string): boolean {
    const currentCategories = [...this.categories$.getValue()];
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
    this.updateCategories(currentCategories);
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
    } else { return; }
    this.updateCategories(categories);
  }

  updateCategories(updatedCategories: Category[]): void {
    const cleanedCategories = updatedCategories.filter(c => c.sites && c.sites.length > 0);
    this.categories$.next(cleanedCategories);
    this.saveCategories(false);
  }
}
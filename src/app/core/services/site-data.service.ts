import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, BehaviorSubject, catchError, of, tap, map } from 'rxjs';
import { Category, Site, AvailableSite } from '../models/site.model';
import { UiStateService } from './ui-state.service';
import { ToastService } from './toast.service';
import { ExtensionCommunicationService } from './extension-communication.service';

@Injectable({
  providedIn: 'root'
})
export class SiteDataService {
  private readonly userCategoriesKey = 'userChannelCategories';
  private readonly collapsedCategoriesKey = 'collapsedCategories';
  private readonly removedDefaultSitesKey = 'removedDefaultSites';
  private readonly oldStorageKey = 'userSites';

  private defaultSites: Site[] = [];
  private http = inject(HttpClient);
  private uiStateService = inject(UiStateService);
  private toastService = inject(ToastService);
  private extensionCommService = inject(ExtensionCommunicationService);

  categories$ = new BehaviorSubject<Category[]>([]);
  availableSites$ = new BehaviorSubject<AvailableSite[]>([]);

  mutedDomains$ = this.extensionCommService.mutedDomains$;

  constructor() {
    this.loadInitialData();
    this.listenToExternalUpdates();
  }

  /**
   * בדיקת תקינות ערוץ: מסונן לפי תאריך ו-view אלא אם נוסף ידנית (isManual)
   */
  private isSiteInvalidByServer(site: Site, now: number): boolean {
    // 1. בדיקה אם השרת סימן אותו במפורש כלא להצגה
    if (site.view === false) return true;

    // 2. בדיקה אם יש תאריך תפוגה והוא עבר
    if (site.dateEnd) {
      const parts = site.dateEnd.split('-');
      if (parts.length === 3) {
        // יצירת אובייקט תאריך לסוף היום המצוין
        const expiry = new Date(+parts[2], +parts[1] - 1, +parts[0], 23, 59, 59).getTime();
        if (now > expiry) return true;
      }
    }

    return false;
  }

  private loadInitialData(): void {
    this.uiStateService.dataLoadingState$.next('loading');
    const now = Date.now();

    forkJoin({
      defaultCategories: this.http.get<Category[]>('assets/sites.json'),
      availableSites: this.http.get<AvailableSite[]>('assets/available-sites.json')
    }).pipe(
      map(data => ({
        // סינון ה-JSON-ים מהשרת לפני שהם נכנסים למערכת
        defaultCategories: data.defaultCategories.map(cat => ({
          ...cat,
          sites: cat.sites.filter(s => !this.isSiteInvalidByServer(s, now))
        })).filter(cat => cat.sites.length > 0),
        availableSites: data.availableSites.filter(s => !this.isSiteInvalidByServer(s, now))
      })),
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
        this.uiStateService.dataLoadingState$.next('loaded');
        this.categories$.next(response.settings.categories);

        if (response.settings.sidebarCollapsed !== undefined) {
          this.uiStateService.isSidebarCollapsed$.next(response.settings.sidebarCollapsed);
        }
        if (response.settings.collapsedCategories) {
          this.uiStateService.collapsedCategories$.next(response.settings.collapsedCategories);
        }
      }
    });

    window.addEventListener('storage', (event) => {
      if (event.key === this.userCategoriesKey && event.newValue) {
        this.categories$.next(JSON.parse(event.newValue));
      }
      if (event.key === this.collapsedCategoriesKey && event.newValue) {
        this.uiStateService.collapsedCategories$.next(JSON.parse(event.newValue));
      }
    });
  }

  private async loadUserCategoriesAndMerge(defaultCategories: Category[]): Promise<void> {
    const extensionResponse = await this.extensionCommService.requestSettingsFromExtension();
    let userCategories: Category[] | null = null;

    if (extensionResponse?.settings) {
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
      } catch (e) { console.error("Error parsing categories", e); }
    }

    const oldSitesRaw = localStorage.getItem(this.oldStorageKey);
    if (oldSitesRaw) {
      try {
        const oldSites = JSON.parse(oldSitesRaw);
        if (Array.isArray(oldSites) && oldSites.length > 0) {
          localStorage.removeItem(this.oldStorageKey);
          // ערוצים שעברו מיגראציה נחשבים לידניים כדי שלא יימחקו בטעות
          return [{ name: 'הערוצים שלי', sites: oldSites.map((s: any) => ({ ...s, isManual: true })) }];
        }
      } catch (e) { console.error("Error parsing old sites", e); }
    }
    return null;
  }

  private mergeDefaultSites(userCategories: Category[], defaultCategories: Category[]): Category[] {
    const removedSites = this.getRemovedDefaultSites();
    const now = Date.now();

    // 1. בונים "רשימה שחורה" של כל ה-URLs שהשרת פוסל כרגע (תאריך עבר או view: false)
    const serverBlacklist = new Set<string>();
    defaultCategories.forEach(cat => {
      cat.sites.forEach(site => {
        if (this.isSiteInvalidByServer(site, now)) {
          serverBlacklist.add(site.url);
        }
      });
    });

    // 2. סינון רשימת המשתמש
    const sanitizedUser = userCategories.map(cat => ({
      ...cat,
      sites: cat.sites.filter(site => {
        // אם הערוץ "פסול" ע"י השרת ואינו ידני - מסירים אותו
        if (serverBlacklist.has(site.url) && !site.isManual) {
          return false;
        }
        // בכל מקרה אחר:
        // - ערוץ ידני (isManual: true) נשאר תמיד
        // - ערוץ שלא קיים בשרת בכלל נשאר (לפי הלוגיקה הקודמת שביקשת)
        // - ערוץ שקיים בשרת והוא תקין נשאר
        return true;
      })
    })).filter(cat => cat.sites.length > 0);

    // 3. הוספת ערוצים חדשים מהשרת (כאלו שהם תקינים והמשתמש עוד לא מכיר)
    const userSitesUrls = new Set(sanitizedUser.flatMap(cat => cat.sites.map(s => s.url)));

    defaultCategories.forEach(defaultCategory => {
      defaultCategory.sites.forEach(defaultSite => {
        // תנאי להוספה: תקין בשרת, לא קיים אצל המשתמש, ולא נמחק ידנית בעבר
        if (!this.isSiteInvalidByServer(defaultSite, now) &&
          !userSitesUrls.has(defaultSite.url) &&
          !removedSites.has(defaultSite.url)) {

          let targetCategory = sanitizedUser.find(c => c.name === defaultCategory.name);
          if (!targetCategory) {
            targetCategory = { name: defaultCategory.name, sites: [] };
            sanitizedUser.push(targetCategory);
          }
          targetCategory.sites.push(defaultSite);
        }
      });
    });

    return sanitizedUser;
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

  toggleMuteForSite(site: Site): void {
    try {
      const domain = new URL(site.url).hostname;
      this.extensionCommService.toggleMuteDomain(domain);
    } catch { console.error('Invalid URL for mute toggle', site.url); }
  }

  isSiteMuted(siteUrl: string, mutedSet: Set<string>): boolean {
    try {
      return mutedSet.has(new URL(siteUrl).hostname);
    } catch { return false; }
  }

  addSite(newSite: Site, categoryName: string): boolean {
    const currentCategories = this.categories$.getValue();
    if (currentCategories.some(c => c.sites.some(s => s.url === newSite.url))) {
      this.toastService.show('הערוץ כבר קיים ברשימה', 'error');
      return false;
    }

    // הוספת האתר כ-isManual כדי שישרוד סינונים בעתיד
    const siteToSave: Site = { ...newSite, isManual: true };

    const targetCategory = currentCategories.find(c => c.name === categoryName);
    if (targetCategory) {
      targetCategory.sites.push(siteToSave);
    } else {
      currentCategories.push({ name: categoryName, sites: [siteToSave] });
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

  updateSite(originalSite: Site, updatedSite: Site, categoryName: string): boolean {
    const currentCategories = [...this.categories$.getValue()];
    const category = currentCategories.find(c => c.name === categoryName);

    if (!category) return false;

    const siteIndex = category.sites.findIndex(s => s.url === originalSite.url);
    if (siteIndex === -1) return false;

    // שומרים על סטטוס הידניות בעת עריכה
    category.sites[siteIndex] = { ...updatedSite, isManual: originalSite.isManual };

    this.categories$.next(currentCategories);
    this.saveCategories();
    this.uiStateService.updateSelectedSite(originalSite.url, category.sites[siteIndex]);
    return true;
  }

  moveSiteToCategory(siteToMove: Site, fromCategoryName: string, toCategoryName: string): void {
    if (fromCategoryName === toCategoryName) return;

    const currentCategories = JSON.parse(JSON.stringify(this.categories$.getValue()));
    const fromCategory = currentCategories.find((c: Category) => c.name === fromCategoryName);
    if (!fromCategory) return;

    fromCategory.sites = fromCategory.sites.filter((s: Site) => s.url !== siteToMove.url);

    let toCategory = currentCategories.find((c: Category) => c.name === toCategoryName);
    if (toCategory) {
      toCategory.sites.push(siteToMove);
    } else {
      currentCategories.push({ name: toCategoryName, sites: [siteToMove] });
    }

    this.updateCategories(currentCategories.filter((c: Category) => c.sites.length > 0));
    this.toastService.show(`'${siteToMove.name}' הועבר לקטגוריית '${toCategoryName}'`, 'info');
  }

  getCategoryForSite(siteToFind: Site): string | null {
    const categories = this.categories$.getValue();
    for (const category of categories) {
      if (category.sites.some(site => site.url === siteToFind.url)) return category.name;
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
    }
    this.updateCategories(categories);
  }

  updateCategories(updatedCategories: Category[]): void {
    this.categories$.next(updatedCategories.filter(c => c.sites.length > 0));
    this.saveCategories();
  }
}
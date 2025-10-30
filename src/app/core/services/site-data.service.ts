import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, BehaviorSubject, catchError, of, tap } from 'rxjs';
import { Category, Site, AvailableSite } from '../models/site.model';
import { UiStateService } from './ui-state.service';
import { ToastService } from './toast.service';

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

  private loadUserCategoriesAndMerge(defaultCategories: Category[]): void {
    const userCategories: Category[] | null = this.loadCategoriesFromStorage();

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
    localStorage.setItem(this.userCategoriesKey, JSON.stringify(this.categories$.getValue()));
  }

  private getRemovedDefaultSites(): Set<string> {
    const removedRaw = localStorage.getItem(this.removedDefaultSitesKey);
    return new Set<string>(removedRaw ? JSON.parse(removedRaw) : []);
  }

  private saveRemovedDefaultSites(removedSet: Set<string>): void {
    localStorage.setItem(this.removedDefaultSitesKey, JSON.stringify(Array.from(removedSet)));
  }

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

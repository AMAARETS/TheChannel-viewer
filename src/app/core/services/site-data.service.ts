import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, BehaviorSubject } from 'rxjs';
import { Category, Site, AvailableSite } from '../models/site.model';

@Injectable({
  providedIn: 'root'
})
export class SiteDataService {
  // --- Private constants for Local Storage ---
  private readonly userCategoriesKey = 'userChannelCategories';
  private readonly removedDefaultSitesKey = 'removedDefaultSites';
  private readonly oldStorageKey = 'userSites'; // For migration

  private defaultSites: Site[] = [];
  private http = inject(HttpClient);

  // BehaviorSubject to hold and stream the categories data
  categories$ = new BehaviorSubject<Category[]>([]);
  availableSites$ = new BehaviorSubject<AvailableSite[]>([]);

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    forkJoin({
      defaultCategories: this.http.get<Category[]>('assets/sites.json'),
      availableSites: this.http.get<AvailableSite[]>('assets/available-sites.json')
    }).subscribe(({ defaultCategories, availableSites }) => {
      this.availableSites$.next(availableSites);
      this.defaultSites = defaultCategories.flatMap(cat => cat.sites);
      this.loadUserCategoriesAndMerge(defaultCategories);
    });
  }

  private loadUserCategoriesAndMerge(defaultCategories: Category[]): void {
    let userCategories: Category[] | null = this.loadCategoriesFromStorage();

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
      alert('הערוץ כבר קיים ברשימה.');
      return false;
    }

    let targetCategory = currentCategories.find(c => c.name === categoryName);
    if (targetCategory) {
      targetCategory.sites.push(newSite);
    } else {
      currentCategories.push({ name: categoryName, sites: [newSite] });
    }

    this.categories$.next(currentCategories);
    this.saveCategories();
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
  }

  updateCategories(updatedCategories: Category[]): void {
    const cleanedCategories = updatedCategories.filter(c => c.sites.length > 0);
    this.categories$.next(cleanedCategories);
    this.saveCategories();
  }
}

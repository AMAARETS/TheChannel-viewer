import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map, first } from 'rxjs';
import { Site } from '../models/site.model';

export interface InputDialogConfig {
  title: string;
  label: string;
  placeholder?: string;
  confirmButtonText: string;
  callback: (value: string) => void;
}


@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  private sanitizer = inject(DomSanitizer);

  // --- Local Storage Keys ---
  private readonly sidebarCollapsedKey = 'sidebarCollapsed';
  private readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  private readonly collapsedCategoriesKey = 'collapsedCategories';


  // --- Dialogs visibility state ---
  isAddSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isConfirmDeleteDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteToDelete$ = new BehaviorSubject<Site | null>(null);
  isInputDialogVisible$ = new BehaviorSubject<boolean>(false);
  inputDialogConfig$ = new BehaviorSubject<InputDialogConfig | null>(null);

  // --- Sidebar State ---
  isSidebarCollapsed$ = new BehaviorSubject<boolean>(this.loadFromStorage(this.sidebarCollapsedKey) ?? false);

  // --- Category Collapse State ---
  collapsedCategories$ = new BehaviorSubject<Record<string, boolean>>(this.loadFromStorage(this.collapsedCategoriesKey) ?? {});

  // --- Core Selection State ---
  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);
  selectedSite$: Observable<Site | null> = this.selectedSiteSubject.asObservable();
  activeSiteName$: Observable<string | null> = this.selectedSite$.pipe(
    map(site => site?.name ?? null)
  );
  sanitizedSelectedSiteUrl$: Observable<SafeResourceUrl | null> = this.selectedSite$.pipe(
    map(site => site ? this.sanitizer.bypassSecurityTrustResourceUrl(site.url) : null)
  );

  selectSite(site: Site | null): void {
    this.selectedSiteSubject.next(site);
    if (site) {
      this.saveToStorage(this.lastViewedSiteUrlKey, site.url);
    }
  }

  getActiveSite(): Site | null {
    return this.selectedSiteSubject.getValue();
  }

  getLastViewedSiteUrl(): string | null {
    return this.loadFromStorage(this.lastViewedSiteUrlKey);
  }

  toggleSidebar(): void {
    const newState = !this.isSidebarCollapsed$.value;
    this.isSidebarCollapsed$.next(newState);
    this.saveToStorage(this.sidebarCollapsedKey, newState);
  }

  saveCollapsedCategories(state: Record<string, boolean>): void {
    this.collapsedCategories$.next(state);
    this.saveToStorage(this.collapsedCategoriesKey, state);
  }

  // --- Dialog Methods ---
  openAddSiteDialog(): void { this.isAddSiteDialogVisible$.next(true); }
  closeAddSiteDialog(): void { this.isAddSiteDialogVisible$.next(false); }

  openConfirmDeleteDialog(site: Site): void {
    this.siteToDelete$.next(site);
    this.isConfirmDeleteDialogVisible$.next(true);
  }

  closeConfirmDeleteDialog(): void {
    this.isConfirmDeleteDialogVisible$.next(false);
    this.siteToDelete$.next(null);
  }

  openInputDialog(config: InputDialogConfig): void {
    this.inputDialogConfig$.next(config);
    this.isInputDialogVisible$.next(true);
  }

  closeInputDialog(value: string | null): void {
    if (value) {
      this.inputDialogConfig$.pipe(first()).subscribe(config => {
        config?.callback(value);
      });
    }
    this.isInputDialogVisible$.next(false);
    this.inputDialogConfig$.next(null);
  }


  // --- Local Storage Utilities ---
  private saveToStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }

  private loadFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, map, distinctUntilChanged } from 'rxjs';
import { Site } from '../models/site.model';

@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  private sanitizer = inject(DomSanitizer);

  // --- Dialogs visibility state ---
  isAddSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isConfirmDeleteDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteToDelete$ = new BehaviorSubject<Site | null>(null);

  // --- Sidebar and Selection state ---
  isSidebarCollapsed$ = new BehaviorSubject<boolean>(false);
  activeSiteName$ = new BehaviorSubject<string | null>(null);

  selectedSiteUrl$ = this.activeSiteName$.pipe(
    distinctUntilChanged(),
    map(name => {
      // Note: Logic to get URL from name would need access to SiteDataService
      // For simplicity, we'll manage the full site object instead.
      return null; // This will be improved.
    })
  );

  // A better approach for selected site
  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);
  selectedSite$ = this.selectedSiteSubject.asObservable();
  sanitizedSelectedSiteUrl$: BehaviorSubject<SafeResourceUrl | null> = new BehaviorSubject<SafeResourceUrl | null>(null);

  constructor() { }

  selectSite(site: Site | null) {
    if (site) {
      this.selectedSiteSubject.next(site);
      this.activeSiteName$.next(site.name);
      this.sanitizedSelectedSiteUrl$.next(this.sanitizer.bypassSecurityTrustResourceUrl(site.url));
    } else {
      this.selectedSiteSubject.next(null);
      this.activeSiteName$.next(null);
      this.sanitizedSelectedSiteUrl$.next(null);
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed$.next(!this.isSidebarCollapsed$.value);
  }

  openAddSiteDialog(): void {
    this.isAddSiteDialogVisible$.next(true);
  }

  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible$.next(false);
  }

  openConfirmDeleteDialog(site: Site): void {
    this.siteToDelete$.next(site);
    this.isConfirmDeleteDialogVisible$.next(true);
  }

  closeConfirmDeleteDialog(): void {
    this.isConfirmDeleteDialogVisible$.next(false);
    this.siteToDelete$.next(null);
  }
}

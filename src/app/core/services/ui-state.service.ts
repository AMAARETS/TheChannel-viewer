import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map } from 'rxjs';
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

  // --- Sidebar State ---
  isSidebarCollapsed$ = new BehaviorSubject<boolean>(false);

  // --- Core Selection State ---
  // A single source of truth for the selected site object.
  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);

  // Publicly exposed observables derived from the single source of truth.
  // This is a more robust and reactive pattern.
  selectedSite$: Observable<Site | null> = this.selectedSiteSubject.asObservable();

  /** Emits the name of the active site, or null if none is selected. */
  activeSiteName$: Observable<string | null> = this.selectedSite$.pipe(
    map(site => site?.name ?? null)
  );

  /** Emits a sanitized URL for the iframe, or null if no site is selected. */
  sanitizedSelectedSiteUrl$: Observable<SafeResourceUrl | null> = this.selectedSite$.pipe(
    map(site => site ? this.sanitizer.bypassSecurityTrustResourceUrl(site.url) : null)
  );

  /**
   * Selects a new site. All dependent observables (`activeSiteName$`, `sanitizedSelectedSiteUrl$`)
   * will update automatically.
   * @param site The site to select, or null to clear selection.
   */
  selectSite(site: Site | null): void {
    this.selectedSiteSubject.next(site);
  }

  /**
   * Synchronously gets the current value of the selected site.
   * Useful for logic that needs an immediate snapshot of the state.
   */
  getActiveSite(): Site | null {
    return this.selectedSiteSubject.getValue();
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

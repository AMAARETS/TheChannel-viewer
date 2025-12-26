import { Injectable, inject, Injector } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Site } from '../models/site.model';
import { SiteDataService } from './site-data.service';
import { AnalyticsService } from './analytics.service';
import { ExtensionCommunicationService } from './extension-communication.service';

// Modular Services
import { UserPreferencesService } from './ui/user-preferences.service';
import { DialogService } from './ui/dialog.service';
import { NavigationService } from './ui/navigation.service';
import { ContentLoaderService } from './ui/content-loader.service';
import { InputDialogConfig, DataLoadingState, ActiveView } from './ui/ui-types';

// Re-export types for compatibility with existing components
// FIX: Added 'type' keyword to satisfy isolatedModules requirement
export type { InputDialogConfig, DataLoadingState, ActiveView } from './ui/ui-types';

@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  private sanitizer = inject(DomSanitizer);
  private injector = inject(Injector);
  private analyticsService = inject(AnalyticsService);
  private extensionCommService = inject(ExtensionCommunicationService);

  // Inject Modular Services
  private preferences = inject(UserPreferencesService);
  private dialogs = inject(DialogService);
  private navigation = inject(NavigationService);
  private contentLoader = inject(ContentLoaderService);

  private _siteDataService: SiteDataService | null = null;

  // --- State Subjects ---
  dataLoadingState$ = new BehaviorSubject<DataLoadingState>('loading');
  activeView$ = new BehaviorSubject<ActiveView>('site');
  helpSection$ = new BehaviorSubject('extension');

  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);
  selectedSite$: Observable<Site | null> = this.selectedSiteSubject.asObservable();

  // --- Derived Observables ---
  activeSiteName$: Observable<string | null> = this.selectedSite$.pipe(
    map((site) => site?.name ?? null)
  );
  sanitizedSelectedSiteUrl$: Observable<SafeResourceUrl | null> = this.selectedSite$.pipe(
    map((site) => (site ? this.sanitizer.bypassSecurityTrustResourceUrl(this.navigation.addUtmParameters(site.url)) : null))
  );
  sanitizedCustomContent$ = this.contentLoader.sanitizedCustomContent$;

  // --- Expose Dialog Observables (Delegated to DialogService) ---
  isAddSiteDialogVisible$ = this.dialogs.isAddSiteDialogVisible$;
  isEditSiteDialogVisible$ = this.dialogs.isEditSiteDialogVisible$;
  editSiteDialogData$ = this.dialogs.editSiteDialogData$;
  isConfirmDeleteDialogVisible$ = this.dialogs.isConfirmDeleteDialogVisible$;
  siteToDelete$ = this.dialogs.siteToDelete$;
  isInputDialogVisible$ = this.dialogs.isInputDialogVisible$;
  inputDialogConfig$ = this.dialogs.inputDialogConfig$;
  isLoginTutorialDialogVisible$ = this.dialogs.isLoginTutorialDialogVisible$;
  isWelcomeDialogVisible$ = this.dialogs.isWelcomeDialogVisible$;
  isGoogleLoginUnsupportedDialogVisible$ = this.dialogs.isGoogleLoginUnsupportedDialogVisible$;
  siteForUnsupportedLoginDialog$ = this.dialogs.siteForUnsupportedLoginDialog$;
  isGrantPermissionDialogVisible$ = this.dialogs.isGrantPermissionDialogVisible$;
  siteForGrantPermissionDialog$ = this.dialogs.siteForGrantPermissionDialog$;
  isInstallExtensionDialogVisible$ = this.dialogs.isInstallExtensionDialogVisible$;
  siteForInstallExtensionDialog$ = this.dialogs.siteForInstallExtensionDialog$;
  isThirdPartyCookiesBlockedDialogVisible$ = this.dialogs.isThirdPartyCookiesBlockedDialogVisible$;

  // --- UI State Preferences ---
  isSidebarCollapsed$ = new BehaviorSubject<boolean>(
    this.preferences.loadFromStorage(this.preferences.sidebarCollapsedKey) ?? false
  );
  collapsedCategories$ = new BehaviorSubject<Record<string, boolean>>(
    this.preferences.loadFromStorage(this.preferences.collapsedCategoriesKey) ?? {}
  );

  constructor() {
    interface TheChannelAPI {
      navigateTo?: (source: string, params?: Record<string, string>) => Promise<void>;
    }
    const globalApi: TheChannelAPI = ((window as Window & { theChannel?: TheChannelAPI }).theChannel) || {};
    globalApi.navigateTo = this.loadCustomContentFromSource.bind(this);
    (window as Window & { theChannel?: TheChannelAPI }).theChannel = globalApi;
  }

  private get siteDataService(): SiteDataService {
    if (!this._siteDataService) {
      this._siteDataService = this.injector.get(SiteDataService);
    }
    return this._siteDataService;
  }

  // --- Logic Coordination ---

  enqueueDialog(dialogFn: () => void): void {
    this.dialogs.enqueueDialog(dialogFn);
  }

  processNextDialogInQueue(): void {
    this.dialogs.processNextDialogInQueue();
  }

  checkAndAlertIfThirdPartyCookiesBlocked(): void {
    if (this.preferences.isCookiesBlockedDialogGloballyDisabled()) {
      return;
    }
    if (!this.checkCookieSupport()) {
      this.enqueueDialog(() => this.dialogs.openThirdPartyCookiesBlockedDialog());
      this.processNextDialogInQueue();
    }
  }

  private checkCookieSupport(): boolean {
    try {
      const testKey = 'test_3pc_check';
      document.cookie = `${testKey}=1; SameSite=None; Secure`;
      const cookieEnabled = document.cookie.indexOf(`${testKey}=`) !== -1;
      document.cookie = `${testKey}=1; SameSite=None; Secure; expires=Thu, 01-Jan-1970 00:00:01 GMT`;
      return cookieEnabled;
    } catch {
      return false;
    }
  }

  // --- Navigation & Content Logic ---

  openHelpPage(section = 'extension', skipHistoryUpdate = false): void {
    this.contentLoader.cleanupInjectedResources();
    this.activeView$.next('help');
    this.helpSection$.next(section);
    this.selectedSiteSubject.next(null);

    if (!skipHistoryUpdate) {
      this.navigation.updateUrl({ view: 'help', section });
    }

    this.analyticsService.trackPageView({
      page_title: `Help: ${section}`,
      page_path: `/help/${section}`,
      page_location: window.location.href,
    });
  }

  updateHelpUrl(section: string): void {
    this.navigation.updateUrl({ view: 'help', section }, false); // replaceState
  }

  async loadCustomContentFromSource(
    source: string,
    params: Record<string, string> = {},
    skipHistoryUpdate = false
  ): Promise<void> {

    if (source === 'help') {
      const section = params['section'] || 'extension';
      this.openHelpPage(section, skipHistoryUpdate);
      return;
    }

    try {
      await this.contentLoader.loadFromSource(source);

      // Update active view
      if (source === 'advertise') this.activeView$.next('advertise');
      else if (source === 'contact') this.activeView$.next('contact');
      else this.activeView$.next('custom');

      this.selectedSiteSubject.next(null);

      if (!skipHistoryUpdate) {
        this.navigation.updateUrl({ view: source, ...params });
      }

      this.analyticsService.trackPageView({
        page_title: `Custom Content: ${source}`,
        page_path: `/ads/${source}`,
        page_location: window.location.href,
      });

    } catch (error) {
       this.activeView$.next('custom');
       // Error handled in contentLoader but view updated here
    }
  }

  async selectSite(site: Site | null, categoryName?: string, skipHistoryUpdate = false): Promise<void> {
    this.contentLoader.cleanupInjectedResources();
    this.selectedSiteSubject.next(site);
    this.activeView$.next('site');

    if (site) {
      this.preferences.saveToStorage(this.preferences.lastViewedSiteUrlKey, site.url);
      const catName = categoryName || this.siteDataService.getCategoryForSite(site);

      if (catName && !skipHistoryUpdate) {
        this.navigation.updateUrl({ name: site.name, url: site.url, category: catName });
      }

      this.analyticsService.trackPageView({
        page_title: site.name,
        page_path: `/sites/${catName || 'unknown'}/${site.name}`,
        page_location: site.url,
      });

      this.handleSiteTutorials(site);

    } else {
      // Just clear selection in URL if site is null
      if (!skipHistoryUpdate) {
          history.pushState(null, '', window.location.pathname);
      }
    }

    this.processNextDialogInQueue();
  }

  private async handleSiteTutorials(site: Site): Promise<void> {
    if (site.googleLoginSupported) {
      if (!this.preferences.isLoginTutorialGloballyDisabled() && !this.preferences.hasViewedTutorial(site.url)) {
        this.enqueueDialog(() => this.dialogs.openLoginTutorialDialog());
        this.preferences.markTutorialAsViewed(site.url);
      }
    } else {
      const isExtensionActive = this.extensionCommService.isExtensionActiveValue;

      if (!isExtensionActive) {
        if (!this.preferences.isInstallExtensionDialogGloballyDisabled()) {
          this.enqueueDialog(() => this.dialogs.openInstallExtensionDialog(site));
        }
      } else {
        const domains = await this.extensionCommService.requestManagedDomains();
        const siteDomain = new URL(site.url).hostname;

        if (domains && domains.includes(siteDomain)) {
          if (!this.preferences.isLoginTutorialGloballyDisabled() && !this.preferences.hasViewedTutorial(site.url)) {
            this.enqueueDialog(() => this.dialogs.openLoginTutorialDialog());
            this.preferences.markTutorialAsViewed(site.url);
          }
        } else {
          this.extensionCommService.requestPermissionForDomain(siteDomain, site.name);
        }
      }
    }
  }

  getActiveSite(): Site | null { return this.selectedSiteSubject.getValue(); }

  updateSelectedSite(originalUrl: string, updatedSite: Site): void {
    const currentSite = this.selectedSiteSubject.getValue();
    if (currentSite && currentSite.url === originalUrl) {
      this.selectedSiteSubject.next(updatedSite);
    }
  }

  getLastViewedSiteUrl(): string | null {
    return this.preferences.loadFromStorage(this.preferences.lastViewedSiteUrlKey);
  }

  resetToHome(): void {
    this.contentLoader.cleanupInjectedResources();
    this.selectedSiteSubject.next(null);
    this.activeView$.next('site');
    this.navigation.resetUrlToHome();
  }

  // --- Sidebar State Management ---

  toggleSidebar(): void {
    const newState = !this.isSidebarCollapsed$.value;
    this.isSidebarCollapsed$.next(newState);
    this.preferences.saveToStorage(this.preferences.sidebarCollapsedKey, newState);
    this.syncToExtension();
  }

  saveCollapsedCategories(state: Record<string, boolean>): void {
    this.collapsedCategories$.next(state);
    this.preferences.saveToStorage(this.preferences.collapsedCategoriesKey, state);
    this.syncToExtension();
  }

  private syncToExtension(): void {
    if (this.extensionCommService.isExtensionActiveValue) {
      const categories = this.siteDataService.categories$.getValue();
      const sidebarCollapsed = this.isSidebarCollapsed$.getValue();
      const collapsedCategories = this.collapsedCategories$.getValue();
      this.extensionCommService.updateSettingsInExtension({
        categories, sidebarCollapsed, collapsedCategories, lastModified: Date.now()
      });
    }
  }

  // --- Dialog Delegates (Passthrough) ---

  openAddSiteDialog(): void { this.dialogs.openAddSiteDialog(); }
  closeAddSiteDialog(): void { this.dialogs.closeAddSiteDialog(); }

  openEditSiteDialog(site: Site, categoryName: string): void { this.dialogs.openEditSiteDialog(site, categoryName); }
  closeEditSiteDialog(): void { this.dialogs.closeEditSiteDialog(); }

  openConfirmDeleteDialog(site: Site): void { this.dialogs.openConfirmDeleteDialog(site); }
  closeConfirmDeleteDialog(): void { this.dialogs.closeConfirmDeleteDialog(); }

  openInputDialog(config: InputDialogConfig): void { this.dialogs.openInputDialog(config); }
  closeInputDialog(value: string | null): void { this.dialogs.closeInputDialog(value); }

  openLoginTutorialDialog(): void { this.dialogs.openLoginTutorialDialog(); }
  closeLoginTutorialDialog(disableGlobally = false): void {
    if (disableGlobally) this.preferences.disableLoginTutorialGlobally();
    this.dialogs.closeLoginTutorialDialog();
  }

  isWelcomeDialogGloballyDisabled(): boolean { return this.preferences.isWelcomeDialogGloballyDisabled(); }
  openWelcomeDialog(): void { this.dialogs.openWelcomeDialog(); }
  closeWelcomeDialog(disableGlobally = false): void {
    if (disableGlobally) this.preferences.disableWelcomeDialogGlobally();
    this.dialogs.closeWelcomeDialog();
  }

  openGoogleLoginUnsupportedDialog(site: Site): void { this.dialogs.openGoogleLoginUnsupportedDialog(site); }
  closeGoogleLoginUnsupportedDialog(): void { this.dialogs.closeGoogleLoginUnsupportedDialog(); }

  openGrantPermissionDialog(site: Site): void { this.dialogs.openGrantPermissionDialog(site); }
  closeGrantPermissionDialog(disableGlobally = false): void {
    if (disableGlobally) this.preferences.disableGrantPermissionDialogGlobally();
    this.dialogs.closeGrantPermissionDialog();
  }

  openInstallExtensionDialog(site: Site): void { this.dialogs.openInstallExtensionDialog(site); }
  closeInstallExtensionDialog(disableGlobally = false): void {
    if (disableGlobally) this.preferences.disableInstallExtensionDialogGlobally();
    this.dialogs.closeInstallExtensionDialog();
  }

  openThirdPartyCookiesBlockedDialog(): void { this.dialogs.openThirdPartyCookiesBlockedDialog(); }
  closeThirdPartyCookiesBlockedDialog(disableGlobally = false): void {
    if (disableGlobally) this.preferences.disableCookiesBlockedDialogGlobally();
    this.dialogs.closeThirdPartyCookiesBlockedDialog();
  }
}

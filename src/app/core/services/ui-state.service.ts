import { Injectable, inject, Injector } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map, first } from 'rxjs';
import { Site } from '../models/site.model';
import { SiteDataService } from './site-data.service';
import { AnalyticsService } from './analytics.service';
import { ExtensionCommunicationService } from './extension-communication.service';

export interface InputDialogConfig {
  title: string;
  label: string;
  placeholder?: string;
  confirmButtonText: string;
  callback: (value: string) => void;
}

export type DataLoadingState = 'loading' | 'loaded' | 'error';
export type ActiveView = 'site' | 'advertise' | 'contact' | 'custom';

@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  private sanitizer = inject(DomSanitizer);
  private injector = inject(Injector);
  private analyticsService = inject(AnalyticsService);
  private extensionCommService = inject(ExtensionCommunicationService);
  private _siteDataService: SiteDataService | null = null;
  private focusedElementBeforeDialog: HTMLElement | null = null;

  private injectedCss: HTMLLinkElement | null = null;
  private injectedJs: HTMLScriptElement | null = null;

  // --- Dialog Queue Management ---
  private dialogQueue: (() => void)[] = [];
  private isDialogVisible = false;

  // --- Local Storage Keys ---
  private readonly sidebarCollapsedKey = 'sidebarCollapsed';
  private readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  private readonly collapsedCategoriesKey = 'collapsedCategories';
  private readonly viewedTutorialsKey = 'viewedChannelTutorials';
  private readonly neverShowLoginTutorialKey = 'neverShowLoginTutorial';
  private readonly neverShowWelcomeDialogKey = 'neverShowWelcomeDialog';

  // --- Data loading state ---
  dataLoadingState$ = new BehaviorSubject<DataLoadingState>('loading');

  // --- Active View State ---
  activeView$ = new BehaviorSubject<ActiveView>('site');

  customContent$ = new BehaviorSubject<string | null>(null);
  sanitizedCustomContent$: Observable<SafeHtml | null> = this.customContent$.pipe(
    map((html) => (html ? this.sanitizer.bypassSecurityTrustHtml(html) : null))
  );

  // --- Dialogs visibility state ---
  isAddSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isConfirmDeleteDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteToDelete$ = new BehaviorSubject<Site | null>(null);
  isInputDialogVisible$ = new BehaviorSubject<boolean>(false);
  inputDialogConfig$ = new BehaviorSubject<InputDialogConfig | null>(null);
  isLoginTutorialDialogVisible$ = new BehaviorSubject<boolean>(false);
  isWelcomeDialogVisible$ = new BehaviorSubject<boolean>(false);
  isGoogleLoginUnsupportedDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteForUnsupportedLoginDialog$ = new BehaviorSubject<Site | null>(null);

  // --- NEW: Grant Permission Dialog State ---
  isGrantPermissionDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteForGrantPermissionDialog$ = new BehaviorSubject<Site | null>(null);

  // --- Sidebar State ---
  isSidebarCollapsed$ = new BehaviorSubject<boolean>(
    this.loadFromStorage(this.sidebarCollapsedKey) ?? false
  );

  // --- Category Collapse State ---
  collapsedCategories$ = new BehaviorSubject<Record<string, boolean>>(
    this.loadFromStorage(this.collapsedCategoriesKey) ?? {}
  );

  // --- Core Selection State ---
  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);
  selectedSite$: Observable<Site | null> = this.selectedSiteSubject.asObservable();
  activeSiteName$: Observable<string | null> = this.selectedSite$.pipe(
    map((site) => site?.name ?? null)
  );
  sanitizedSelectedSiteUrl$: Observable<SafeResourceUrl | null> = this.selectedSite$.pipe(
    map((site) => (site ? this.sanitizer.bypassSecurityTrustResourceUrl(site.url) : null))
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

  // --- Dialog Queue Public Methods ---
  enqueueDialog(dialogFn: () => void): void {
    this.dialogQueue.push(dialogFn);
  }

  processNextDialogInQueue(): void {
    if (this.isDialogVisible || this.dialogQueue.length === 0) {
      return;
    }
    const nextDialogFn = this.dialogQueue.shift()!;
    nextDialogFn();
  }

  private cleanupInjectedResources(): void {
    if (this.injectedCss) {
      document.head.removeChild(this.injectedCss);
      this.injectedCss = null;
    }
    if (this.injectedJs) {
      document.body.removeChild(this.injectedJs);
      this.injectedJs = null;
    }
    this.customContent$.next(null);
  }

  async loadCustomContentFromSource(
    source: string,
    params: Record<string, string> = {}
  ): Promise<void> {
    this.cleanupInjectedResources();
    const baseUrl = `/ads/${source}/`;
    try {
      const htmlUrl = `${baseUrl}index.html`;
      const htmlResponse = await fetch(htmlUrl);
      if (!htmlResponse.ok) {
        throw new Error(`קובץ index.html לא נמצא בתיקייה '${source}'`);
      }
      const htmlContent = await htmlResponse.text();
      const cssUrl = `${baseUrl}style.css`;
      const cssCheck = await fetch(cssUrl, { method: 'HEAD' });
      if (cssCheck.ok) {
        this.injectedCss = document.createElement('link');
        this.injectedCss.rel = 'stylesheet';
        this.injectedCss.href = cssUrl;
        document.head.appendChild(this.injectedCss);
      }
      this.activeView$.next('custom');
      this.customContent$.next(htmlContent);
      const urlParams = new URLSearchParams({ view: 'custom', source, ...params });
      history.pushState(null, '', `${window.location.pathname}?${urlParams.toString()}`);
      this.analyticsService.trackPageView({
        page_title: `Custom Content: ${source}`,
        page_path: `/ads/${source}`,
        page_location: window.location.href,
      });
      const jsUrl = `${baseUrl}script.js`;
      const jsCheck = await fetch(jsUrl, { method: 'HEAD' });
      if (jsCheck.ok) {
        this.injectedJs = document.createElement('script');
        this.injectedJs.src = jsUrl;
        this.injectedJs.defer = true;
        document.body.appendChild(this.injectedJs);
      }
    } catch (error) {
      console.error('Error loading dynamic content:', error);
      const errorHtml = `<div style="padding:20px; color:red; text-align:right;"><h2>שגיאה בטעינת התוכן</h2><p>${
        (error as Error).message
      }</p></div>`;
      this.activeView$.next('custom');
      this.customContent$.next(errorHtml);
    }
  }

  async selectSite(site: Site | null, categoryName?: string): Promise<void> {
    this.cleanupInjectedResources();
    this.selectedSiteSubject.next(site);
    this.activeView$.next('site');

    if (site) {
      this.saveToStorage(this.lastViewedSiteUrlKey, site.url);
      const catName = categoryName || this.siteDataService.getCategoryForSite(site);

      if (catName) {
        const params = new URLSearchParams();
        params.set('name', site.name);
        params.set('url', site.url);
        params.set('category', catName);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState(null, '', newUrl);
      }

      this.analyticsService.trackPageView({
        page_title: site.name,
        page_path: `/sites/${catName || 'unknown'}/${site.name}`,
        page_location: site.url,
      });

      const isExtensionActive = this.extensionCommService.isExtensionActiveValue;

      if (isExtensionActive) {
        const domains = await this.extensionCommService.requestManagedDomains();
        const siteDomain = new URL(site.url).hostname;
        if (domains && domains.includes(siteDomain)) {
          if (!this.isLoginTutorialGloballyDisabled() && !this.hasViewedTutorial(site.url)) {
            this.enqueueDialog(() => this.openLoginTutorialDialog());
            this.markTutorialAsViewed(site.url);
          }
        } else if (!site.googleLoginSupported) {
          this.enqueueDialog(() => this.openGrantPermissionDialog(site));
        }
      } else if (!site.googleLoginSupported) {
        this.enqueueDialog(() => this.openGoogleLoginUnsupportedDialog(site));
      }
    } else {
      history.pushState(null, '', window.location.pathname);
    }

    if (!this.isDialogVisible) {
      this.processNextDialogInQueue();
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
    this.syncToExtension();
  }
  saveCollapsedCategories(state: Record<string, boolean>): void {
    this.collapsedCategories$.next(state);
    this.saveToStorage(this.collapsedCategoriesKey, state);
    this.syncToExtension();
  }

  private syncToExtension(): void {
    if (this.extensionCommService.isExtensionActiveValue) {
      const categories = this.siteDataService.categories$.getValue();
      const sidebarCollapsed = this.isSidebarCollapsed$.getValue();
      const collapsedCategories = this.collapsedCategories$.getValue();

      this.extensionCommService.updateSettingsInExtension({
        categories,
        sidebarCollapsed,
        collapsedCategories,
        lastModified: Date.now()
      });
    }
  }

  openAddSiteDialog(): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.isAddSiteDialogVisible$.next(true);
  }
  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible$.next(false);
    this.restoreFocus();
  }
  openConfirmDeleteDialog(site: Site): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.siteToDelete$.next(site);
    this.isConfirmDeleteDialogVisible$.next(true);
  }
  closeConfirmDeleteDialog(): void {
    this.isConfirmDeleteDialogVisible$.next(false);
    this.siteToDelete$.next(null);
    this.restoreFocus();
  }
  openInputDialog(config: InputDialogConfig): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.inputDialogConfig$.next(config);
    this.isInputDialogVisible$.next(true);
  }
  closeInputDialog(value: string | null): void {
    if (value) {
      this.inputDialogConfig$.pipe(first()).subscribe((config) => {
        config?.callback(value);
      });
    }
    this.isInputDialogVisible$.next(false);
    this.inputDialogConfig$.next(null);
    this.restoreFocus();
  }
  openLoginTutorialDialog(): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.isLoginTutorialDialogVisible$.next(true);
  }
  closeLoginTutorialDialog(disableGlobally = false): void {
    if (disableGlobally) {
      this.disableLoginTutorialGlobally();
    }
    this.isLoginTutorialDialogVisible$.next(false);
    this.restoreFocus();
  }

  isWelcomeDialogGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowWelcomeDialogKey) === true;
  }

  openWelcomeDialog(): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.isWelcomeDialogVisible$.next(true);
  }
  closeWelcomeDialog(disableGlobally = false): void {
    if (disableGlobally) {
      this.saveToStorage(this.neverShowWelcomeDialogKey, true);
    }
    this.isWelcomeDialogVisible$.next(false);
    this.restoreFocus();
  }
  openGoogleLoginUnsupportedDialog(site: Site): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.siteForUnsupportedLoginDialog$.next(site);
    this.isGoogleLoginUnsupportedDialogVisible$.next(true);
  }
  closeGoogleLoginUnsupportedDialog(): void {
    this.isGoogleLoginUnsupportedDialogVisible$.next(false);
    this.siteForUnsupportedLoginDialog$.next(null);
    this.restoreFocus();
  }

  // --- NEW: Grant Permission Dialog Methods ---
  openGrantPermissionDialog(site: Site): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.siteForGrantPermissionDialog$.next(site);
    this.isGrantPermissionDialogVisible$.next(true);
  }

  closeGrantPermissionDialog(): void {
    this.isGrantPermissionDialogVisible$.next(false);
    this.siteForGrantPermissionDialog$.next(null);
    this.restoreFocus();
  }

  private saveFocus(): void {
    this.focusedElementBeforeDialog = document.activeElement as HTMLElement;
  }
  private restoreFocus(): void {
    this.focusedElementBeforeDialog?.focus();
    this.focusedElementBeforeDialog = null;
    this.isDialogVisible = false; // A dialog is now closed
    setTimeout(() => this.processNextDialogInQueue(), 0); // Check for the next one
  }
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
  private hasViewedTutorial(url: string): boolean {
    const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? [];
    return viewedUrls.includes(url);
  }
  private markTutorialAsViewed(url: string): void {
    const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? [];
    if (!viewedUrls.includes(url)) {
      viewedUrls.push(url);
      this.saveToStorage(this.viewedTutorialsKey, viewedUrls);
    }
  }
  private isLoginTutorialGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowLoginTutorialKey) === true;
  }
  private disableLoginTutorialGlobally(): void {
    this.saveToStorage(this.neverShowLoginTutorialKey, true);
  }
}

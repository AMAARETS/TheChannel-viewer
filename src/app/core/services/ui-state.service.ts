import { Injectable, inject, Injector } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map, first } from 'rxjs';
import { Site } from '../models/site.model';
import { SiteDataService } from './site-data.service';
import { AnalyticsService } from './analytics.service';
import { ExtensionCommunicationService, AppSettings } from './extension-communication.service';

export interface InputDialogConfig {
  title: string;
  label: string;
  placeholder?: string;
  confirmButtonText: string;
  callback: (value: string) => void;
}

export type DataLoadingState = 'loading' | 'loaded' | 'error';
export type ActiveView = 'site' | 'custom';

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
  private dialogQueue: (() => void)[] = [];
  private isDialogVisible = false;

  private readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  private readonly viewedTutorialsKey = 'viewedChannelTutorials';
  private readonly neverShowLoginTutorialKey = 'neverShowLoginTutorial';
  private readonly neverShowWelcomeDialogKey = 'neverShowWelcomeDialog';

  dataLoadingState$ = new BehaviorSubject<DataLoadingState>('loading');
  activeView$ = new BehaviorSubject<ActiveView>('site');
  customContent$ = new BehaviorSubject<string | null>(null);
  sanitizedCustomContent$: Observable<SafeHtml | null> = this.customContent$.pipe(
    map((html) => (html ? this.sanitizer.bypassSecurityTrustHtml(html) : null))
  );

  isAddSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isConfirmDeleteDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteToDelete$ = new BehaviorSubject<Site | null>(null);
  isInputDialogVisible$ = new BehaviorSubject<boolean>(false);
  inputDialogConfig$ = new BehaviorSubject<InputDialogConfig | null>(null);
  isLoginTutorialDialogVisible$ = new BehaviorSubject<boolean>(false);
  isWelcomeDialogVisible$ = new BehaviorSubject<boolean>(false);
  isGoogleLoginUnsupportedDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteForUnsupportedLoginDialog$ = new BehaviorSubject<Site | null>(null);
  isGrantPermissionDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteForGrantPermissionDialog$ = new BehaviorSubject<Site | null>(null);

  isSidebarCollapsed$ = new BehaviorSubject<boolean>(false);
  collapsedCategories$ = new BehaviorSubject<Record<string, boolean>>({});

  private selectedSiteSubject = new BehaviorSubject<Site | null>(null);
  selectedSite$: Observable<Site | null> = this.selectedSiteSubject.asObservable();
  activeSiteName$: Observable<string | null> = this.selectedSite$.pipe(
    map((site) => site?.name ?? null)
  );
  sanitizedSelectedSiteUrl$: Observable<SafeResourceUrl | null> = this.selectedSite$.pipe(
    map((site) => (site ? this.sanitizer.bypassSecurityTrustResourceUrl(site.url) : null))
  );

  constructor() {
    const globalApi = (window as any).theChannel || {};
    globalApi.navigateTo = this.loadCustomContentFromSource.bind(this);
    (window as any).theChannel = globalApi;
  }

  private get siteDataService(): SiteDataService {
    if (!this._siteDataService) this._siteDataService = this.injector.get(SiteDataService);
    return this._siteDataService;
  }

  public loadInitialStateFromExtension(settings: AppSettings): void {
    if (typeof settings.sidebarCollapsed === 'boolean')
      this.isSidebarCollapsed$.next(settings.sidebarCollapsed);
    if (settings.collapsedCategories) this.collapsedCategories$.next(settings.collapsedCategories);
  }

  public getCurrentSettings(): AppSettings {
    return {
      categories: this.siteDataService.categories$.getValue(),
      sidebarCollapsed: this.isSidebarCollapsed$.getValue(),
      collapsedCategories: this.collapsedCategories$.getValue(),
    };
  }

  enqueueDialog(dialogFn: () => void): void {
    this.dialogQueue.push(dialogFn);
  }
  processNextDialogInQueue(): void {
    if (this.isDialogVisible || this.dialogQueue.length === 0) return;
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
    this.selectSite(null);
    const baseUrl = `/ads/${source}/`;
    try {
      const htmlResponse = await fetch(`${baseUrl}index.html`);
      if (!htmlResponse.ok) throw new Error(`קובץ index.html לא נמצא בתיקייה '${source}'`);
      const htmlContent = await htmlResponse.text();
      const cssCheck = await fetch(`${baseUrl}style.css`, { method: 'HEAD' });
      if (cssCheck.ok) {
        this.injectedCss = document.createElement('link');
        this.injectedCss.rel = 'stylesheet';
        this.injectedCss.href = `${baseUrl}style.css`;
        document.head.appendChild(this.injectedCss);
      }
      this.activeView$.next('custom');
      this.customContent$.next(htmlContent);
      history.pushState(
        null,
        '',
        `${window.location.pathname}?${new URLSearchParams({ view: 'custom', source, ...params })}`
      );

      // --- השורה הבאה הוסרה כי GA4 עוקב אחר שינוי זה באופן אוטומטי ---
      // this.analyticsService.trackPageView({ page_title: `Custom Content: ${source}`, page_path: `/ads/${source}`, page_location: window.location.href });

      const jsCheck = await fetch(`${baseUrl}script.js`, { method: 'HEAD' });
      if (jsCheck.ok) {
        this.injectedJs = document.createElement('script');
        this.injectedJs.src = `${baseUrl}script.js`;
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
    if (this.activeView$.value !== 'site' && site) this.cleanupInjectedResources();
    this.selectedSiteSubject.next(site);
    this.activeView$.next('site');

    if (site) {
      localStorage.setItem(this.lastViewedSiteUrlKey, site.url);
      const catName = categoryName || this.siteDataService.getCategoryForSite(site);
      if (catName) {
        const params = new URLSearchParams({ name: site.name, url: site.url, category: catName });
        history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
      }

      // --- השורה הבאה הוסרה כי GA4 עוקב אחר שינוי זה באופן אוטומטי ---
      // this.analyticsService.trackPageView({ page_title: site.name, page_path: `/sites/${catName || 'unknown'}/${site.name}`, page_location: site.url });

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
    if (!this.isDialogVisible) this.processNextDialogInQueue();
  }

  getActiveSite(): Site | null {
    return this.selectedSiteSubject.getValue();
  }
  getLastViewedSiteUrl(): string | null {
    return localStorage.getItem(this.lastViewedSiteUrlKey);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed$.next(!this.isSidebarCollapsed$.getValue());
  }
  saveCollapsedCategories(state: Record<string, boolean>): void {
    this.collapsedCategories$.next(state);
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
    if (value) this.inputDialogConfig$.pipe(first()).subscribe((config) => config?.callback(value));
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
    if (disableGlobally) this.disableLoginTutorialGlobally();
    this.isLoginTutorialDialogVisible$.next(false);
    this.restoreFocus();
  }
  isWelcomeDialogGloballyDisabled(): boolean {
    return localStorage.getItem(this.neverShowWelcomeDialogKey) === 'true';
  }
  openWelcomeDialog(): void {
    this.saveFocus();
    this.isDialogVisible = true;
    this.isWelcomeDialogVisible$.next(true);
  }
  closeWelcomeDialog(disableGlobally = false): void {
    if (disableGlobally) localStorage.setItem(this.neverShowWelcomeDialogKey, 'true');
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
    this.isDialogVisible = false;
    setTimeout(() => this.processNextDialogInQueue(), 0);
  }
  private hasViewedTutorial(url: string): boolean {
    const viewed = JSON.parse(localStorage.getItem(this.viewedTutorialsKey) || '[]');
    return viewed.includes(url);
  }
  private markTutorialAsViewed(url: string): void {
    const viewed = JSON.parse(localStorage.getItem(this.viewedTutorialsKey) || '[]');
    if (!viewed.includes(url)) {
      viewed.push(url);
      localStorage.setItem(this.viewedTutorialsKey, JSON.stringify(viewed));
    }
  }
  private isLoginTutorialGloballyDisabled(): boolean {
    return localStorage.getItem(this.neverShowLoginTutorialKey) === 'true';
  }
  private disableLoginTutorialGlobally(): void {
    localStorage.setItem(this.neverShowLoginTutorialKey, 'true');
  }
}

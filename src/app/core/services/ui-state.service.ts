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
export type ActiveView = 'site' | 'advertise' | 'contact' | 'help' | 'custom';

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

  private readonly sidebarCollapsedKey = 'sidebarCollapsed';
  private readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  private readonly collapsedCategoriesKey = 'collapsedCategories';
  private readonly viewedTutorialsKey = 'viewedChannelTutorials';
  private readonly neverShowLoginTutorialKey = 'neverShowLoginTutorial';
  private readonly neverShowWelcomeDialogKey = 'neverShowWelcomeDialog';
  private readonly neverShowGrantPermissionDialogKey = 'neverShowGrantPermissionDialog';
  private readonly neverShowInstallExtensionDialogKey = 'neverShowInstallExtensionDialog';
  private readonly neverShowCookiesBlockedDialogKey = 'neverShowCookiesBlockedDialog';

  dataLoadingState$ = new BehaviorSubject<DataLoadingState>('loading');
  activeView$ = new BehaviorSubject<ActiveView>('site');

  // *** חדש: ניהול הטאב הפעיל בדף העזרה ***
  helpSection$ = new BehaviorSubject<string>('extension');

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
  isInstallExtensionDialogVisible$ = new BehaviorSubject<boolean>(false);
  siteForInstallExtensionDialog$ = new BehaviorSubject<Site | null>(null);

  isThirdPartyCookiesBlockedDialogVisible$ = new BehaviorSubject<boolean>(false);

  isSidebarCollapsed$ = new BehaviorSubject<boolean>(
    this.loadFromStorage(this.sidebarCollapsedKey) ?? false
  );
  collapsedCategories$ = new BehaviorSubject<Record<string, boolean>>(
    this.loadFromStorage(this.collapsedCategoriesKey) ?? {}
  );

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

  checkAndAlertIfThirdPartyCookiesBlocked(): void {
    if (this.isCookiesBlockedDialogGloballyDisabled()) {
      return;
    }

    const areCookiesEnabled = this.checkCookieSupport();

    if (!areCookiesEnabled) {
      this.enqueueDialog(() => this.openThirdPartyCookiesBlockedDialog());
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
    } catch (e) {
      return false;
    }
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

  // *** חדש: פתיחת דף העזרה הפנימי ***
  openHelpPage(section: string = 'extension', skipHistoryUpdate = false): void {
    this.cleanupInjectedResources();
    this.activeView$.next('help');
    this.helpSection$.next(section);
    this.selectedSiteSubject.next(null);

    if (!skipHistoryUpdate) {
      const params = this.preserveUnknownParams({ view: 'help', section });
      history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    }

    this.analyticsService.trackPageView({
      page_title: `Help: ${section}`,
      page_path: `/help/${section}`,
      page_location: window.location.href,
    });
  }

  // *** חדש: עדכון ה-URL בעת ניווט פנימי בדף העזרה ***
  updateHelpUrl(section: string): void {
    const params = this.preserveUnknownParams({ view: 'help', section });
    history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  /**
   * שומר פרמטרים לא מוכרים (כמו UTM) ומוסיף/מעדכן את הפרמטרים החדשים
   */
  private preserveUnknownParams(newParams: Record<string, string>): URLSearchParams {
    const knownParams = ['name', 'url', 'category', 'view', 'section', 'source'];
    const currentParams = new URLSearchParams(window.location.search);
    const resultParams = new URLSearchParams();

    // שמירת כל הפרמטרים שאינם מוכרים (כמו utm_source, utm_medium וכו')
    currentParams.forEach((value, key) => {
      if (!knownParams.includes(key)) {
        resultParams.set(key, value);
      }
    });

    // הוספת/עדכון הפרמטרים החדשים
    Object.entries(newParams).forEach(([key, value]) => {
      resultParams.set(key, value);
    });

    return resultParams;
  }

  async loadCustomContentFromSource(
    source: string,
    params: Record<string, string> = {},
    skipHistoryUpdate = false
  ): Promise<void> {

    // *** חדש: טיפול במקרה של דף עזרה ***
    if (source === 'help') {
        const section = params['section'] || 'extension';
        this.openHelpPage(section, skipHistoryUpdate);
        return;
    }

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

      // עדכון ה-ActiveView בהתאם למקור
      if (source === 'advertise') this.activeView$.next('advertise');
      else if (source === 'contact') this.activeView$.next('contact');
      else this.activeView$.next('custom');

      this.customContent$.next(htmlContent);
      this.selectedSiteSubject.next(null); // ניקוי האתר הנבחר

      if (!skipHistoryUpdate) {
        // אם זה contact או advertise, אפשר לשמור על ה-view הנקי יותר:
        if (source === 'contact' || source === 'advertise') {
             const urlParams = this.preserveUnknownParams({ view: source });
             history.pushState(null, '', `${window.location.pathname}?${urlParams.toString()}`);
        } else {
             const urlParams = this.preserveUnknownParams({ view: source, ...params });
             history.pushState(null, '', `${window.location.pathname}?${urlParams.toString()}`);
        }
      }
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

  async selectSite(site: Site | null, categoryName?: string, skipHistoryUpdate = false): Promise<void> {
    this.cleanupInjectedResources();
    this.selectedSiteSubject.next(site);
    this.activeView$.next('site');

    if (site) {
      this.saveToStorage(this.lastViewedSiteUrlKey, site.url);
      const catName = categoryName || this.siteDataService.getCategoryForSite(site);
      if (catName && !skipHistoryUpdate) {
        const params = this.preserveUnknownParams({ name: site.name, url: site.url, category: catName });
        history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
      this.analyticsService.trackPageView({
        page_title: site.name,
        page_path: `/sites/${catName || 'unknown'}/${site.name}`,
        page_location: site.url,
      });

      if (site.googleLoginSupported) {
        if (!this.isLoginTutorialGloballyDisabled() && !this.hasViewedTutorial(site.url)) {
          this.enqueueDialog(() => this.openLoginTutorialDialog());
          this.markTutorialAsViewed(site.url);
        }
      } else {
        const isExtensionActive = this.extensionCommService.isExtensionActiveValue;

        if (!isExtensionActive) {
          if (!this.isInstallExtensionDialogGloballyDisabled()) {
            this.enqueueDialog(() => this.openInstallExtensionDialog(site));
          }
        } else {
          // התוסף פעיל
          const domains = await this.extensionCommService.requestManagedDomains();
          const siteDomain = new URL(site.url).hostname;

          if (domains && domains.includes(siteDomain)) {
             // הדומיין מאושר
             if (!this.isLoginTutorialGloballyDisabled() && !this.hasViewedTutorial(site.url)) {
                this.enqueueDialog(() => this.openLoginTutorialDialog());
                this.markTutorialAsViewed(site.url);
            }
          } else {
            // *** השינוי המיוחד מהקוד ששלחת: בקשת הרשאה ***
            this.extensionCommService.requestPermissionForDomain(siteDomain, site.name);
          }
        }
      }
    } else {
      history.pushState(null, '', window.location.pathname);
    }

    if (!this.isDialogVisible) {
      this.processNextDialogInQueue();
    }
  }

  getActiveSite(): Site | null { return this.selectedSiteSubject.getValue(); }
  getLastViewedSiteUrl(): string | null { return this.loadFromStorage(this.lastViewedSiteUrlKey); }

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
        categories, sidebarCollapsed, collapsedCategories, lastModified: Date.now()
      });
    }
  }

  // --- ניהול דיאלוגים ---
  openAddSiteDialog(): void { this.saveFocus(); this.isDialogVisible = true; this.isAddSiteDialogVisible$.next(true); }
  closeAddSiteDialog(): void { this.isAddSiteDialogVisible$.next(false); this.restoreFocus(); }

  openConfirmDeleteDialog(site: Site): void { this.saveFocus(); this.isDialogVisible = true; this.siteToDelete$.next(site); this.isConfirmDeleteDialogVisible$.next(true); }
  closeConfirmDeleteDialog(): void { this.isConfirmDeleteDialogVisible$.next(false); this.siteToDelete$.next(null); this.restoreFocus(); }

  openInputDialog(config: InputDialogConfig): void { this.saveFocus(); this.isDialogVisible = true; this.inputDialogConfig$.next(config); this.isInputDialogVisible$.next(true); }
  closeInputDialog(value: string | null): void {
    if (value) { this.inputDialogConfig$.pipe(first()).subscribe((config) => config?.callback(value)); }
    this.isInputDialogVisible$.next(false); this.inputDialogConfig$.next(null); this.restoreFocus();
  }

  openLoginTutorialDialog(): void { this.saveFocus(); this.isDialogVisible = true; this.isLoginTutorialDialogVisible$.next(true); }
  closeLoginTutorialDialog(disableGlobally = false): void {
    if (disableGlobally) { this.disableLoginTutorialGlobally(); }
    this.isLoginTutorialDialogVisible$.next(false); this.restoreFocus();
  }

  isWelcomeDialogGloballyDisabled(): boolean { return this.loadFromStorage<boolean>(this.neverShowWelcomeDialogKey) === true; }
  openWelcomeDialog(): void { this.saveFocus(); this.isDialogVisible = true; this.isWelcomeDialogVisible$.next(true); }
  closeWelcomeDialog(disableGlobally = false): void {
    if (disableGlobally) { this.saveToStorage(this.neverShowWelcomeDialogKey, true); }
    this.isWelcomeDialogVisible$.next(false); this.restoreFocus();
  }

  openGoogleLoginUnsupportedDialog(site: Site): void { this.saveFocus(); this.isDialogVisible = true; this.siteForUnsupportedLoginDialog$.next(site); this.isGoogleLoginUnsupportedDialogVisible$.next(true); }
  closeGoogleLoginUnsupportedDialog(): void { this.isGoogleLoginUnsupportedDialogVisible$.next(false); this.siteForUnsupportedLoginDialog$.next(null); this.restoreFocus(); }

  openGrantPermissionDialog(site: Site): void { this.saveFocus(); this.isDialogVisible = true; this.siteForGrantPermissionDialog$.next(site); this.isGrantPermissionDialogVisible$.next(true); }
  closeGrantPermissionDialog(disableGlobally = false): void {
    if (disableGlobally) { this.disableGrantPermissionDialogGlobally(); }
    this.isGrantPermissionDialogVisible$.next(false); this.siteForGrantPermissionDialog$.next(null); this.restoreFocus();
  }

  openInstallExtensionDialog(site: Site): void { this.saveFocus(); this.isDialogVisible = true; this.siteForInstallExtensionDialog$.next(site); this.isInstallExtensionDialogVisible$.next(true); }
  closeInstallExtensionDialog(disableGlobally = false): void {
    if (disableGlobally) { this.disableInstallExtensionDialogGlobally(); }
    this.isInstallExtensionDialogVisible$.next(false); this.siteForInstallExtensionDialog$.next(null); this.restoreFocus();
  }

  openThirdPartyCookiesBlockedDialog(): void { this.saveFocus(); this.isDialogVisible = true; this.isThirdPartyCookiesBlockedDialogVisible$.next(true); }
  closeThirdPartyCookiesBlockedDialog(disableGlobally = false): void {
    if (disableGlobally) { this.disableCookiesBlockedDialogGlobally(); }
    this.isThirdPartyCookiesBlockedDialogVisible$.next(false); this.restoreFocus();
  }

  private saveFocus(): void { this.focusedElementBeforeDialog = document.activeElement as HTMLElement; }
  private restoreFocus(): void {
    this.focusedElementBeforeDialog?.focus();
    this.focusedElementBeforeDialog = null;
    this.isDialogVisible = false;
    setTimeout(() => this.processNextDialogInQueue(), 0);
  }

  private saveToStorage<T>(key: string, value: T): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Error saving to localStorage', e); } }
  private loadFromStorage<T>(key: string): T | null { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : null; } catch (e) { console.error('Error reading from localStorage', e); return null; } }

  private hasViewedTutorial(url: string): boolean { const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? []; return viewedUrls.includes(url); }
  private markTutorialAsViewed(url: string): void {
    const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? [];
    if (!viewedUrls.includes(url)) {
      viewedUrls.push(url);
      this.saveToStorage(this.viewedTutorialsKey, viewedUrls);
    }
  }

  private isLoginTutorialGloballyDisabled(): boolean { return this.loadFromStorage<boolean>(this.neverShowLoginTutorialKey) === true; }
  private disableLoginTutorialGlobally(): void { this.saveToStorage(this.neverShowLoginTutorialKey, true); }

  private isGrantPermissionDialogGloballyDisabled(): boolean { return this.loadFromStorage<boolean>(this.neverShowGrantPermissionDialogKey) === true; }
  private disableGrantPermissionDialogGlobally(): void { this.saveToStorage(this.neverShowGrantPermissionDialogKey, true); }

  private isInstallExtensionDialogGloballyDisabled(): boolean { return this.loadFromStorage<boolean>(this.neverShowInstallExtensionDialogKey) === true; }
  private disableInstallExtensionDialogGlobally(): void { this.saveToStorage(this.neverShowInstallExtensionDialogKey, true); }

  private isCookiesBlockedDialogGloballyDisabled(): boolean { return this.loadFromStorage<boolean>(this.neverShowCookiesBlockedDialogKey) === true; }
  private disableCookiesBlockedDialogGlobally(): void { this.saveToStorage(this.neverShowCookiesBlockedDialogKey, true); }
}

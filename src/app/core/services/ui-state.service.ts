import { Injectable, inject, Injector } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map, first } from 'rxjs';
import { Site } from '../models/site.model';
import { SiteDataService } from './site-data.service';
import { AnalyticsService } from './analytics.service'; // הוספת יבוא

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
  private analyticsService = inject(AnalyticsService); // הזרקת השירות
  private _siteDataService: SiteDataService | null = null;
  private focusedElementBeforeDialog: HTMLElement | null = null;

  // --- ניהול משאבים דינאמיים ---
  private injectedCss: HTMLLinkElement | null = null;
  private injectedJs: HTMLScriptElement | null = null;

  // --- Local Storage Keys ---
  private readonly sidebarCollapsedKey = 'sidebarCollapsed';
  private readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  private readonly collapsedCategoriesKey = 'collapsedCategories';
  private readonly viewedTutorialsKey = 'viewedChannelTutorials';
  private readonly neverShowLoginTutorialKey = 'neverShowLoginTutorial';

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
    // חשיפת ה-API הגלובלי לניווט חיצוני
    const globalApi = (window as any).theChannel || {};
    globalApi.navigateTo = this.loadCustomContentFromSource.bind(this);
    (window as any).theChannel = globalApi;
  }

  private get siteDataService(): SiteDataService {
    if (!this._siteDataService) {
      this._siteDataService = this.injector.get(SiteDataService);
    }
    return this._siteDataService;
  }

  /**
   * מנקה את כל המשאבים הדינאמיים (CSS, JS) שהוזרקו לדף.
   * יש לקרוא לפונקציה זו לפני כל ניווט למצב תצוגה חדש.
   */
  private cleanupInjectedResources(): void {
    if (this.injectedCss) {
      document.head.removeChild(this.injectedCss);
      this.injectedCss = null;
    }
    if (this.injectedJs) {
      document.body.removeChild(this.injectedJs);
      this.injectedJs = null;
    }
    this.customContent$.next(null); // נקה גם את התוכן
  }

  /**
   * הפונקציה המרכזית לטעינת תוכן דינאמי מתיקייה בשרת.
   * @param source - שם התיקייה תחת /ads/
   * @param params - אובייקט של פרמטרים להוספה ל-URL
   */
  async loadCustomContentFromSource(
    source: string,
    params: Record<string, string> = {}
  ): Promise<void> {
    this.cleanupInjectedResources();

    // הנתיב הבסיסי לתיקיית התוכן. הנתיב הוא אבסולוטי מתיקיית השורש של הדומיין.
    const baseUrl = `/ads/${source}/`;

    try {
      // 1. טען את ה-HTML הראשי (חובה)
      const htmlUrl = `${baseUrl}index.html`;
      const htmlResponse = await fetch(htmlUrl);
      if (!htmlResponse.ok) {
        throw new Error(`קובץ index.html לא נמצא בתיקייה '${source}'`);
      }
      const htmlContent = await htmlResponse.text();

      // 2. בדוק וטען CSS אם קיים
      const cssUrl = `${baseUrl}style.css`;
      const cssCheck = await fetch(cssUrl, { method: 'HEAD' });
      if (cssCheck.ok) {
        this.injectedCss = document.createElement('link');
        this.injectedCss.rel = 'stylesheet';
        this.injectedCss.href = cssUrl;
        document.head.appendChild(this.injectedCss);
      }

      // 3. עדכן את מצב האפליקציה וה-URL
      this.activeView$.next('custom');
      this.customContent$.next(htmlContent);

      const urlParams = new URLSearchParams({
        view: 'custom',
        source,
        ...params,
      });
      history.pushState(null, '', `${window.location.pathname}?${urlParams.toString()}`);

      // >> הוספת מעקב
      this.analyticsService.trackPageView({
        page_title: `Custom Content: ${source}`,
        page_path: `/ads/${source}`,
        page_location: window.location.href,
      });

      // 4. בדוק וטען JS אם קיים (אחרי שה-HTML כבר ב-DOM)
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

  selectSite(site: Site | null, categoryName?: string): void {
    this.cleanupInjectedResources(); // נקה משאבים קודמים
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

      // >> הוספת מעקב
      this.analyticsService.trackPageView({
        page_title: site.name,
        page_path: `/sites/${catName || 'unknown'}/${site.name}`,
        page_location: site.url, // במקרה זה, ה-URL החיצוני הוא המיקום
      });

      if (this.isLoginTutorialGloballyDisabled()) return;
      if (!this.hasViewedTutorial(site.url)) {
        this.openLoginTutorialDialog();
        this.markTutorialAsViewed(site.url);
      }
    } else {
      history.pushState(null, '', window.location.pathname);
    }
  }

  showAdvertisePage(): void {
    this.cleanupInjectedResources();
    this.selectedSiteSubject.next(null);
    this.activeView$.next('advertise');
    const params = new URLSearchParams();
    params.set('view', 'advertise');
    history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);

    // >> הוספת מעקב
    this.analyticsService.trackPageView({
      page_title: 'Advertise Page',
      page_path: '/advertise',
      page_location: window.location.href,
    });
  }

  showContactPage(): void {
    this.cleanupInjectedResources();
    this.selectedSiteSubject.next(null);
    this.activeView$.next('contact');
    const params = new URLSearchParams();
    params.set('view', 'contact');
    history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);

    // >> הוספת מעקב
    this.analyticsService.trackPageView({
      page_title: 'Contact Page',
      page_path: '/contact',
      page_location: window.location.href,
    });
  }

  // --- שאר הפונקציות נשארות ללא שינוי ---

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
  openAddSiteDialog(): void {
    this.saveFocus();
    this.isAddSiteDialogVisible$.next(true);
  }
  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible$.next(false);
    this.restoreFocus();
  }
  openConfirmDeleteDialog(site: Site): void {
    this.saveFocus();
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
    this.isLoginTutorialDialogVisible$.next(true);
  }
  closeLoginTutorialDialog(disableGlobally = false): void {
    if (disableGlobally) {
      this.disableLoginTutorialGlobally();
    }
    this.isLoginTutorialDialogVisible$.next(false);
    this.restoreFocus();
  }
  private saveFocus(): void {
    this.focusedElementBeforeDialog = document.activeElement as HTMLElement;
  }
  private restoreFocus(): void {
    this.focusedElementBeforeDialog?.focus();
    this.focusedElementBeforeDialog = null;
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

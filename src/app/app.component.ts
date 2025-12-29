import { Component, OnInit, AfterViewInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { first } from 'rxjs';

// Import components
import { SidebarComponent } from './components/sidebar/sidebar';
import { MainContentComponent } from './components/main-content/main-content';
import { AddSiteDialogComponent } from './components/add-site-dialog/add-site-dialog';
import { EditSiteDialogComponent } from './components/edit-site-dialog/edit-site-dialog';
import { ConfirmDeleteDialogComponent } from './components/confirm-delete-dialog/confirm-delete-dialog';
import { InputDialogComponent } from './components/input-dialog/input-dialog';
import { LoginTutorialDialogComponent } from './components/login-tutorial-dialog/login-tutorial-dialog';
import { ToastComponent } from './components/toast/toast.component';
import { WelcomeDialogComponent } from './components/welcome-dialog/welcome-dialog';
import { GoogleLoginUnsupportedDialogComponent } from './components/google-login-unsupported-dialog/google-login-unsupported-dialog';
import { GrantPermissionDialogComponent } from './components/grant-permission-dialog/grant-permission-dialog';
import { InstallExtensionDialogComponent } from './components/install-extension-dialog/install-extension-dialog.component';
import { ThirdPartyCookiesBlockedDialogComponent } from './components/third-party-cookies-blocked-dialog/third-party-cookies-blocked-dialog';

// Import services
import { SiteDataService } from './core/services/site-data.service';
import { UiStateService } from './core/services/ui-state.service';
import { Site, Category } from './core/models/site.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    MainContentComponent,
    AddSiteDialogComponent,
    EditSiteDialogComponent,
    ConfirmDeleteDialogComponent,
    InputDialogComponent,
    LoginTutorialDialogComponent,
    ToastComponent,
    WelcomeDialogComponent,
    GoogleLoginUnsupportedDialogComponent,
    GrantPermissionDialogComponent,
    InstallExtensionDialogComponent,
    ThirdPartyCookiesBlockedDialogComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, AfterViewInit {
  private siteDataService = inject(SiteDataService);
  private uiStateService = inject(UiStateService);

  ngOnInit(): void {
    this.uiStateService.checkAndAlertIfThirdPartyCookiesBlocked();

    this.siteDataService.categories$.pipe(
      first(categories => categories.length > 0)
    ).subscribe(categories => {
      this.initializeApp(categories);
    });

    window.addEventListener('popstate', () => {
      this.handleUrlParametersOnLoad(true);
    });
  }

  private initializeApp(categories: Category[]): void {
    const specialViewLoaded = this.handleUrlParametersOnLoad();

    if (!this.uiStateService.isWelcomeDialogGloballyDisabled()) {
      this.uiStateService.enqueueDialog(() => this.uiStateService.openWelcomeDialog());
    }

    if (!specialViewLoaded) {
      this.selectInitialSite(categories);
    }

    this.uiStateService.processNextDialogInQueue();
  }

  private handleUrlParametersOnLoad(skipHistoryUpdate = false): boolean {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const source = params.get('source');

    // טיפול בדף העזרה החדש
    if (view === 'help') {
      const section = params.get('section') || 'extension';
      this.uiStateService.openHelpPage(section, skipHistoryUpdate);
      return true;
    }

    if (view === 'advertise') {
      this.uiStateService.loadCustomContentFromSource('advertise', {}, skipHistoryUpdate);
      return true;
    }

    if (view === 'contact') {
      this.uiStateService.loadCustomContentFromSource('contact', {}, skipHistoryUpdate);
      return true;
    }

    if (view === 'custom' && source) {
      const paramsObject = Object.fromEntries(params.entries());
      this.uiStateService.loadCustomContentFromSource(source, paramsObject, skipHistoryUpdate);
      return true;
    }

    const siteFromUrl = this.tryGetSiteFromUrl();
    if (siteFromUrl) {
      const categories = this.siteDataService.categories$.getValue();
      const allSites = categories.flatMap(c => c.sites);
      const existingSite = allSites.find(s => s.url === siteFromUrl.url);

      if (existingSite) {
        this.uiStateService.selectSite(existingSite, siteFromUrl.category, skipHistoryUpdate);
        return true;
      }
    }

    return false;
  }

  private selectInitialSite(categories: Category[]): void {
    const siteFromUrl = this.tryGetSiteFromUrl();
    const allSites = categories.flatMap(c => c.sites);

    if (siteFromUrl) {
      const existingSite = allSites.find(s => s.url === siteFromUrl.url);

      if (!existingSite) {
        this.siteDataService.addSite({ name: siteFromUrl.name, url: siteFromUrl.url, googleLoginSupported: false }, siteFromUrl.category);
      }
      this.uiStateService.selectSite(existingSite || siteFromUrl, siteFromUrl.category);

    } else {
      // כניסה אוטומטית לערוץ האחרון - מבוטל זמנית
      // המשתמש יישאר במסך בחירת ערוץ במקום להיכנס אוטומטית לערוץ האחרון
      /*
      const lastViewedUrl = this.uiStateService.getLastViewedSiteUrl();
      if (lastViewedUrl) {
        const lastSite = allSites.find(s => s.url === lastViewedUrl);
        if (lastSite) {
          this.uiStateService.selectSite(lastSite);
        }
      }
      */
    }
  }

  private tryGetSiteFromUrl(): (Site & { category: string }) | null {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const url = params.get('url');
    const category = params.get('category');

    if (name && url && category) {
      try {
        new URL(url);
        return { name, url, category, googleLoginSupported: false };
      } catch {
        return null;
      }
    }
    return null;
  }

  ngAfterViewInit(): void {
    this.loadAdScript();
  }

  private loadAdScript(): void {
    const scriptSrc = 'https://cdn.jsdelivr.net/gh/AMAARETS/ads@09ead83/share.js?v=' + new Date().getTime();
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }
}

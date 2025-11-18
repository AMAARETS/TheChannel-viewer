import { Component, OnInit, AfterViewInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { first } from 'rxjs';

// Import components
import { SidebarComponent } from './components/sidebar/sidebar';
import { MainContentComponent } from './components/main-content/main-content';
import { AddSiteDialogComponent } from './components/add-site-dialog/add-site-dialog';
import { ConfirmDeleteDialogComponent } from './components/confirm-delete-dialog/confirm-delete-dialog';
import { InputDialogComponent } from './components/input-dialog/input-dialog';
import { LoginTutorialDialogComponent } from './components/login-tutorial-dialog/login-tutorial-dialog';
import { ToastComponent } from './components/toast/toast.component';
import { WelcomeDialogComponent } from './components/welcome-dialog/welcome-dialog';
import { GoogleLoginUnsupportedDialogComponent } from './components/google-login-unsupported-dialog/google-login-unsupported-dialog';
import { GrantPermissionDialogComponent } from './components/grant-permission-dialog/grant-permission-dialog';

// Import services
import { SiteDataService } from './core/services/site-data.service';
import { UiStateService } from './core/services/ui-state.service';
import { Site, Category } from './core/models/site.model'; // Import Category

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    MainContentComponent,
    AddSiteDialogComponent,
    ConfirmDeleteDialogComponent,
    InputDialogComponent,
    LoginTutorialDialogComponent,
    ToastComponent,
    WelcomeDialogComponent,
    GoogleLoginUnsupportedDialogComponent,
    GrantPermissionDialogComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, AfterViewInit {
  private siteDataService = inject(SiteDataService);
  private uiStateService = inject(UiStateService);

  ngOnInit(): void {
    // We wait until the essential category data is loaded for the first time.
    // The `first()` operator ensures this subscription runs only once.
    this.siteDataService.categories$.pipe(
      first(categories => categories.length > 0)
    ).subscribe(categories => {
      this.initializeApp(categories);
    });
  }

  /**
   * Runs only once after initial data is loaded.
   * Orchestrates the entire startup logic, including dialogs and site selection.
   * FIX: Changed parameter type from Site[] to Category[]
   */
  private initializeApp(categories: Category[]): void {
    // Step 1: Handle any special view requests from URL params (like 'advertise' or 'contact').
    // If such a view is loaded, we don't need to select a default site.
    const specialViewLoaded = this.handleUrlParametersOnLoad();

    // Step 2: Enqueue the welcome dialog if it hasn't been permanently dismissed.
    // This is always the first dialog to be considered.
    if (!this.uiStateService.isWelcomeDialogGloballyDisabled()) {
      this.uiStateService.enqueueDialog(() => this.uiStateService.openWelcomeDialog());
    }

    // Step 3: If no special view was loaded, proceed with selecting a channel.
    if (!specialViewLoaded) {
      this.selectInitialSite(categories);
    }

    // Step 4: After all startup logic has run and all necessary dialogs are enqueued,
    // start processing the dialog queue.
    this.uiStateService.processNextDialogInQueue();
  }

  /**
   * Checks for URL parameters like ?view=contact and loads the appropriate content.
   * @returns `true` if a special view was handled, `false` otherwise.
   */
  private handleUrlParametersOnLoad(): boolean {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const source = params.get('source');

    if (view === 'advertise') {
      this.uiStateService.loadCustomContentFromSource('advertise');
      return true;
    }

    if (view === 'contact') {
      this.uiStateService.loadCustomContentFromSource('contact');
      return true;
    }

    if (view === 'custom' && source) {
      const paramsObject = Object.fromEntries(params.entries());
      this.uiStateService.loadCustomContentFromSource(source, paramsObject);
      return true;
    }

    return false;
  }

  /**
   * Determines which site to select on load (from URL or local storage)
   * and calls the selection service, which will in turn enqueue relevant dialogs.
   * FIX: Changed parameter type from any[] to Category[]
   */
  private selectInitialSite(categories: Category[]): void {
    const siteFromUrl = this.tryGetSiteFromUrl();
    const allSites = categories.flatMap(c => c.sites);

    if (siteFromUrl) {
      const existingSite = allSites.find(s => s.url === siteFromUrl.url);

      if (!existingSite) {
        this.siteDataService.addSite({ name: siteFromUrl.name, url: siteFromUrl.url, googleLoginSupported: false }, siteFromUrl.category);
      }
      // Select the site. This action will enqueue the 'unsupported login' or 'tutorial' dialog if needed.
      this.uiStateService.selectSite(existingSite || siteFromUrl, siteFromUrl.category);

    } else {
      const lastViewedUrl = this.uiStateService.getLastViewedSiteUrl();
      if (lastViewedUrl) {
        const lastSite = allSites.find(s => s.url === lastViewedUrl);
        if (lastSite) {
          this.uiStateService.selectSite(lastSite);
        }
      }
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
    const scriptSrc = 'https://cdn.jsdelivr.net/gh/AMAARETS/ads@d558adf/ads.ads.js?v=' + new Date().getTime();
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    //document.body.appendChild(script);
  }
}

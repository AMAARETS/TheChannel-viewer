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

// Import services
import { SiteDataService } from './core/services/site-data.service';
import { UiStateService } from './core/services/ui-state.service';
import { Site } from './core/models/site.model';

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
    ToastComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, AfterViewInit {
  private siteDataService = inject(SiteDataService);
  private uiStateService = inject(UiStateService);

  ngOnInit(): void {
    // נמתין שהמידע הראשוני ייטען
    this.siteDataService.categories$.pipe(
      first(categories => categories.length > 0)
    ).subscribe(categories => {
      // קודם נבדוק אם יש ערוץ ב-URL
      const siteFromUrl = this.tryGetSiteFromUrl();
      if (siteFromUrl) {
        const allSites = categories.flatMap(c => c.sites);
        const siteExists = allSites.some(s => s.url === siteFromUrl.url);

        if (!siteExists) {
          this.siteDataService.addSite({ name: siteFromUrl.name, url: siteFromUrl.url }, siteFromUrl.category);
        }

        // בחירת הערוץ מה-URL, עם שם הקטגוריה
        this.uiStateService.selectSite({name: siteFromUrl.name, url: siteFromUrl.url}, siteFromUrl.category);

      } else {
        // אם אין ערוץ ב-URL, נטען את האחרון שנצפה
        const lastViewedUrl = this.uiStateService.getLastViewedSiteUrl();
        if (lastViewedUrl) {
          const allSites = categories.flatMap(c => c.sites);
          const lastSite = allSites.find(s => s.url === lastViewedUrl);
          if (lastSite) {
            this.uiStateService.selectSite(lastSite);
          }
        }
      }
    });
  }

  private tryGetSiteFromUrl(): (Site & { category: string }) | null {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const url = params.get('url');
    const category = params.get('category');

    if (name && url && category) {
      // בדיקה בסיסית שה-URL תקין
      try {
        new URL(url);
        return { name, url, category };
      } catch (e) {
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
    document.body.appendChild(script);
  }
}

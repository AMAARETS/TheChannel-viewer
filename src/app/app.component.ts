import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { first } from 'rxjs';

// Import components
import { SidebarComponent } from './components/sidebar/sidebar';
import { MainContentComponent } from './components/main-content/main-content';
import { AddSiteDialogComponent } from './components/add-site-dialog/add-site-dialog';
import { ConfirmDeleteDialogComponent } from './components/confirm-delete-dialog/confirm-delete-dialog';
import { InputDialogComponent } from './components/input-dialog/input-dialog';
import { LoginTutorialDialogComponent } from './components/login-tutorial-dialog/login-tutorial-dialog'; // <-- ייבוא חדש

// Import services
import { SiteDataService } from './core/services/site-data.service';
import { UiStateService } from './core/services/ui-state.service';

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
    LoginTutorialDialogComponent // <-- הוספה למערך הייבוא
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  private siteDataService = inject(SiteDataService);
  private uiStateService = inject(UiStateService);

  ngOnInit(): void {
    const lastViewedUrl = this.uiStateService.getLastViewedSiteUrl();
    if (lastViewedUrl) {
      this.siteDataService.categories$.pipe(
        first(categories => categories.length > 0)
      ).subscribe(categories => {
        const allSites = categories.flatMap(c => c.sites);
        const lastSite = allSites.find(s => s.url === lastViewedUrl);
        if (lastSite) {
          this.uiStateService.selectSite(lastSite);
        }
      });
    }
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

import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Import the new components
import { SidebarComponent } from './components/sidebar/sidebar';
import { MainContentComponent } from './components/main-content/main-content';
import { AddSiteDialogComponent } from './components/add-site-dialog/add-site-dialog';
import { ConfirmDeleteDialogComponent } from './components/confirm-delete-dialog/confirm-delete-dialog';

// Import services to ensure they are initialized
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
    ConfirmDeleteDialogComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  // Inject services to ensure they are created and data is loaded.
  private siteDataService = inject(SiteDataService);
  private uiStateService = inject(UiStateService);

  ngOnInit(): void {
    // Select the initial site once data is loaded
    this.siteDataService.categories$.subscribe(categories => {
      // Check if a site is already selected to avoid overwriting user selection
      this.uiStateService.selectedSite$.subscribe(selectedSite => {
        if (!selectedSite && categories.length > 0) {
          const firstSite = categories.flatMap(c => c.sites)[0];
          if (firstSite) {
            this.uiStateService.selectSite(firstSite);
          }
        }
      });
    });
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

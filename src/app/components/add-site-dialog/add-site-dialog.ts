import { Component, inject } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { AvailableSite, Site } from '../../core/models/site.model';
import { map } from 'rxjs';

@Component({
  selector: 'app-add-site-dialog',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './add-site-dialog.html',
  styleUrl: './add-site-dialog.css'
})
export class AddSiteDialogComponent {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);

  isVisible$ = this.uiStateService.isAddSiteDialogVisible$;
  categories$ = this.siteDataService.categories$;

  // Filter available sites to show only those not already in the user's list
  filteredAvailableSites$ = this.siteDataService.availableSites$.pipe(
    map(available => {
      const existingUrls = new Set(this.siteDataService.categories$.getValue().flatMap(c => c.sites.map(s => s.url)));
      return available.filter(site => !existingUrls.has(site.url));
    })
  );

  closeDialog() {
    this.uiStateService.closeAddSiteDialog();
  }

  addSite(nameInput: HTMLInputElement, urlInput: HTMLInputElement, categoryInput: HTMLInputElement): void {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const categoryName = categoryInput.value.trim() || 'כללי';
    if (!name || !url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) { url = `https://${url}`; }

    const newSite: Site = { name, url };
    if (this.siteDataService.addSite(newSite, categoryName)) {
      this.uiStateService.selectSite(newSite);
      nameInput.value = '';
      urlInput.value = '';
      categoryInput.value = '';
      this.closeDialog();
    }
  }

  addSiteFromAvailable(siteToAdd: AvailableSite): void {
    const newSite: Site = { name: siteToAdd.name, url: siteToAdd.url };
    const categoryName = siteToAdd.category || 'כללי';
    this.siteDataService.addSite(newSite, categoryName);
    this.closeDialog();
  }

  // Favicon Logic (can be moved to a shared utility/service later)
  faviconErrorUrls = new Set<string>();
  colorPalette = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5'];
  getFaviconUrl(url: string): string { try { const siteUrl = new URL(url); return `${siteUrl.origin}/favicon.ico`; } catch (e) { return ''; } }
  onFaviconError(site: Site): void { this.faviconErrorUrls.add(site.url); }
  hasFaviconError(site: Site): boolean { return this.faviconErrorUrls.has(site.url); }
  getFirstLetter(name: string): string { return name ? name.charAt(0).toUpperCase() : ''; }
  getColorForSite(name: string): string { let hash = 0; for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); } return this.colorPalette[Math.abs(hash % this.colorPalette.length)]; }
}

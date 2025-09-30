import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, NgStyle } from '@angular/common';

// Interfaces
export interface Site {
  name: string;
  url: string;
}

export interface AvailableSite extends Site {
  description: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  // Properties
  sites: Site[] = [];
  filteredSites: Site[] = [];
  availableSites: AvailableSite[] = [];
  selectedSiteUrl: SafeResourceUrl | null = null;
  activeSiteName: string | null = null;

  // Dialog visibility state
  isAddSiteDialogVisible = false;
  isConfirmDeleteDialogVisible = false;
  siteToDelete: Site | null = null;

  // Sidebar state
  isSidebarCollapsed = false;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // Favicon error handling
  faviconErrorUrls = new Set<string>();

  // Private constants
  private readonly storageKey = 'userSites';
  private searchTerm = '';
  private colorPalette = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'];

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadSites();
    this.loadAvailableSites();
  }

  // --- Sidebar Logic ---
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  expandAndFocusSearch(): void {
    this.isSidebarCollapsed = false;
    // Use a timeout to ensure the element is visible and rendered before focusing
    setTimeout(() => {
      this.searchInput.nativeElement.focus();
    }, 0);
  }

  // --- Site Data Handling ---
  private loadSites(): void {
    const savedSites = localStorage.getItem(this.storageKey);
    if (savedSites) {
      this.sites = JSON.parse(savedSites);
    } else {
      this.http.get<Site[]>('assets/sites.json').subscribe(data => {
        this.sites = data;
        this.saveSites();
      });
    }
    this.filterSites();
    this.selectInitialSite();
  }

  private loadAvailableSites(): void {
    this.http.get<AvailableSite[]>('assets/available-sites.json').subscribe(data => {
      this.availableSites = data;
    });
  }

  private selectInitialSite(): void {
    if (this.filteredSites.length > 0) {
      this.selectSite(this.filteredSites[0]);
    } else {
      this.selectedSiteUrl = null;
      this.activeSiteName = null;
    }
  }

  private saveSites(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.sites));
  }

  selectSite(site: Site): void {
    this.selectedSiteUrl = this.sanitizer.bypassSecurityTrustResourceUrl(site.url);
    this.activeSiteName = site.name;
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterSites();
  }

  private filterSites(): void {
    this.filteredSites = this.searchTerm
      ? this.sites.filter(site => site.name.toLowerCase().includes(this.searchTerm))
      : [...this.sites];
  }

  // --- Favicon & Fallback Logic ---
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch (e) {
      return '';
    }
  }

  onFaviconError(site: Site): void {
    this.faviconErrorUrls.add(site.url);
  }

  hasFaviconError(site: Site): boolean {
    return this.faviconErrorUrls.has(site.url);
  }

  getFirstLetter(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '';
  }

  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % this.colorPalette.length);
    return this.colorPalette[index];
  }

  // --- Dialog Logic ---
  openAddSiteDialog(): void {
    this.isAddSiteDialogVisible = true;
  }

  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible = false;
  }

  addSite(nameInput: HTMLInputElement, urlInput: HTMLInputElement): void {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name || !url) return;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    if (this.sites.some(site => site.url === url)) {
      alert('הערוץ כבר קיים ברשימה.');
      return;
    }

    this.sites.push({ name, url });
    this.saveSites();
    this.filterSites();
    nameInput.value = '';
    urlInput.value = '';
  }

  addSiteFromAvailable(siteToAdd: Site): void {
    if (this.sites.some(site => site.url === siteToAdd.url)) {
      alert('הערוץ כבר קיים ברשימה.');
      return;
    }
    this.sites.push(siteToAdd);
    this.saveSites();
    this.filterSites();
  }

  getFilteredAvailableSites(): AvailableSite[] {
    const existingUrls = new Set(this.sites.map(s => s.url));
    return this.availableSites.filter(as => !existingUrls.has(as.url));
  }

  openConfirmDeleteDialog(site: Site, event: MouseEvent): void {
    event.stopPropagation();
    this.siteToDelete = site;
    this.isConfirmDeleteDialogVisible = true;
  }

  closeConfirmDeleteDialog(): void {
    this.isConfirmDeleteDialogVisible = false;
    this.siteToDelete = null;
  }

  confirmRemoveSite(): void {
    if (!this.siteToDelete) return;

    this.faviconErrorUrls.delete(this.siteToDelete.url);
    this.sites = this.sites.filter(site => site.url !== this.siteToDelete!.url);
    this.saveSites();
    this.filterSites();

    if (this.activeSiteName === this.siteToDelete.name) {
      this.selectInitialSite();
    }
    this.closeConfirmDeleteDialog();
  }
}

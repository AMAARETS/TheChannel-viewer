import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, NgStyle } from '@angular/common';

// הגדרת מבנה האובייקט עבור כל אתר
export interface Site {
  name: string;
  url: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, NgStyle], // הוספת NgStyle עבור עיצוב דינמי
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Channel Viewer';
  sites: Site[] = [];
  filteredSites: Site[] = [];
  selectedSiteUrl: SafeResourceUrl | null = null;
  activeSiteName: string | null = null;

  isAddSiteDialogVisible = false;
  isConfirmDeleteDialogVisible = false;
  siteToDelete: Site | null = null;

  // סט לאחסון כתובות של אייקונים שנכשלו בטעינה
  faviconErrorUrls = new Set<string>();

  private readonly storageKey = 'userSites';
  private searchTerm = '';
  private colorPalette = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'];

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadSites();
  }

  private loadSites(): void {
    const savedSites = localStorage.getItem(this.storageKey);
    if (savedSites) {
      this.sites = JSON.parse(savedSites);
      this.filterSites();
      this.selectInitialSite();
    } else {
      this.http.get<Site[]>('assets/sites.json').subscribe(data => {
        this.sites = data;
        this.saveSites();
        this.filterSites();
        this.selectInitialSite();
      });
    }
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
    if (!this.searchTerm) {
      this.filteredSites = [...this.sites];
    } else {
      this.filteredSites = this.sites.filter(site =>
        site.name.toLowerCase().includes(this.searchTerm)
      );
    }
  }

  // --- לוגיקת Favicon ו-Fallback ---
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch (e) {
      // אם ה-URL לא תקין, הטיפול בשגיאה יתפוס זאת ויציג fallback
      return '';
    }
  }

  onFaviconError(site: Site): void {
    // הוספת ה-URL של האתר לסט השגיאות
    this.faviconErrorUrls.add(site.url);
  }

  hasFaviconError(site: Site): boolean {
    return this.faviconErrorUrls.has(site.url);
  }

  getFirstLetter(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '';
  }

  // מחזיר צבע קבוע עבור שם נתון
  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % this.colorPalette.length);
    return this.colorPalette[index];
  }

  // --- לוגיקת דיאלוגים ---
  openAddSiteDialog(): void {
    this.isAddSiteDialogVisible = true;
  }

  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible = false;
  }

  addSite(nameInput: HTMLInputElement, urlInput: HTMLInputElement): void {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    if (name && url) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const newSite: Site = { name, url };
      this.sites.push(newSite);
      this.saveSites();
      this.filterSites();

      this.closeAddSiteDialog();
      nameInput.value = '';
      urlInput.value = '';
    }
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

    // הסרת ה-URL מסט השגיאות אם קיים
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

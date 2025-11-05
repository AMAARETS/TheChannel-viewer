import {
  Component,
  inject,
  HostListener,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { AnalyticsService } from '../../core/services/analytics.service'; // הוספת יבוא
import { AvailableSite, Site, Category } from '../../core/models/site.model';
import { map, BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-add-site-dialog',
  standalone: true,
  imports: [CommonModule, NgStyle, A11yModule],
  templateUrl: './add-site-dialog.html',
  styleUrl: './add-site-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddSiteDialogComponent implements AfterViewChecked {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);
  analyticsService = inject(AnalyticsService); // הזרקת השירות

  isVisible$ = this.uiStateService.isAddSiteDialogVisible$;
  categories$ = this.siteDataService.categories$;

  isCategoryDropdownOpen = false;
  dropdownPosition = {};
  private filteredCategoriesSubject = new BehaviorSubject<Category[]>([]);
  filteredCategories$ = this.filteredCategoriesSubject.asObservable();

  @ViewChild('siteNameInput') siteNameInput?: ElementRef<HTMLInputElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isAddSiteDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.siteNameInput?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  @HostListener('window:keydown.escape')
  closeOnEscape(): void {
    if (this.uiStateService.isAddSiteDialogVisible$.getValue()) {
      this.closeDialog();
    }
  }

  filteredAvailableSites$ = this.siteDataService.availableSites$.pipe(
    map((available) => {
      const existingUrls = new Set(
        this.siteDataService.categories$.getValue().flatMap((c) => c.sites.map((s) => s.url))
      );
      return available.filter((site) => !existingUrls.has(site.url));
    })
  );

  closeDialog() {
    this.isCategoryDropdownOpen = false;
    this.uiStateService.closeAddSiteDialog();
  }

  addSite(
    nameInput: HTMLInputElement,
    urlInput: HTMLInputElement,
    categoryInput: HTMLInputElement
  ): void {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const categoryName = categoryInput.value.trim() || 'כללי';
    if (!name || !url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const newSite: Site = { name, url };
    if (this.siteDataService.addSite(newSite, categoryName)) {
      this.analyticsService.trackAddChannel({
        channel_name: name,
        method: 'manual',
      });
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
    this.analyticsService.trackAddChannel({
      channel_name: siteToAdd.name,
      method: 'quick_add',
    });
    this.siteDataService.addSite(newSite, categoryName);
    this.closeDialog();
  }

  openCategoryDropdown(inputEl: HTMLElement, dialogEl: HTMLElement): void {
    this.onCategoryInput({ target: inputEl } as any);

    const inputRect = inputEl.getBoundingClientRect();
    const dialogRect = dialogEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const DROPDOWN_MAX_HEIGHT = 150;

    const left = inputRect.left - dialogRect.left;
    const width = inputRect.width;

    if (inputRect.bottom + DROPDOWN_MAX_HEIGHT > viewportHeight) {
      this.dropdownPosition = {
        bottom: `${dialogRect.height - (inputRect.top - dialogRect.top)}px`,
        left: `${left}px`,
        width: `${width}px`,
      };
    } else {
      const top = inputRect.bottom - dialogRect.top;
      this.dropdownPosition = {
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
      };
    }

    this.isCategoryDropdownOpen = true;
  }

  closeCategoryDropdown(): void {
    setTimeout(() => {
      this.isCategoryDropdownOpen = false;
    }, 150);
  }

  selectCategory(categoryName: string, categoryInput: HTMLInputElement): void {
    categoryInput.value = categoryName;
    this.isCategoryDropdownOpen = false;
  }

  onCategoryInput(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.toLowerCase().trim();
    const allCategories = this.siteDataService.categories$.getValue();

    const filtered = allCategories.filter((category) =>
      category.name.toLowerCase().includes(filterValue)
    );
    this.filteredCategoriesSubject.next(filtered);
  }

  faviconErrorUrls = new Set<string>();
  colorPalette = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5'];
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch {
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
    return this.colorPalette[Math.abs(hash % this.colorPalette.length)];
  }
}

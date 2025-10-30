import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { AvailableSite } from '../../../core/models/site.model';

@Component({
  selector: 'app-available-sites',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './available-sites.html',
  styleUrl: './available-sites.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvailableSitesComponent {
  @Input() sites: AvailableSite[] = [];
  @Input() isExpanded = true;
  @Output() siteAdded = new EventEmitter<AvailableSite>();

  faviconErrorUrls = new Set<string>();
  private colorPalette = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548'
  ];

  // --- Favicon & Fallback Logic ---
  getFaviconUrl(url: string): string {
    try {
      const siteUrl = new URL(url);
      return `${siteUrl.origin}/favicon.ico`;
    } catch { return ''; }
  }
  onFaviconError(site: AvailableSite): void { this.faviconErrorUrls.add(site.url); }
  hasFaviconError(site: AvailableSite): boolean { return this.faviconErrorUrls.has(site.url); }
  getFirstLetter(name: string): string { return name ? name.charAt(0).toUpperCase() : ''; }
  getColorForSite(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return this.colorPalette[Math.abs(hash % this.colorPalette.length)];
  }
}

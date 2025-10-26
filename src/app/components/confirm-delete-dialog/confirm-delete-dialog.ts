import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { SiteDataService } from '../../core/services/site-data.service';
import { Site } from '../../core/models/site.model';

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.css'
})
export class ConfirmDeleteDialogComponent {
  uiStateService = inject(UiStateService);
  siteDataService = inject(SiteDataService);

  isVisible$ = this.uiStateService.isConfirmDeleteDialogVisible$;
  siteToDelete$ = this.uiStateService.siteToDelete$;

  closeDialog() {
    this.uiStateService.closeConfirmDeleteDialog();
  }

  confirmRemoveSite() {
    const siteToRemove = this.uiStateService.siteToDelete$.getValue();
    if (!siteToRemove) return;

    this.siteDataService.removeSite(siteToRemove);

    // If the active site was deleted, select the first available site
    if (this.uiStateService.activeSiteName$.getValue() === siteToRemove.name) {
      const firstSite = this.siteDataService.categories$.getValue().flatMap(c => c.sites)[0];
      this.uiStateService.selectSite(firstSite || null);
    }

    this.closeDialog();
  }
}

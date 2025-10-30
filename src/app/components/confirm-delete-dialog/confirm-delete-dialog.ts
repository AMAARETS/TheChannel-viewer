import { Component, inject, ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { SiteDataService } from '../../core/services/site-data.service';

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDeleteDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);
  siteDataService = inject(SiteDataService);

  isVisible$ = this.uiStateService.isConfirmDeleteDialogVisible$;
  siteToDelete$ = this.uiStateService.siteToDelete$;

  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isConfirmDeleteDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.cancelButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog() {
    this.uiStateService.closeConfirmDeleteDialog();
  }

  confirmRemoveSite() {
    const siteToRemove = this.uiStateService.siteToDelete$.getValue();
    if (!siteToRemove) return;

    const activeSite = this.uiStateService.getActiveSite();
    this.siteDataService.removeSite(siteToRemove);

    if (activeSite?.url === siteToRemove.url) {
      const firstSite = this.siteDataService.categories$.getValue().flatMap(c => c.sites)[0];
      this.uiStateService.selectSite(firstSite || null);
    }

    this.closeDialog();
  }
}

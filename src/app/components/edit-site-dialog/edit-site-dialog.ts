import {
  Component,
  inject,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { SiteDataService } from '../../core/services/site-data.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { ToastService } from '../../core/services/toast.service';
import { Site } from '../../core/models/site.model';

@Component({
  selector: 'app-edit-site-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './edit-site-dialog.html',
  styleUrl: './edit-site-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSiteDialogComponent implements AfterViewChecked {
  siteDataService = inject(SiteDataService);
  uiStateService = inject(UiStateService);
  toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  isVisible$ = this.uiStateService.isEditSiteDialogVisible$;
  currentSite: Site | null = null;
  currentCategory: string | null = null;

  @ViewChild('siteNameInput') siteNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('siteUrlInput') siteUrlInput?: ElementRef<HTMLInputElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const dialogData = this.uiStateService.editSiteDialogData$.getValue();
    const isDialogVisible = this.uiStateService.isEditSiteDialogVisible$.getValue();

    if (isDialogVisible && !this.isVisible && dialogData) {
      this.currentSite = dialogData.site;
      this.currentCategory = dialogData.categoryName;

      // עדכון הערכים של השדות ישירות
      setTimeout(() => {
        if (this.siteNameInput?.nativeElement) {
          this.siteNameInput.nativeElement.value = dialogData.site.name;
          this.siteNameInput.nativeElement.focus();
        }
        if (this.siteUrlInput?.nativeElement) {
          this.siteUrlInput.nativeElement.value = dialogData.site.url;
        }
      }, 0);
    }
    this.isVisible = isDialogVisible;
  }

  @HostListener('window:keydown.escape')
  closeOnEscape(): void {
    if (this.uiStateService.isEditSiteDialogVisible$.getValue()) {
      this.closeDialog();
    }
  }

  closeDialog() {
    this.uiStateService.closeEditSiteDialog();
    this.currentSite = null;
    this.currentCategory = null;
  }

  saveSite(
    nameInput: HTMLInputElement,
    urlInput: HTMLInputElement
  ): void {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    if (!name || !url) {
      this.toastService.show('נא למלא את כל השדות', 'error');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    if (!this.currentSite || !this.currentCategory) {
      this.toastService.show('שגיאה בעדכון הערוץ', 'error');
      return;
    }

    const updatedSite: Site = {
      ...this.currentSite,
      name,
      url
    };

    if (this.siteDataService.updateSite(this.currentSite, updatedSite, this.currentCategory)) {
      this.toastService.show('הערוץ עודכן בהצלחה', 'success');
      this.closeDialog();
    } else {
      this.toastService.show('שגיאה בעדכון הערוץ', 'error');
    }
  }
}

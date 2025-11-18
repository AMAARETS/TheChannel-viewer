import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';
import { Site } from '../../core/models/site.model';

@Component({
  selector: 'app-install-extension-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './install-extension-dialog.component.html',
  styleUrls: ['./install-extension-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallExtensionDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$: Observable<boolean> = this.uiStateService.isInstallExtensionDialogVisible$;
  site$: Observable<Site | null> = this.uiStateService.siteForInstallExtensionDialog$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isInstallExtensionDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog(checkbox?: HTMLInputElement): void {
    const disableGlobally = checkbox ? checkbox.checked : false;
    this.uiStateService.closeInstallExtensionDialog(disableGlobally);
  }
}
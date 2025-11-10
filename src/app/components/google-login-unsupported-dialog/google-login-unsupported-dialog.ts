import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { Site } from '../../core/models/site.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-google-login-unsupported-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './google-login-unsupported-dialog.html',
  styleUrl: './google-login-unsupported-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GoogleLoginUnsupportedDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$ = this.uiStateService.isGoogleLoginUnsupportedDialogVisible$;
  site$: Observable<Site | null> = this.uiStateService.siteForUnsupportedLoginDialog$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isGoogleLoginUnsupportedDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog(): void {
    this.uiStateService.closeGoogleLoginUnsupportedDialog();
  }
}

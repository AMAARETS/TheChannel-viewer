import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-third-party-cookies-blocked-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './third-party-cookies-blocked-dialog.html',
  styleUrls: ['./third-party-cookies-blocked-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThirdPartyCookiesBlockedDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$: Observable<boolean> = this.uiStateService.isThirdPartyCookiesBlockedDialogVisible$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isThirdPartyCookiesBlockedDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog(checkbox?: HTMLInputElement): void {
    const disableGlobally = checkbox ? checkbox.checked : false;
    this.uiStateService.closeThirdPartyCookiesBlockedDialog(disableGlobally);
  }
}

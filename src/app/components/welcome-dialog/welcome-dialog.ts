import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-welcome-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './welcome-dialog.html',
  styleUrl: './welcome-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WelcomeDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);
  isVisible$ = this.uiStateService.isWelcomeDialogVisible$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isWelcomeDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog(checkbox: HTMLInputElement): void {
    const disableGlobally = checkbox ? checkbox.checked : false;
    this.uiStateService.closeWelcomeDialog(disableGlobally);
  }
}

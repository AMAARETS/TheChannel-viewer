import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-login-tutorial-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './login-tutorial-dialog.html',
  styleUrl: './login-tutorial-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginTutorialDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$ = this.uiStateService.isLoginTutorialDialogVisible$;
  siteName$: Observable<string | null> = this.uiStateService.activeSiteName$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isLoginTutorialDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  closeDialog(checkbox?: HTMLInputElement): void {
    const disableGlobally = checkbox ? checkbox.checked : false;
    this.uiStateService.closeLoginTutorialDialog(disableGlobally);
  }
}

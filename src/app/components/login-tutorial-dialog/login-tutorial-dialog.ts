import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-login-tutorial-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-tutorial-dialog.html',
  styleUrl: './login-tutorial-dialog.css'
})
export class LoginTutorialDialogComponent {
  uiStateService = inject(UiStateService);

  isVisible$ = this.uiStateService.isLoginTutorialDialogVisible$;
  siteName$: Observable<string | null> = this.uiStateService.activeSiteName$;

  closeDialog(checkbox?: HTMLInputElement): void {
    const disableGlobally = checkbox ? checkbox.checked : false;
    this.uiStateService.closeLoginTutorialDialog(disableGlobally);
  }
}

import { Component, inject, HostListener } from '@angular/core'; // Import HostListener
import { CommonModule } from '@angular/common';
import { UiStateService, InputDialogConfig } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-input-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input-dialog.html',
  styleUrl: './input-dialog.css'
})
export class InputDialogComponent {
  uiStateService = inject(UiStateService);

  isVisible$: Observable<boolean> = this.uiStateService.isInputDialogVisible$;
  config$: Observable<InputDialogConfig | null> = this.uiStateService.inputDialogConfig$;

  // FIX: Add HostListener to close dialog on Escape key press
  @HostListener('window:keydown.escape')
  closeOnEscape(): void {
    if (this.uiStateService.isInputDialogVisible$.getValue()) {
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.uiStateService.closeInputDialog(null);
  }

  submit(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (value) {
      this.uiStateService.closeInputDialog(value);
    }
  }
}

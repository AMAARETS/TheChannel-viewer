import { Component, inject, HostListener, ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService, InputDialogConfig } from '../../core/services/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-input-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './input-dialog.html',
  styleUrl: './input-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InputDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$: Observable<boolean> = this.uiStateService.isInputDialogVisible$;
  config$: Observable<InputDialogConfig | null> = this.uiStateService.inputDialogConfig$;

  @ViewChild('dialogInput') dialogInput?: ElementRef<HTMLInputElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isInputDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.dialogInput?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

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

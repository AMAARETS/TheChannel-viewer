import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UiStateService } from '../../core/services/ui-state.service';
import { catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './main-content.html',
  styleUrl: './main-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainContentComponent {
  uiStateService = inject(UiStateService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  selectedSiteUrl$ = this.uiStateService.sanitizedSelectedSiteUrl$;
  activeView$ = this.uiStateService.activeView$;

  // FIX 4: Add sanitized custom content observable
  sanitizedCustomContent$ = this.uiStateService.sanitizedCustomContent$;

  // --- לוגיקת טופס יצירת קשר ---
  contactForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    message: ['', Validators.required]
  });
  formStatus: 'idle' | 'sending' | 'success' | 'error' = 'idle';
  formStatusMessage = '';

  goToContactPage(): void {
    this.uiStateService.showContactPage();
  }

  onFormSubmit(): void {
    if (this.contactForm.invalid) {
      return;
    }

    this.formStatus = 'sending';
    const formData = {
      ...this.contactForm.value,
      _subject: 'פנייה חדשה מהאתר TheChannel!'
    };

    this.http.post('https://formsubmit.co/ajax/click.go.script@gmail.com', formData, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    }).pipe(
      tap(() => {
        this.formStatus = 'success';
        this.formStatusMessage = 'הפנייה נשלחה בהצלחה! ניצור קשר בהקדם.';
        this.contactForm.reset();
      }),
      catchError(error => {
        console.error('Form submission error:', error);
        this.formStatus = 'error';
        this.formStatusMessage = 'אירעה שגיאה. אנא נסו שוב מאוחר יותר.';
        return of(null); // Return a benign observable
      })
    ).subscribe();
  }
}

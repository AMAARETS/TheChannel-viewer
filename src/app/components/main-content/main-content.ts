import { Component, inject, ChangeDetectionStrategy, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-content.html',
  styleUrl: './main-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainContentComponent {
  uiStateService = inject(UiStateService);
  private destroyRef = inject(DestroyRef);
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  selectedSiteUrl$ = this.uiStateService.sanitizedSelectedSiteUrl$;
  activeView$ = this.uiStateService.activeView$;
  sanitizedCustomContent$ = this.uiStateService.sanitizedCustomContent$;

  // חיווי טעינה
  isLoading = signal(false);

  constructor() {
    // מעקב אחרי שינויים ב-URL כדי להציג ספינר
    this.uiStateService.selectedSite$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((site) => {
        if (site) {
          this.isLoading.set(true);

          // גיבוי: הסתר את הספינר אחרי 5 שניות גם אם load לא נורה
          this.clearLoadingTimeout();
          this.loadingTimeout = setTimeout(() => {
            this.isLoading.set(false);
          }, 5000);
        }
      });
  }

  onIframeLoaded() {
    this.clearLoadingTimeout();
    // המתן רגע קצר כדי לתת לאתר להשלים רינדור
    setTimeout(() => {
      this.isLoading.set(false);
    }, 300);
  }

  onIframeError() {
    this.clearLoadingTimeout();
    this.isLoading.set(false);
  }

  private clearLoadingTimeout() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }
}

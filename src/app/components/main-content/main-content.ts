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
        }
      });
  }

  onIframeLoaded() {
    this.isLoading.set(false);
  }
}

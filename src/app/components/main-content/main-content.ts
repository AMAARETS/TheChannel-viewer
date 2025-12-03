import { Component, inject, ChangeDetectionStrategy, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// ייבוא הקומפוננטה החדשה
import { HelpComponent } from '../help/help.component';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, HelpComponent],
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
  helpSection$ = this.uiStateService.helpSection$;

  // חיווי טעינה
  isLoading = signal(false);

  constructor() {
    this.uiStateService.selectedSite$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((site) => {
        if (site) {
          this.isLoading.set(true);
          this.clearLoadingTimeout();
          this.loadingTimeout = setTimeout(() => {
            this.isLoading.set(false);
          }, 5000);
        }
      });
  }

  onIframeLoaded() {
    this.clearLoadingTimeout();
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

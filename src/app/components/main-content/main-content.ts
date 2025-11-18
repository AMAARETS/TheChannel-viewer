import { Component, inject, ChangeDetectionStrategy, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-content.html',
  styleUrl: './main-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainContentComponent implements OnDestroy { // הסרנו את AfterViewInit מכאן
  uiStateService = inject(UiStateService);
  analyticsService = inject(AnalyticsService);
  private ngZone = inject(NgZone);

  selectedSiteUrl$ = this.uiStateService.sanitizedSelectedSiteUrl$;
  activeView$ = this.uiStateService.activeView$;
  sanitizedCustomContent$ = this.uiStateService.sanitizedCustomContent$;

  // --- שינוי מרכזי: שימוש ב-Setter במקום ב-ViewChild רגיל ---
  private _iframeElementRef!: ElementRef<HTMLIFrameElement>;
  @ViewChild('iframeElement') set iframeElementRef(el: ElementRef<HTMLIFrameElement> | undefined) {
    // ה-Setter הזה יופעל אוטומטית על ידי אנגולר בכל פעם שה-iframe נוצר או נהרס
    if (el) {
      // ה-iframe נוצר והרפרנס אליו זמין
      this._iframeElementRef = el;
      this.setupIntersectionObserver();
    } else {
      // ה-iframe הוסר מה-DOM
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
    }
  }

  private activityInterval: any = null;
  private readonly HEARTBEAT_INTERVAL_MS = 3000;

  private isIframeInFocus = false;
  private isMouseOverIframe = false;
  private isIframeVisible = false;
  private intersectionObserver!: IntersectionObserver;

  // הפונקציה ngAfterViewInit הוסרה כי היא כבר לא נחוצה. ה-Setter מטפל בהכל.

  private setupIntersectionObserver(): void {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      const options = { threshold: 0.5 };
      this.intersectionObserver = new IntersectionObserver((entries) => {
        this.ngZone.run(() => {
          this.isIframeVisible = entries[0].isIntersecting;
          console.log(`DEBUG: Iframe visibility changed to: ${this.isIframeVisible}`);
          this.updateActivityState();
        });
      }, options);

      // ודא שהרפרנס קיים לפני השימוש בו
      if (this._iframeElementRef?.nativeElement) {
        this.intersectionObserver.observe(this._iframeElementRef.nativeElement);
      }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    setTimeout(() => {
      // כאן אנו משתמשים ברפרנס הפנימי המעודכן
      if (document.activeElement === this._iframeElementRef?.nativeElement) {
        console.log('DEBUG: ✅ Iframe gained focus');
        this.isIframeInFocus = true;
        this.updateActivityState();
      }
    }, 0);
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.isIframeInFocus = false;
    this.updateActivityState();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.updateActivityState();
  }

  onIframeMouseEnter(): void {
    this.isMouseOverIframe = true;
    this.updateActivityState();
  }

  onIframeMouseLeave(): void {
    this.isMouseOverIframe = false;
    this.updateActivityState();
  }

  private updateActivityState(): void {
    const isUserConsideredActive =
      (this.isIframeInFocus || this.isMouseOverIframe) &&
      this.isIframeVisible &&
      !document.hidden;

    // הלוגים נשארים לצורך בדיקה
    console.log(
      `DEBUG: updateActivityState check. Should be active? ${isUserConsideredActive}`,
      {
        isIframeInFocus: this.isIframeInFocus,
        isMouseOverIframe: this.isMouseOverIframe,
        isIframeVisible: this.isIframeVisible,
        isPageHidden: document.hidden,
      }
    );

    if (isUserConsideredActive && !this.activityInterval) {
      this.startHeartbeat();
    } else if (!isUserConsideredActive && this.activityInterval) {
      this.stopHeartbeat();
    }
  }

  private startHeartbeat(): void {
    if (this.activityInterval) return;
    console.log('%cDEBUG: 🚀 STARTING HEARTBEAT...', 'color: green; font-weight: bold;');
    this.analyticsService.trackIframeHeartbeat();
    this.activityInterval = setInterval(() => {
      this.analyticsService.trackIframeHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.activityInterval) {
      console.log('%cDEBUG: 🛑 STOPPING HEARTBEAT.', 'color: red; font-weight: bold;');
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopHeartbeat();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}

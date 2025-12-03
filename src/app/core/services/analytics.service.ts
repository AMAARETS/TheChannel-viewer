import { Injectable, OnDestroy, NgZone } from '@angular/core';

// הגדרת טיפוסים לאירועים
export type PageViewEvent = {
  page_title: string;
  page_path: string;
  page_location: string;
};

export type ButtonClickEvent = {
  button_name: string;
  button_location: 'sidebar' | 'dialog' | 'context_menu';
};

export type AddChannelEvent = {
  channel_name: string;
  method: 'manual' | 'quick_add' | 'from_url';
};

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService implements OnDestroy {

  private messageListener: ((event: MessageEvent) => void) | null = null;

  // הזרקת NgZone כדי להבטיח שאירועי הודעות לא יפעילו Change Detection מיותר של אנגולר
  constructor(private ngZone: NgZone) {
    this.initIframeActivityListener();
  }

  private get dataLayer(): any[] {
    return (window as any).dataLayer || [];
  }

  private pushEvent(eventName: string, data: object): void {
    this.dataLayer.push({
      event: eventName,
      ...data
    });
  }

  /**
   * מאתחל את ההאזנה להודעות Heartbeat מה-Iframe
   */
  private initIframeActivityListener(): void {
    // אנחנו מפעילים את הליסנר מחוץ ל-Zone של אנגולר כדי לשפר ביצועים
    // כיוון שאין צורך לעדכן את ה-UI בעקבות ההודעות הללו
    this.ngZone.runOutsideAngular(() => {
      this.messageListener = (event: MessageEvent) => {
        // סינון הודעות שאינן שלנו
        if (event.data && event.data.type === 'THE_CHANNEL_IFRAME_HEARTBEAT') {
          this.handleHeartbeat(event.data.payload);
        }
      };

      window.addEventListener('message', this.messageListener);
    });
  }

  /**
   * מטפל בהודעת הדופק ושולח נתונים לגוגל
   */
  private handleHeartbeat(payload: any): void {
    // שליחת אירוע 'user_engagement' יזום
    // הפרמטר engagement_time_msec הוא המפתח לדיוק המדידה ב-GA4
    this.pushEvent('iframe_heartbeat', {
      embedded_url: payload.url,
      embedded_title: payload.title,
      // המרת הזמן למילישניות (אם זה לא כבר)
      engagement_time_msec: payload.engagementTime || 5000,
      // פרמטר נוסף שיעזור לך לסנן בדוחות
      traffic_type: 'embedded_content'
    });
  }

  ngOnDestroy(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
  }

  // --- פונקציות מעקב סטנדרטיות (ללא שינוי) ---

  public trackPageView(data: PageViewEvent): void {
    this.pushEvent('page_view_app', data);
    console.log('Analytics: Page View', data);
  }

  public trackButtonClick(data: ButtonClickEvent): void {
    this.pushEvent('button_click_app', data);
  }

  public trackAddChannel(data: AddChannelEvent): void {
    this.pushEvent('add_channel', data);
  }
}

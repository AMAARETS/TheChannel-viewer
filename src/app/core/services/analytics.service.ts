import { Injectable } from '@angular/core';

// --- ההגדרה הבאה הוסרה כי היא שימשה רק את trackPageView ---
// export type PageViewEvent = {
//   page_title: string;
//   page_path: string;
//   page_location: string;
// };

export type ButtonClickEvent = {
  button_name: string; // למשל 'add_channel_dialog_open'
  button_location: 'sidebar' | 'dialog' | 'context_menu';
};

export type AddChannelEvent = {
  channel_name: string;
  method: 'manual' | 'quick_add' | 'from_url';
};

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  // גישה ישירה ל-dataLayer ש-GTM יוצר
  private get dataLayer(): any[] {
    return (window as any).dataLayer || [];
  }

  /**
   * פונקציה גנרית לשליחת אירועים ל-DataLayer.
   * @param eventName שם האירוע כפי שיופיע ב-GTM
   * @param data אובייקט עם כל המידע הנוסף על האירוע
   */
  private pushEvent(eventName: string, data: object): void {
    this.dataLayer.push({
      event: eventName,
      ...data
    });
  }

  // --- פונקציות ייעודיות לכל סוג אירוע ---

  // --- המתודה trackPageView הוסרה מכאן במלואה ---

  /**
   * עוקב אחר לחיצה על כפתורים חשובים.
   */
  public trackButtonClick(data: ButtonClickEvent): void {
    this.pushEvent('button_click_app', data);
    console.log('Analytics: Button Click', data);
  }

  /**
   * עוקב אחר אירוע הוספת ערוץ חדש.
   */
  public trackAddChannel(data: AddChannelEvent): void {
    this.pushEvent('add_channel', data);
    console.log('Analytics: Add Channel', data);
  }

  /**
   * שולח "פעימת לב" ל-GTM כדי לסמן שהמשתמש עדיין פעיל,
   * גם כאשר הוא נמצא בתוך iframe.
   */
  public trackIframeHeartbeat(): void {
    this.pushEvent('iframe_heartbeat', {});
  }
}

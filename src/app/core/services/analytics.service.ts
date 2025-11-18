import { Injectable } from '@angular/core';

// הגדרת טיפוסים לאירועים השונים כדי לשמור על קוד נקי
export type PageViewEvent = {
  page_title: string;
  page_path: string; // למשל /sites/ynet או /ads/welcome-page
  page_location: string; // ה-URL המלא
};

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

  /**
   * עוקב אחר צפייה בדף (ערוץ או דף מותאם).
   * זה האירוע המרכזי למעקב שביקשת.
   */
  public trackPageView(data: PageViewEvent): void {
    this.pushEvent('page_view_app', data); // שם ייחודי כדי לא להתנגש עם page_view אוטומטי
    console.log('Analytics: Page View', data);
  }

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
}

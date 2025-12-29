import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class TitleService {
  private readonly defaultTitle = 'הערוץ - הפלטפורמה הנוחה לצפייה בערוצים';
  private readonly siteTitleSeparator = ' | ';
  private titleService = inject(Title);

  /**
   * מעדכן את כותרת האתר לכותרת ברירת המחדל
   */
  setDefaultTitle(): void {
    this.titleService.setTitle(this.defaultTitle);
  }

  /**
   * מעדכן את כותרת האתר לכלול את שם הערוץ
   * @param siteName שם הערוץ
   */
  setSiteTitle(siteName: string): void {
    const newTitle = `${siteName}${this.siteTitleSeparator}${this.defaultTitle}`;
    this.titleService.setTitle(newTitle);
  }

  /**
   * מעדכן את כותרת האתר לדף עזרה
   * @param section סעיף העזרה
   */
  setHelpTitle(section: string): void {
    const sectionNames: Record<string, string> = {
      'extension': 'התקנת התוסף',
      'login': 'התחברות לערוצים',
      'images': 'הוספת תמונות',
      'usage': 'מדריך שימוש'
    };

    const sectionName = sectionNames[section] || section;
    const newTitle = `עזרה - ${sectionName}${this.siteTitleSeparator}${this.defaultTitle}`;
    this.titleService.setTitle(newTitle);
  }

  /**
   * מעדכן את כותרת האתר לתוכן מותאם אישית
   * @param contentType סוג התוכן (advertise, contact, וכו')
   */
  setCustomContentTitle(contentType: string): void {
    const contentNames: Record<string, string> = {
      'advertise': 'פרסום',
      'contact': 'צור קשר'
    };

    const contentName = contentNames[contentType] || contentType;
    const newTitle = `${contentName}${this.siteTitleSeparator}${this.defaultTitle}`;
    this.titleService.setTitle(newTitle);
  }

  /**
   * מחזיר את הכותרת הנוכחית
   */
  getCurrentTitle(): string {
    return this.titleService.getTitle();
  }
}

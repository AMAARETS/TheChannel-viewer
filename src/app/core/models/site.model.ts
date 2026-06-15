export interface Site {
  name: string;
  url: string;
  googleLoginSupported: boolean;
  view?: boolean;      // שדה אופציונלי להצגה/הסתרה
  dateEnd?: string;    // שדה אופציונלי לתאריך תפוגה (פורמט D-M-YYYY)
  dateAdded?: string;  // שדה אופציונלי לתאריך הוספה
  isManual?: boolean;
}

export interface Category {
  name: string;
  sites: Site[];
  priority?: number; // סדר עדיפות להצגה — נמוך יותר = קודם יותר. משפיע רק על קטגוריות חדשות שהמשתמש עוד לא מכיר
}

export interface AvailableSite extends Site {
  description: string;
  category: string;
}
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
}

export interface AvailableSite extends Site {
  description: string;
  category: string;
}
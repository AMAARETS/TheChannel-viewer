import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {

  /**
   * מוסיף פרמטרי UTM ל-URL של האתר
   */
  addUtmParameters(url: string): string {
    try {
      const urlObj = new URL(url);
      const utmParams = {
        utm_source: 'haharuts',
        utm_medium: 'iframe'
      };

      Object.entries(utmParams).forEach(([key, value]) => {
        if (!urlObj.searchParams.has(key)) {
          urlObj.searchParams.set(key, value);
        }
      });

      return urlObj.toString();
    } catch (error) {
      console.warn('Error adding UTM parameters to URL:', url, error);
      return url;
    }
  }

  /**
   * מעדכן את ה-URL בדפדפן ללא רענון הדף
   */
  updateUrl(params: Record<string, string>, shouldPush = true): void {
    const urlParams = this.preserveUnknownParams(params);
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;

    if (shouldPush) {
      history.pushState(null, '', newUrl);
    } else {
      history.replaceState(null, '', newUrl);
    }
  }

  /**
   * מאפס את ה-URL למצב בית (משמר רק פרמטרים לא מוכרים)
   */
  resetUrlToHome(): void {
    const currentParams = new URLSearchParams(window.location.search);
    const knownNavigationParams = ['name', 'url', 'category', 'view', 'section', 'source'];

    const newParams = new URLSearchParams();
    currentParams.forEach((value, key) => {
      if (!knownNavigationParams.includes(key)) {
        newParams.set(key, value);
      }
    });

    const queryString = newParams.toString();
    const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
    history.pushState(null, '', newUrl);
  }

  /**
   * שומר פרמטרים לא מוכרים (כמו UTM) ומוסיף/מעדכן את הפרמטרים החדשים
   */
  private preserveUnknownParams(newParams: Record<string, string>): URLSearchParams {
    const knownParams = ['name', 'url', 'category', 'view', 'section', 'source'];
    const currentParams = new URLSearchParams(window.location.search);
    const resultParams = new URLSearchParams();

    // שמירת כל הפרמטרים שאינם מוכרים
    currentParams.forEach((value, key) => {
      if (!knownParams.includes(key)) {
        resultParams.set(key, value);
      }
    });

    // הוספת/עדכון הפרמטרים החדשים
    Object.entries(newParams).forEach(([key, value]) => {
      resultParams.set(key, value);
    });

    return resultParams;
  }
}

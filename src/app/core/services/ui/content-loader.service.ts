import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BehaviorSubject, Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContentLoaderService {
  private sanitizer = inject(DomSanitizer);

  private customContentSubject = new BehaviorSubject<string | null>(null);
  customContent$ = this.customContentSubject.asObservable();

  sanitizedCustomContent$: Observable<SafeHtml | null> = this.customContent$.pipe(
    map((html) => (html ? this.sanitizer.bypassSecurityTrustHtml(html) : null))
  );

  private injectedCss: HTMLLinkElement | null = null;
  private injectedJs: HTMLScriptElement | null = null;

  async loadFromSource(source: string): Promise<void> {
    this.cleanupInjectedResources();
    const baseUrl = `/ads/${source}/`;

    try {
      const htmlUrl = `${baseUrl}index.html`;
      const htmlResponse = await fetch(htmlUrl);
      if (!htmlResponse.ok) {
        throw new Error(`קובץ index.html לא נמצא בתיקייה '${source}'`);
      }
      const htmlContent = await htmlResponse.text();

      // CSS Injection
      const cssUrl = `${baseUrl}style.css`;
      const cssCheck = await fetch(cssUrl, { method: 'HEAD' });
      if (cssCheck.ok) {
        this.injectedCss = document.createElement('link');
        this.injectedCss.rel = 'stylesheet';
        this.injectedCss.href = cssUrl;
        document.head.appendChild(this.injectedCss);
      }

      this.customContentSubject.next(htmlContent);

      // JS Injection
      const jsUrl = `${baseUrl}script.js`;
      const jsCheck = await fetch(jsUrl, { method: 'HEAD' });
      if (jsCheck.ok) {
        this.injectedJs = document.createElement('script');
        this.injectedJs.src = jsUrl;
        this.injectedJs.defer = true;
        document.body.appendChild(this.injectedJs);
      }

    } catch (error) {
      console.error('Error loading dynamic content:', error);
      const errorHtml = `<div style="padding:20px; color:red; text-align:right;"><h2>שגיאה בטעינת התוכן</h2><p>${
        (error as Error).message
      }</p></div>`;
      this.customContentSubject.next(errorHtml);
      throw error;
    }
  }

  cleanupInjectedResources(): void {
    if (this.injectedCss) {
      document.head.removeChild(this.injectedCss);
      this.injectedCss = null;
    }
    if (this.injectedJs) {
      document.body.removeChild(this.injectedJs);
      this.injectedJs = null;
    }
    this.customContentSubject.next(null);
  }
}

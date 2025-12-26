import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  // Public keys used by UiStateService for initialization
  readonly sidebarCollapsedKey = 'sidebarCollapsed';
  readonly lastViewedSiteUrlKey = 'lastViewedSiteUrl';
  readonly collapsedCategoriesKey = 'collapsedCategories';

  private readonly viewedTutorialsKey = 'viewedChannelTutorials';
  private readonly neverShowLoginTutorialKey = 'neverShowLoginTutorial';
  private readonly neverShowWelcomeDialogKey = 'neverShowWelcomeDialog';
  private readonly neverShowGrantPermissionDialogKey = 'neverShowGrantPermissionDialog';
  private readonly neverShowInstallExtensionDialogKey = 'neverShowInstallExtensionDialog';
  private readonly neverShowCookiesBlockedDialogKey = 'neverShowCookiesBlockedDialog';

  saveToStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }

  loadFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  }

  // --- Tutorial & Dialog Flags ---

  hasViewedTutorial(url: string): boolean {
    const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? [];
    return viewedUrls.includes(url);
  }

  markTutorialAsViewed(url: string): void {
    const viewedUrls = this.loadFromStorage<string[]>(this.viewedTutorialsKey) ?? [];
    if (!viewedUrls.includes(url)) {
      viewedUrls.push(url);
      this.saveToStorage(this.viewedTutorialsKey, viewedUrls);
    }
  }

  isLoginTutorialGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowLoginTutorialKey) === true;
  }
  disableLoginTutorialGlobally(): void {
    this.saveToStorage(this.neverShowLoginTutorialKey, true);
  }

  isWelcomeDialogGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowWelcomeDialogKey) === true;
  }
  disableWelcomeDialogGlobally(): void {
    this.saveToStorage(this.neverShowWelcomeDialogKey, true);
  }

  isGrantPermissionDialogGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowGrantPermissionDialogKey) === true;
  }
  disableGrantPermissionDialogGlobally(): void {
    this.saveToStorage(this.neverShowGrantPermissionDialogKey, true);
  }

  isInstallExtensionDialogGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowInstallExtensionDialogKey) === true;
  }
  disableInstallExtensionDialogGlobally(): void {
    this.saveToStorage(this.neverShowInstallExtensionDialogKey, true);
  }

  isCookiesBlockedDialogGloballyDisabled(): boolean {
    return this.loadFromStorage<boolean>(this.neverShowCookiesBlockedDialogKey) === true;
  }
  disableCookiesBlockedDialogGlobally(): void {
    this.saveToStorage(this.neverShowCookiesBlockedDialogKey, true);
  }
}

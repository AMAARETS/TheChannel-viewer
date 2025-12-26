import { Injectable } from '@angular/core';
import { BehaviorSubject, first } from 'rxjs';
import { Site } from '../../models/site.model';
import { InputDialogConfig } from './ui-types';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  // Visibility Subjects
  isAddSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isEditSiteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isConfirmDeleteDialogVisible$ = new BehaviorSubject<boolean>(false);
  isInputDialogVisible$ = new BehaviorSubject<boolean>(false);
  isLoginTutorialDialogVisible$ = new BehaviorSubject<boolean>(false);
  isWelcomeDialogVisible$ = new BehaviorSubject<boolean>(false);
  isGoogleLoginUnsupportedDialogVisible$ = new BehaviorSubject<boolean>(false);
  isGrantPermissionDialogVisible$ = new BehaviorSubject<boolean>(false);
  isInstallExtensionDialogVisible$ = new BehaviorSubject<boolean>(false);
  isThirdPartyCookiesBlockedDialogVisible$ = new BehaviorSubject<boolean>(false);

  // Data Subjects
  editSiteDialogData$ = new BehaviorSubject<{ site: Site; categoryName: string } | null>(null);
  siteToDelete$ = new BehaviorSubject<Site | null>(null);
  inputDialogConfig$ = new BehaviorSubject<InputDialogConfig | null>(null);
  siteForUnsupportedLoginDialog$ = new BehaviorSubject<Site | null>(null);
  siteForGrantPermissionDialog$ = new BehaviorSubject<Site | null>(null);
  siteForInstallExtensionDialog$ = new BehaviorSubject<Site | null>(null);

  // Internal State
  private dialogQueue: (() => void)[] = [];
  private isDialogVisible = false;
  private focusedElementBeforeDialog: HTMLElement | null = null;

  // --- Queue Management ---
  enqueueDialog(dialogFn: () => void): void {
    this.dialogQueue.push(dialogFn);
  }

  processNextDialogInQueue(): void {
    if (this.isDialogVisible || this.dialogQueue.length === 0) {
      return;
    }
    const nextDialogFn = this.dialogQueue.shift()!;
    nextDialogFn();
  }

  // --- Focus Management ---
  private saveFocus(): void {
    this.focusedElementBeforeDialog = document.activeElement as HTMLElement;
    this.isDialogVisible = true;
  }

  private restoreFocus(): void {
    this.focusedElementBeforeDialog?.focus();
    this.focusedElementBeforeDialog = null;
    this.isDialogVisible = false;
    setTimeout(() => this.processNextDialogInQueue(), 0);
  }

  // --- Dialog Actions ---

  openAddSiteDialog(): void {
    this.saveFocus();
    this.isAddSiteDialogVisible$.next(true);
  }
  closeAddSiteDialog(): void {
    this.isAddSiteDialogVisible$.next(false);
    this.restoreFocus();
  }

  openEditSiteDialog(site: Site, categoryName: string): void {
    this.saveFocus();
    this.editSiteDialogData$.next({ site, categoryName });
    this.isEditSiteDialogVisible$.next(true);
  }
  closeEditSiteDialog(): void {
    this.isEditSiteDialogVisible$.next(false);
    this.editSiteDialogData$.next(null);
    this.restoreFocus();
  }

  openConfirmDeleteDialog(site: Site): void {
    this.saveFocus();
    this.siteToDelete$.next(site);
    this.isConfirmDeleteDialogVisible$.next(true);
  }
  closeConfirmDeleteDialog(): void {
    this.isConfirmDeleteDialogVisible$.next(false);
    this.siteToDelete$.next(null);
    this.restoreFocus();
  }

  openInputDialog(config: InputDialogConfig): void {
    this.saveFocus();
    this.inputDialogConfig$.next(config);
    this.isInputDialogVisible$.next(true);
  }
  closeInputDialog(value: string | null): void {
    if (value) {
      this.inputDialogConfig$.pipe(first()).subscribe((config) => config?.callback(value));
    }
    this.isInputDialogVisible$.next(false);
    this.inputDialogConfig$.next(null);
    this.restoreFocus();
  }

  openLoginTutorialDialog(): void {
    this.saveFocus();
    this.isLoginTutorialDialogVisible$.next(true);
  }
  closeLoginTutorialDialog(): void {
    this.isLoginTutorialDialogVisible$.next(false);
    this.restoreFocus();
  }

  openWelcomeDialog(): void {
    this.saveFocus();
    this.isWelcomeDialogVisible$.next(true);
  }
  closeWelcomeDialog(): void {
    this.isWelcomeDialogVisible$.next(false);
    this.restoreFocus();
  }

  openGoogleLoginUnsupportedDialog(site: Site): void {
    this.saveFocus();
    this.siteForUnsupportedLoginDialog$.next(site);
    this.isGoogleLoginUnsupportedDialogVisible$.next(true);
  }
  closeGoogleLoginUnsupportedDialog(): void {
    this.isGoogleLoginUnsupportedDialogVisible$.next(false);
    this.siteForUnsupportedLoginDialog$.next(null);
    this.restoreFocus();
  }

  openGrantPermissionDialog(site: Site): void {
    this.saveFocus();
    this.siteForGrantPermissionDialog$.next(site);
    this.isGrantPermissionDialogVisible$.next(true);
  }
  closeGrantPermissionDialog(): void {
    this.isGrantPermissionDialogVisible$.next(false);
    this.siteForGrantPermissionDialog$.next(null);
    this.restoreFocus();
  }

  openInstallExtensionDialog(site: Site): void {
    this.saveFocus();
    this.siteForInstallExtensionDialog$.next(site);
    this.isInstallExtensionDialogVisible$.next(true);
  }
  closeInstallExtensionDialog(): void {
    this.isInstallExtensionDialogVisible$.next(false);
    this.siteForInstallExtensionDialog$.next(null);
    this.restoreFocus();
  }

  openThirdPartyCookiesBlockedDialog(): void {
    this.saveFocus();
    this.isThirdPartyCookiesBlockedDialogVisible$.next(true);
  }
  closeThirdPartyCookiesBlockedDialog(): void {
    this.isThirdPartyCookiesBlockedDialogVisible$.next(false);
    this.restoreFocus();
  }
}

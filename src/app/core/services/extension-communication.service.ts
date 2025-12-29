import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const CustomEventToExtension = 'THE_CHANNEL_TO_EXTENSION';
const CustomEventFromExtension = 'THE_CHANNEL_FROM_EXTENSION';

export const MESSAGE_TYPES = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS',
  REQUEST_PERMISSION: 'THE_CHANNEL_REQUEST_PERMISSION',
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA',
  GET_UNREAD_STATUS: 'THE_CHANNEL_GET_UNREAD_STATUS',
  UNREAD_STATUS_DATA: 'THE_CHANNEL_UNREAD_STATUS_DATA',
  UNREAD_STATUS_UPDATE: 'THE_CHANNEL_UNREAD_STATUS_UPDATE',
  GET_MUTED_DOMAINS: 'THE_CHANNEL_GET_MUTED_DOMAINS',
  MUTED_DOMAINS_DATA: 'THE_CHANNEL_MUTED_DOMAINS_DATA',
  TOGGLE_MUTE_DOMAIN: 'THE_CHANNEL_TOGGLE_MUTE_DOMAIN',
  // --- סוג הודעה חדש ---
  SIDEBAR_ACTION: 'THE_CHANNEL_SIDEBAR_ACTION'
};

export interface AppSettings {
  categories: any[];
  sidebarCollapsed: boolean;
  collapsedCategories: Record<string, boolean>;
  removedDefaultSites?: string[];
  lastModified?: number;
}

export interface ExtensionSettingsResponse {
    settings: AppSettings | null;
    lastModified: number | null;
}

enum CommsChannel {
  NONE,
  DIRECT,
  IFRAME
}

@Injectable({
  providedIn: 'root'
})
export class ExtensionCommunicationService {
  private isExtensionActive = new BehaviorSubject<boolean>(false);
  isExtensionActive$ = this.isExtensionActive.asObservable();

  private unreadDomainsSubject = new BehaviorSubject<string[]>([]);
  unreadDomains$ = this.unreadDomainsSubject.asObservable();

  private mutedDomainsSubject = new BehaviorSubject<Set<string>>(new Set());
  mutedDomains$ = this.mutedDomainsSubject.asObservable();

  private settingsUpdateSubject = new BehaviorSubject<ExtensionSettingsResponse | null>(null);
  settingsUpdate$ = this.settingsUpdateSubject.asObservable();

  public get isExtensionActiveValue(): boolean {
    return this.isExtensionActive.value;
  }

  private settingsPromiseResolver: ((response: ExtensionSettingsResponse | null) => void) | null = null;
  private domainsPromiseResolver: ((domains: string[] | null) => void) | null = null;
  private readonly EXTENSION_RESPONSE_TIMEOUT = 1500;

  private activeChannel: CommsChannel = CommsChannel.NONE;

  constructor() {
    this.init();
  }

  private init(): void {
    window.addEventListener(CustomEventFromExtension, this.handleIncomingMessage.bind(this));
    window.addEventListener('message', this.handleIncomingMessage.bind(this));

    if (window.parent !== window) {
      this.activeChannel = CommsChannel.IFRAME;
      console.log('TheChannel: Iframe communication context detected.');
    } else {
      this.activeChannel = CommsChannel.DIRECT;
      console.log('TheChannel: Direct communication context detected.');
    }
  }

  private handleIncomingMessage(event: Event): void {
    let data: any;
    if (event instanceof CustomEvent && event.type === CustomEventFromExtension) {
      if (this.activeChannel !== CommsChannel.DIRECT) return;
      data = event.detail;
    } else if (event instanceof MessageEvent) {
      // כאן מתבצעת הקבלה של הודעות מההורה (כמו UNREAD_STATUS_UPDATE)
      // זה יעבוד גם במצב Standalone כל עוד ההורה שולח ל-Iframe
      if (this.activeChannel !== CommsChannel.IFRAME) return;
      if (event.origin !== 'https://mail.google.com' && !event.origin.includes('localhost')) return;
      data = event.data;
    } else {
      return;
    }

    const { type, payload } = data;

    if (type === MESSAGE_TYPES.EXTENSION_READY || type === MESSAGE_TYPES.SETTINGS_DATA) {
        if (!this.isExtensionActive.value) {
            console.log(`TheChannel: Extension confirmed active via message type '${type}'.`);
            this.isExtensionActive.next(true);
            this.requestUnreadStatus();
            this.requestMutedDomains();
        }
    }

    if (type === MESSAGE_TYPES.SETTINGS_DATA) {
      console.log('TheChannel: Received settings from extension.', payload);
      this.settingsUpdateSubject.next(payload);
      if (this.settingsPromiseResolver) {
        this.settingsPromiseResolver(payload);
        this.settingsPromiseResolver = null;
      }
    }

    if (type === MESSAGE_TYPES.MANAGED_DOMAINS_DATA) {
        console.log('TheChannel: Received managed domains from extension.', payload);
        if (this.domainsPromiseResolver) {
            this.domainsPromiseResolver(payload);
            this.domainsPromiseResolver = null;
        }
    }

    if (type === MESSAGE_TYPES.UNREAD_STATUS_DATA || type === MESSAGE_TYPES.UNREAD_STATUS_UPDATE) {
        if (Array.isArray(payload)) {
            this.unreadDomainsSubject.next(payload);
        }
    }

    if (type === MESSAGE_TYPES.MUTED_DOMAINS_DATA) {
        if (Array.isArray(payload)) {
            this.mutedDomainsSubject.next(new Set(payload));
        }
    }
  }

  private sendMessageToExtension(message: object): void {
    if (this.activeChannel === CommsChannel.DIRECT) {
      window.dispatchEvent(new CustomEvent(CustomEventToExtension, { detail: message }));
    } else if (this.activeChannel === CommsChannel.IFRAME) {
      window.parent.postMessage(message, '*');
    }
  }

  // --- פונקציה חדשה לדיווח על פעולות בסרגל ---
  public notifyParentSidebarAction(action: string, data: any): void {
    this.sendMessageToExtension({
      type: MESSAGE_TYPES.SIDEBAR_ACTION,
      payload: {
        action,
        data
      }
    });
  }
  // ------------------------------------------

  public requestUnreadStatus(): void {
    if (this.isExtensionActive.value) {
        this.sendMessageToExtension({ type: MESSAGE_TYPES.GET_UNREAD_STATUS });
    }
  }

  public requestMutedDomains(): void {
    if (this.isExtensionActive.value) {
        this.sendMessageToExtension({ type: MESSAGE_TYPES.GET_MUTED_DOMAINS });
    }
  }

  public toggleMuteDomain(domain: string): void {
    if (this.isExtensionActive.value) {
        this.sendMessageToExtension({
            type: MESSAGE_TYPES.TOGGLE_MUTE_DOMAIN,
            payload: { domain }
        });
    }
  }

  public requestSettingsFromExtension(): Promise<ExtensionSettingsResponse | null> {
    return new Promise((resolve) => {
      if (this.activeChannel === CommsChannel.NONE && !(window as any).theChannelExtensionActive) {
          this.isExtensionActive.next(false);
          return resolve(null);
      }
      this.settingsPromiseResolver = resolve;
      this.sendMessageToExtension({ type: MESSAGE_TYPES.APP_READY });
      setTimeout(() => {
        if (this.settingsPromiseResolver) {
          this.settingsPromiseResolver(null);
          this.settingsPromiseResolver = null;
          this.isExtensionActive.next(false);
        }
      }, this.EXTENSION_RESPONSE_TIMEOUT);
    });
  }

  public requestManagedDomains(): Promise<string[] | null> {
    return new Promise((resolve) => {
        if (!this.isExtensionActive.value) {
            return resolve(null);
        }
        this.domainsPromiseResolver = resolve;
        this.sendMessageToExtension({ type: MESSAGE_TYPES.GET_MANAGED_DOMAINS });
        setTimeout(() => {
            if (this.domainsPromiseResolver) {
                this.domainsPromiseResolver(null);
                this.domainsPromiseResolver = null;
            }
        }, this.EXTENSION_RESPONSE_TIMEOUT);
    });
  }

  public requestPermissionForDomain(domain: string, name: string): void {
    if (this.isExtensionActive.value) {
      console.log(`TheChannel: Requesting permission popup for site: ${name} (${domain})`);
      this.sendMessageToExtension({
        type: MESSAGE_TYPES.REQUEST_PERMISSION,
        payload: { domain, name }
      });
    } else {
      console.warn('TheChannel: Cannot request permission, extension not active.');
    }
  }

  public updateSettingsInExtension(settings: AppSettings): void {
    if (this.isExtensionActive.value) {
      this.sendMessageToExtension({
        type: MESSAGE_TYPES.SETTINGS_CHANGED,
        payload: {
            settings: {
                categories: settings.categories,
                sidebarCollapsed: settings.sidebarCollapsed,
                collapsedCategories: settings.collapsedCategories,
                removedDefaultSites: settings.removedDefaultSites
            },
            lastModified: settings.lastModified
        }
      });
    }
  }
}

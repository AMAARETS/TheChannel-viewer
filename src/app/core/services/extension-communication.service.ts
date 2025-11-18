import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const CustomEventToExtension = 'THE_CHANNEL_TO_EXTENSION';
const CustomEventFromExtension = 'THE_CHANNEL_FROM_EXTENSION';

export const MESSAGE_TYPES = {
  APP_READY: 'THE_CHANNEL_APP_READY',
  SETTINGS_CHANGED: 'THE_CHANNEL_SETTINGS_CHANGED',
  GET_MANAGED_DOMAINS: 'THE_CHANNEL_GET_MANAGED_DOMAINS', // <--- תיקון: שגיאת כתיב תוקנה
  EXTENSION_READY: 'THE_CHANNEL_EXTENSION_READY',
  SETTINGS_DATA: 'THE_CHANNEL_SETTINGS_DATA',
  MANAGED_DOMAINS_DATA: 'THE_CHANNEL_MANAGED_DOMAINS_DATA'
};

export interface AppSettings {
  categories: any[];
  sidebarCollapsed: boolean;
  collapsedCategories: Record<string, boolean>;
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

  // <--- תיקון: הוספת getter לגישה סינכרונית בטוחה
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
      if (this.activeChannel !== CommsChannel.IFRAME) return;
      if (event.origin !== 'https://mail.google.com') return;
      data = event.data;
    } else {
      return;
    }

    const { type, payload } = data;

    if (type === MESSAGE_TYPES.EXTENSION_READY || type === MESSAGE_TYPES.SETTINGS_DATA) {
        if (!this.isExtensionActive.value) {
            console.log(`TheChannel: Extension confirmed active via message type '${type}'.`);
            this.isExtensionActive.next(true);
        }
    }

    if (type === MESSAGE_TYPES.SETTINGS_DATA) {
      console.log('TheChannel: Received settings from extension.', payload);
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
  }

  private sendMessageToExtension(message: object): void {
    if (this.activeChannel === CommsChannel.DIRECT) {
      window.dispatchEvent(new CustomEvent(CustomEventToExtension, { detail: message }));
    } else if (this.activeChannel === CommsChannel.IFRAME) {
      window.parent.postMessage(message, 'https://mail.google.com');
    }
  }

  public requestSettingsFromExtension(): Promise<ExtensionSettingsResponse | null> {
    return new Promise((resolve) => {
      if (this.activeChannel === CommsChannel.NONE && !(window as any).theChannelExtensionActive) {
          this.isExtensionActive.next(false);
          return resolve(null);
      }
      this.settingsPromiseResolver = resolve;
      console.log("TheChannel: Requesting settings from extension...");
      this.sendMessageToExtension({ type: MESSAGE_TYPES.APP_READY });
      setTimeout(() => {
        if (this.settingsPromiseResolver) {
          console.log('TheChannel: Extension did not respond in time for settings.');
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
        console.log("TheChannel: Requesting managed domains from extension...");
        this.sendMessageToExtension({ type: MESSAGE_TYPES.GET_MANAGED_DOMAINS });
        setTimeout(() => {
            if (this.domainsPromiseResolver) {
                console.log('TheChannel: Extension did not respond in time for domains.');
                this.domainsPromiseResolver(null);
                this.domainsPromiseResolver = null;
            }
        }, this.EXTENSION_RESPONSE_TIMEOUT);
    });
  }

  public updateSettingsInExtension(settings: AppSettings): void {
    if (this.isExtensionActive.value) {
      console.log('TheChannel: Sending updated settings to extension.', settings);
      this.sendMessageToExtension({
        type: MESSAGE_TYPES.SETTINGS_CHANGED,
        payload: {
            settings: {
                categories: settings.categories,
                sidebarCollapsed: settings.sidebarCollapsed,
                collapsedCategories: settings.collapsedCategories
            },
            lastModified: settings.lastModified
        }
      });
    }
  }
}

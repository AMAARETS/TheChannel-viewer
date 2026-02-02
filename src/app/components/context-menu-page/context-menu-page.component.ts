import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuComponent, ContextMenuData } from '../sidebar/context-menu/context-menu';
import { SiteDataService } from '../../core/services/site-data.service';
import { ExtensionCommunicationService } from '../../core/services/extension-communication.service'; // ייבוא השירות
import { Category, Site } from '../../core/models/site.model';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-context-menu-page',
  standalone: true,
  imports: [CommonModule, ContextMenuComponent],
  template: `
    <div class="context-menu-page-container">
      <app-context-menu
        [isStandalone]="true"
        [menuData]="menuData"
        [allCategories]="(siteDataService.categories$ | async) || []"
        (editClicked)="onAction('Edit', $event)"
        (deleteClicked)="onAction('Delete', $event)"
        (copyLinkClicked)="onAction('Copy Link', $event)"
        (toggleMuteClicked)="onAction('Toggle Mute', $event)"
        (moveUpClicked)="onAction('Move Up', $event)"
        (moveDownClicked)="onAction('Move Down', $event)"
        (categoryChangeClicked)="onAction('Change Category', $event)"
        (newCategoryClicked)="onAction('New Category', $event)">
      </app-context-menu>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      background-color: transparent;
    }
    .context-menu-page-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 10px;
      height: 100%;
      box-sizing: border-box;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextMenuPageComponent implements OnInit {
  siteDataService = inject(SiteDataService);
  private extensionCommService = inject(ExtensionCommunicationService); // הזרקת שירות התקשורת
  private route = inject(ActivatedRoute);

  menuData: ContextMenuData = {
    site: { name: 'ערוץ לדוגמה', url: 'https://example.com', googleLoginSupported: false },
    category: { name: 'כללי', sites: [] },
    event: new MouseEvent('click'),
    isFirst: false,
    isLast: false,
    isMuted: false
  };

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['name'] && params['url']) {
        const site: Site = {
          name: params['name'],
          url: params['url'],
          googleLoginSupported: params['googleLogin'] === 'true'
        };
        const category: Category = {
           name: params['category'] || 'כללי',
           sites: []
        };

        this.menuData = {
          ...this.menuData,
          site: site,
          category: category,
          isFirst: params['isFirst'] === 'true', // קריאת פרמטרים נוספים אם קיימים
          isLast: params['isLast'] === 'true',
          isMuted: params['muted'] === 'true'
        };
      }
    });
  }

  onAction(actionName: string, payload: any) {
    // --- טיפול בפעולות מקומיות (ללא שליחה להורה) ---

    // 1. השתקת התראות
    if (actionName === 'Toggle Mute') {
      // payload הוא אובייקט Site
      this.siteDataService.toggleMuteForSite(payload);
      return;
    }

    // 2. הזז למעלה
    if (actionName === 'Move Up') {
      // payload: { site, fromCategory }
      this.siteDataService.moveSite(payload.site, payload.fromCategory.name, 'up');
      return;
    }

    // 3. הזז למטה
    if (actionName === 'Move Down') {
      // payload: { site, fromCategory }
      this.siteDataService.moveSite(payload.site, payload.fromCategory.name, 'down');
      return;
    }

    // 4. העבר לקטגוריה קיימת
    if (actionName === 'Change Category') {
      // payload: { site, fromCategory, toCategory }
      this.siteDataService.moveSiteToCategory(payload.site, payload.fromCategory.name, payload.toCategory.name);
      return;
    }

    // --- שליחת שאר הפעולות להורה (עריכה, מחיקה, קטגוריה חדשה, העתקת קישור) ---
    
    // מיפוי שם הפעולה מה-UI לסוג ההודעה בפרוטוקול
    let messageType = '';

    switch (actionName) {
      case 'Edit':
        messageType = 'EDIT_SITE';
        break;
      case 'Delete':
        messageType = 'DELETE_SITE';
        break;
      case 'Copy Link':
        messageType = 'COPY_LINK';
        break;
      case 'New Category':
        messageType = 'NEW_CATEGORY';
        break;
      default:
        console.warn('Unknown Context Menu Action:', actionName);
        return;
    }

    // שימוש בפונקציה בשירות לשליחת ההודעה להורה
    this.extensionCommService.notifyParentSidebarAction(messageType, payload);
  }
}
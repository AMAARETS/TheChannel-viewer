import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuComponent, ContextMenuData } from '../sidebar/context-menu/context-menu';
import { SiteDataService } from '../../core/services/site-data.service';
import { Category, Site } from '../../core/models/site.model';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-context-menu-page',
  standalone: true,
  imports: [CommonModule, ContextMenuComponent],
  template: `
    <div class="context-menu-page-container">
      <!-- כאן אנו מציגים את התפריט במצב עצמאי -->
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
      background-color: transparent; /* שקוף כדי להשתלב בתוך Iframe או Extension */
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
  private route = inject(ActivatedRoute);

  // נתונים ראשוניים (Placeholder) עד שהנתונים האמיתיים יגיעו או ברירת מחדל
  menuData: ContextMenuData = {
    site: { name: 'ערוץ לדוגמה', url: 'https://example.com', googleLoginSupported: false },
    category: { name: 'כללי', sites: [] },
    event: new MouseEvent('click'), // אירוע פיקטיבי, לא בשימוש במצב עצמאי
    isFirst: false,
    isLast: false,
    isMuted: false
  };

  ngOnInit() {
    // אופציונלי: קריאת פרמטרים מה-URL כדי להציג תפריט עבור אתר ספציפי
    // דוגמה: /context-menu?name=MySite&url=...
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
          isMuted: params['muted'] === 'true'
        };
      }
    });
  }

  onAction(actionName: string, payload: any) {
    console.log(`Context Menu Action: ${actionName}`, payload);
    // כאן ניתן להוסיף לוגיקה לתקשורת עם ה-Extension או חלון האב
    // למשל: window.parent.postMessage({ type: actionName, payload }, '*');
  }
}

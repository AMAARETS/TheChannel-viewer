import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
import { SiteDataService } from '../../core/services/site-data.service';

@Component({
  selector: 'app-sidebar-page',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  template: `
    <div class="sidebar-page-container">
      <app-sidebar [isStandalone]="true"></app-sidebar>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      height: 100%;
      background-color: transparent;
    }
    .sidebar-page-container {
      height: 100%;
      display: flex;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarPageComponent implements OnInit {
  // מוודאים שהנתונים נטענים גם כשנכנסים ישירות לדף זה
  private siteDataService = inject(SiteDataService);

  ngOnInit() {
    // השירות כבר מאותחל ב-root, אך אם יש לוגיקה ספציפית לניתוק קשרים, היא תבוא כאן.
    // מכיוון שה-SiteDataService הוא Singleton ונטען ב-Root, הנתונים יהיו זמינים.
  }
}

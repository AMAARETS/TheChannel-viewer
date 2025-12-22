import { Component, Input, Output, EventEmitter, Renderer2, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Site, Category } from '../../../core/models/site.model';

export interface ContextMenuData {
  site: Site;
  category: Category;
  event: MouseEvent;
  isFirst: boolean;
  isLast: boolean;
  isMuted: boolean; // שדה חדש
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextMenuComponent implements OnChanges, OnDestroy {
  @Input() menuData: ContextMenuData | null = null;
  @Input() allCategories: Category[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() editClicked = new EventEmitter<{ site: Site, category: Category }>();
  @Output() deleteClicked = new EventEmitter<Site>();
  @Output() categoryChangeClicked = new EventEmitter<{ site: Site, fromCategory: Category, toCategory: Category }>();
  @Output() newCategoryClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveUpClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveDownClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() copyLinkClicked = new EventEmitter<{ site: Site, category: Category }>();
  // אירוע חדש ללחיצה על השתק/בטל השתקה
  @Output() toggleMuteClicked = new EventEmitter<Site>();

  position = { top: '0px', left: '0px', bottom: 'auto' };
  isOpeningUp = false;
  private globalClickListener: (() => void) | null = null;

  constructor(private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['menuData'] && this.menuData) {
      this.calculatePosition(this.menuData.event);
      if (!this.globalClickListener) {
        this.globalClickListener = this.renderer.listen('document', 'click', () => {
          this.close();
        });
      }
    } else if (!this.menuData) {
      this.removeGlobalListener();
    }
  }

  ngOnDestroy(): void {
    this.removeGlobalListener();
  }

  private removeGlobalListener(): void {
    if (this.globalClickListener) {
      this.globalClickListener();
      this.globalClickListener = null;
    }
  }

  private calculatePosition(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const MENU_ESTIMATED_HEIGHT = 280; // הוגדל מעט בגלל הכפתור הנוסף
    const MENU_ESTIMATED_WIDTH = 150; // רוחב משוער של התפריט
    const OFFSET_FROM_BUTTON = 25; // מרווח נוסף לשמאל מסוף הכפתור

    // חישוב מיקום אופקי - התפריט יפתח לשמאל עם מרווח
    const leftPosition = rect.right - MENU_ESTIMATED_WIDTH - OFFSET_FROM_BUTTON;

    // חישוב מיקום אנכי - השליש העליון של התפריט מול אמצע הכפתור
    const buttonCenterY = rect.top + (rect.height / 2);
    const menuThirdHeight = MENU_ESTIMATED_HEIGHT / 3;
    let topPosition = buttonCenterY - menuThirdHeight;

    // בדיקה אם התפריט חורג מהחלק העליון של המסך
    if (topPosition < 0) {
      topPosition = 10; // מרווח קטן מהחלק העליון
    }

    // בדיקה אם התפריט חורג מהחלק התחתון של המסך (לפי גובה העמוד כולו)
    if (topPosition + MENU_ESTIMATED_HEIGHT > viewportHeight) {
      // רק אם באמת אין מקום, נזיז את התפריט למעלה
      const availableSpace = viewportHeight - rect.bottom;
      if (availableSpace < 50) { // אם יש פחות מ-50 פיקסלים מתחת לכפתור
        const overflow = (topPosition + MENU_ESTIMATED_HEIGHT) - viewportHeight;
        topPosition = topPosition - overflow - 10;
      }
    }

    // עדכון המיקום
    this.position = {
      top: `${topPosition}px`,
      bottom: 'auto',
      left: `${leftPosition}px`
    };

    // עדכון הסטטוס של פתיחה למעלה
    this.isOpeningUp = topPosition < buttonCenterY - menuThirdHeight;
  }

  close(): void {
    this.closed.emit();
  }

  onEdit(site: Site, category: Category, event: Event): void {
    event.stopPropagation();
    this.editClicked.emit({ site, category });
  }

  onDelete(site: Site, event: Event): void {
    event.stopPropagation();
    this.deleteClicked.emit(site);
  }

  onCopyLink(site: Site, category: Category, event: Event): void {
    event.stopPropagation();
    this.copyLinkClicked.emit({ site, category });
  }

  // פונקציה חדשה לטיפול בהשתקה
  onToggleMute(site: Site, event: Event): void {
    event.stopPropagation();
    this.toggleMuteClicked.emit(site);
  }

  onChangeCategory(site: Site, fromCategory: Category, toCategory: Category): void {
    this.categoryChangeClicked.emit({ site, fromCategory, toCategory });
  }

  onNewCategory(site: Site, fromCategory: Category): void {
    this.newCategoryClicked.emit({ site, fromCategory });
  }

  onMoveUp(site: Site, fromCategory: Category, event: Event): void {
    event.stopPropagation();
    if (this.menuData?.isFirst) return;
    this.moveUpClicked.emit({ site, fromCategory });
  }

  onMoveDown(site: Site, fromCategory: Category, event: Event): void {
    event.stopPropagation();
    if (this.menuData?.isLast) return;
    this.moveDownClicked.emit({ site, fromCategory });
  }
}

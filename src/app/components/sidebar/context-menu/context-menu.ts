import { Component, Input, Output, EventEmitter, Renderer2, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Site, Category } from '../../../core/models/site.model';

export interface ContextMenuData {
  site: Site;
  category: Category;
  event: MouseEvent;
  isFirst: boolean;
  isLast: boolean;
  isMuted: boolean;
}

type MenuView = 'main' | 'categories';

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
  @Input() isStandalone = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editClicked = new EventEmitter<{ site: Site, category: Category }>();
  @Output() deleteClicked = new EventEmitter<Site>();
  @Output() categoryChangeClicked = new EventEmitter<{ site: Site, fromCategory: Category, toCategory: Category }>();
  @Output() newCategoryClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveUpClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveDownClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() copyLinkClicked = new EventEmitter<{ site: Site, category: Category }>();
  @Output() toggleMuteClicked = new EventEmitter<Site>();

  position = { top: '0px', left: '0px', bottom: 'auto' };
  isOpeningUp = false;
  currentView: MenuView = 'main';

  private globalClickListener: (() => void) | null = null;

  constructor(
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['menuData']) {
      if (this.menuData) {
        this.currentView = 'main';

        // אם אנחנו במצב רגיל (לא עצמאי), נחשב מיקום ונאזין לקליקים בחוץ
        if (!this.isStandalone) {
          this.calculatePosition(this.menuData.event);
          this.attachGlobalListener();
        } else {
          this.removeGlobalListener();
        }
      } else {
        this.removeGlobalListener();
      }
    }
  }

  ngOnDestroy(): void {
    this.removeGlobalListener();
  }

  showCategories(): void {
    this.currentView = 'categories';
    this.cdr.markForCheck();
  }

  showMain(): void {
    this.currentView = 'main';
    this.cdr.markForCheck();
  }

  private attachGlobalListener(): void {
    this.removeGlobalListener();

    // שימוש ב-setTimeout כדי למנוע מהקליק שפתח את התפריט לסגור אותו מיד
    setTimeout(() => {
      if (this.menuData && !this.globalClickListener) {
        this.globalClickListener = this.renderer.listen('document', 'click', (event: Event) => {
          // בדיקה שהקליק לא היה בתוך התפריט עצמו (אם propagation לא עבד)
          const target = event.target as HTMLElement;
          if (!target.closest('.context-menu')) {
            this.close();
          }
        });
      }
    }, 0);
  }

  private removeGlobalListener(): void {
    if (this.globalClickListener) {
      this.globalClickListener();
      this.globalClickListener = null;
    }
  }

  private calculatePosition(event: MouseEvent): void {
    if (!event || !event.target) return;

    // שימוש ב-target כברירת מחדל אם currentTarget אבד (קורה ב-async events)
    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    const rect = targetElement.getBoundingClientRect();

    const viewportHeight = window.innerHeight;
    const MENU_ESTIMATED_HEIGHT = 280;
    const MENU_ESTIMATED_WIDTH = 150;
    const OFFSET_FROM_BUTTON = 25;

    const leftPosition = rect.right - MENU_ESTIMATED_WIDTH - OFFSET_FROM_BUTTON;
    const buttonCenterY = rect.top + (rect.height / 2);
    const menuThirdHeight = MENU_ESTIMATED_HEIGHT / 3;

    let topPosition = buttonCenterY - menuThirdHeight;

    // תיקון גלישה מלמעלה
    if (topPosition < 10) {
      topPosition = 10;
    }

    // תיקון גלישה מלמטה
    if (topPosition + MENU_ESTIMATED_HEIGHT > viewportHeight) {
      const availableSpace = viewportHeight - rect.bottom;
      // אם אין מקום למטה, ננסה למקם מעל
      if (availableSpace < 50) {
        const overflow = (topPosition + MENU_ESTIMATED_HEIGHT) - viewportHeight;
        topPosition = topPosition - overflow - 10;
      }
    }

    this.position = {
      top: `${topPosition}px`,
      bottom: 'auto',
      left: `${leftPosition}px`
    };

    this.isOpeningUp = topPosition < buttonCenterY - menuThirdHeight;
    this.cdr.markForCheck(); // עדכון התצוגה
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

import { Component, Input, Output, EventEmitter, Renderer2, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Site, Category } from '../../../core/models/site.model';

export interface ContextMenuData {
  site: Site;
  category: Category;
  event: MouseEvent; // במצב עצמאי זה יכול להיות null או מדומה
  isFirst: boolean;
  isLast: boolean;
  isMuted: boolean;
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
  @Input() isStandalone = false; // שדה חדש למצב עצמאי

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
  private globalClickListener: (() => void) | null = null;

  constructor(private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['menuData'] && this.menuData) {
      // אם זה לא מצב עצמאי, חשב מיקום והאזן לקליקים בחוץ
      if (!this.isStandalone) {
        this.calculatePosition(this.menuData.event);
        if (!this.globalClickListener) {
          this.globalClickListener = this.renderer.listen('document', 'click', () => {
            this.close();
          });
        }
      } else {
        // במצב עצמאי, הסר מאזינים אם היו
        this.removeGlobalListener();
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
    if (!event || !event.currentTarget) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const MENU_ESTIMATED_HEIGHT = 280;
    const MENU_ESTIMATED_WIDTH = 150;
    const OFFSET_FROM_BUTTON = 25;

    const leftPosition = rect.right - MENU_ESTIMATED_WIDTH - OFFSET_FROM_BUTTON;
    const buttonCenterY = rect.top + (rect.height / 2);
    const menuThirdHeight = MENU_ESTIMATED_HEIGHT / 3;
    let topPosition = buttonCenterY - menuThirdHeight;

    if (topPosition < 0) {
      topPosition = 10;
    }

    if (topPosition + MENU_ESTIMATED_HEIGHT > viewportHeight) {
      const availableSpace = viewportHeight - rect.bottom;
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

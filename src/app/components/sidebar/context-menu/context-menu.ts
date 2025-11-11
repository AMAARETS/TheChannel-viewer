import { Component, Input, Output, EventEmitter, Renderer2, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Site, Category } from '../../../core/models/site.model';

export interface ContextMenuData {
  site: Site;
  category: Category;
  event: MouseEvent;
  isFirst: boolean;
  isLast: boolean;
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
  @Output() deleteClicked = new EventEmitter<Site>();
  @Output() categoryChangeClicked = new EventEmitter<{ site: Site, fromCategory: Category, toCategory: Category }>();
  @Output() newCategoryClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveUpClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  @Output() moveDownClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();
  // IMPROVEMENT 2: Add new event emitter for copy link
  @Output() copyLinkClicked = new EventEmitter<{ site: Site, category: Category }>();

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
    const MENU_ESTIMATED_HEIGHT = 250;

    this.isOpeningUp = (rect.bottom + MENU_ESTIMATED_HEIGHT > viewportHeight);

    if (this.isOpeningUp) {
      this.position = {
        top: 'auto',
        bottom: `${viewportHeight - rect.top}px`,
        left: `${rect.left}px`
      };
    } else {
      this.position = {
        top: `${rect.bottom}px`,
        bottom: 'auto',
        left: `${rect.left}px`
      };
    }
  }

  close(): void {
    this.closed.emit();
  }

  onDelete(site: Site, event: Event): void {
    event.stopPropagation();
    this.deleteClicked.emit(site);
  }

  // IMPROVEMENT 2: Add handler for copy link click
  onCopyLink(site: Site, category: Category, event: Event): void {
    event.stopPropagation();
    this.copyLinkClicked.emit({ site, category });
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

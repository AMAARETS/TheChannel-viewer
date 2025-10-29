import { Component, Input, Output, EventEmitter, Renderer2, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Site, Category } from '../../../core/models/site.model';

export interface ContextMenuData {
  site: Site;
  category: Category;
  event: MouseEvent;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.css'
})
export class ContextMenuComponent implements OnChanges, OnDestroy {
  @Input() menuData: ContextMenuData | null = null;
  @Input() allCategories: Category[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() deleteClicked = new EventEmitter<Site>();
  @Output() categoryChangeClicked = new EventEmitter<{ site: Site, fromCategory: Category, toCategory: Category }>();
  @Output() newCategoryClicked = new EventEmitter<{ site: Site, fromCategory: Category }>();

  position = { top: '0px', left: '0px', bottom: 'auto' };
  isOpeningUp = false;
  private globalClickListener: (() => void) | null = null;

  constructor(private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['menuData'] && this.menuData) {
      this.calculatePosition(this.menuData.event);
      // We need to listen for clicks outside the component to close it
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
      this.globalClickListener(); // This invokes the function returned by renderer.listen, which unregisters the listener
      this.globalClickListener = null;
    }
  }

  private calculatePosition(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const MENU_ESTIMATED_HEIGHT = 250; // Rough estimate for menu + submenu

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

  // --- START OF FIX ---
  // Changed the type of 'event' from MouseEvent to the more generic Event
  onDelete(site: Site, event: Event): void {
  // --- END OF FIX ---
    event.stopPropagation();
    this.deleteClicked.emit(site);
  }

  onChangeCategory(site: Site, fromCategory: Category, toCategory: Category): void {
    this.categoryChangeClicked.emit({ site, fromCategory, toCategory });
  }

  onNewCategory(site: Site, fromCategory: Category): void {
    this.newCategoryClicked.emit({ site, fromCategory });
  }
}

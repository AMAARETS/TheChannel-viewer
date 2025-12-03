import { Component, Input, OnInit, inject, ChangeDetectionStrategy, OnChanges, SimpleChanges, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpComponent implements OnInit, OnChanges {
  @Input() initialSection: string | null = 'extension';
  activeSection = 'extension';

  private uiStateService = inject(UiStateService);
  private elementRef = inject(ElementRef);

  ngOnInit() {
    if (this.initialSection) {
      this.activeSection = this.initialSection;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialSection'] && changes['initialSection'].currentValue) {
      this.setActiveSection(changes['initialSection'].currentValue);
    }
  }

  setActiveSection(section: string) {
    this.activeSection = section;
    // עדכון ה-URL כדי לשקף את המצב הנוכחי
    this.uiStateService.updateHelpUrl(section);

    // גלילה לראש הקומפוננטה
    this.elementRef.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  navigateToContact() {
    this.uiStateService.loadCustomContentFromSource('contact');
  }
}

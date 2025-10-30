import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBarComponent {
  @Input() isExpanded = true;
  @Output() searchChanged = new EventEmitter<string>();
  @Output() expandAndFocus = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchChanged.emit(term);
  }

  onExpandClick(): void {
    this.expandAndFocus.emit();
  }

  public focus(): void {
    this.searchInput.nativeElement.focus();
  }

  public clearSearch(): void {
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    this.searchChanged.emit('');
  }
}

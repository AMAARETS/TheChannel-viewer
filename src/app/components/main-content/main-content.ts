import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-main-content',
  standalone: true,
  // אין יותר צורך ב-ReactiveFormsModule
  imports: [CommonModule],
  templateUrl: './main-content.html',
  styleUrl: './main-content.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainContentComponent {
  uiStateService = inject(UiStateService);

  selectedSiteUrl$ = this.uiStateService.sanitizedSelectedSiteUrl$;
  activeView$ = this.uiStateService.activeView$;
  sanitizedCustomContent$ = this.uiStateService.sanitizedCustomContent$;

  // --- כל הלוגיקה של טופס צור הקשר הוסרה מכאן ---
}

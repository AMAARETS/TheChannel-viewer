import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-content.html',
  styleUrl: './main-content.css'
})
export class MainContentComponent {
  uiStateService = inject(UiStateService);
  selectedSiteUrl$ = this.uiStateService.sanitizedSelectedSiteUrl$;
}

import { Component, inject, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { UiStateService } from '../../core/services/ui-state.service';
import { Observable, map } from 'rxjs'; // <--- תיקון: ייבוא של map
import { Site } from '../../core/models/site.model';

@Component({
  selector: 'app-grant-permission-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './grant-permission-dialog.html',
  styleUrl: './grant-permission-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GrantPermissionDialogComponent implements AfterViewChecked {
  uiStateService = inject(UiStateService);

  isVisible$ = this.uiStateService.isGrantPermissionDialogVisible$;
  site$: Observable<Site | null> = this.uiStateService.siteForGrantPermissionDialog$;

  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private isVisible = false;

  ngAfterViewChecked(): void {
    const isDialogVisible = this.uiStateService.isGrantPermissionDialogVisible$.getValue();
    if (isDialogVisible && !this.isVisible) {
      setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
    }
    this.isVisible = isDialogVisible;
  }

  get siteDomain$(): Observable<string | null> {
    return this.site$.pipe(
      map(site => site ? new URL(site.url).hostname : null)
    );
  }

  closeDialog(): void {
    this.uiStateService.closeGrantPermissionDialog();
  }
}

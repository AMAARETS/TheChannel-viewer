import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  isVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastState = new BehaviorSubject<ToastState>({
    message: '',
    type: 'info',
    isVisible: false
  });

  toastState$: Observable<ToastState> = this.toastState.asObservable();

  show(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000): void {
    this.toastState.next({ message, type, isVisible: true });

    timer(duration).pipe(
      tap(() => this.hide())
    ).subscribe();
  }

  hide(): void {
    this.toastState.next({ ...this.toastState.value, isVisible: false });
  }
}

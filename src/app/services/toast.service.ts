import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly message$ = new BehaviorSubject<string | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  get message(): Observable<string | null> {
    return this.message$.asObservable();
  }

  show(text: string, durationMs = 3000): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.message$.next(text);
    this.hideTimer = setTimeout(() => {
      this.message$.next(null);
      this.hideTimer = null;
    }, durationMs);
  }
}

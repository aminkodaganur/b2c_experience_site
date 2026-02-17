import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'b2c_account_id';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private accountId: string | null = null;
  private readonly accountId$ = new BehaviorSubject<string | null>(null);

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.accountId = stored;
        this.accountId$.next(stored);
      }
    } catch {
      // ignore
    }
  }

  /** Current account id (Salesforce Account Id). */
  getAccountId(): string | null {
    return this.accountId;
  }

  /** Observable of current account id. */
  get accountIdObservable(): Observable<string | null> {
    return this.accountId$.asObservable();
  }

  /** Whether user is considered logged in (has account id). */
  isLoggedIn(): boolean {
    return this.accountId != null && this.accountId.length > 0;
  }

  /** Store account id after registration. */
  setAccountId(id: string): void {
    this.accountId = id;
    this.accountId$.next(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  /** Clear account id (e.g. logout). */
  clear(): void {
    this.accountId = null;
    this.accountId$.next(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

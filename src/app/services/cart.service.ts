import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { SalesforceApiService } from './salesforce-api.service';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private readonly count$ = new BehaviorSubject<number>(0);
  /** Observable of total item count (for header badge). */
  get cartCount$(): Observable<number> {
    return this.count$.asObservable();
  }
  /** Salesforce cart id from place API (set after first add to cart). */
  private salesforceCartId: string | null = null;

  constructor(private salesforceApi: SalesforceApiService) {}

  getItems(): CartItem[] {
    return [...this.items];
  }

  /** Adds item via Salesforce place API, then updates local cart. Uses product's priceBookEntryId and priceBookId when provided. */
  addItem(
    id: string,
    name: string,
    price: number,
    quantity = 1,
    priceBookEntryId?: string,
    priceBookId?: string
  ): Observable<void> {
    return this.salesforceApi
      .placeAddToCart(this.salesforceCartId, id, quantity, price, priceBookEntryId, priceBookId)
      .pipe(
      tap(({ cartId }) => {
        this.salesforceCartId = cartId;
        const existing = this.items.find((i) => i.id === id);
        if (existing) {
          existing.quantity += quantity;
        } else {
          this.items.push({ id, name, price, quantity });
        }
        this.count$.next(this.totalCount);
      }),
        map(() => undefined)
      );
  }

  removeItem(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.count$.next(this.totalCount);
  }

  updateQuantity(id: string, quantity: number): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      if (quantity < 1) this.removeItem(id);
      else item.quantity = quantity;
      this.count$.next(this.totalCount);
    }
  }

  get totalCount(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  get subtotal(): number {
    return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  clear(): void {
    this.items = [];
    this.salesforceCartId = null;
    this.count$.next(0);
  }
}

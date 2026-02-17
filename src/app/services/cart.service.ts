import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, tap } from 'rxjs';
import { SalesforceApiService, CartItemNode } from './salesforce-api.service';

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

  /** Current Salesforce cart id (for loading cart from GraphQL). */
  getCartId(): string | null {
    return this.salesforceCartId;
  }

  /** Fetches cart items from GraphQL as a parent-child tree. Returns empty array if no cart. */
  getCartItemsFromGraphQL(): Observable<CartItemNode[]> {
    if (!this.salesforceCartId) return of([]);
    return this.salesforceApi.getCartItems(this.salesforceCartId);
  }

  getItems(): CartItem[] {
    return [...this.items];
  }

  /** Adds item via Salesforce place API, then updates local cart. Uses product's priceBookEntryId and priceBookId when provided. Pass subscriptionOptions when product is not one-time to add subscription child CartItem. */
  addItem(
    id: string,
    name: string,
    price: number,
    quantity = 1,
    priceBookEntryId?: string,
    priceBookId?: string,
    subscriptionOptions?: { sellingModelType: string; pricingTerm: number }
  ): Observable<void> {
    return this.salesforceApi
      .placeAddToCart(this.salesforceCartId, id, quantity, price, priceBookEntryId, priceBookId, subscriptionOptions)
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

  /**
   * Removes a cart item by CartItem id. When a Salesforce cart exists, calls place API (CartItem DELETE).
   * Returns Observable so caller can refetch or handle errors. Use for GraphQL cart (node.id is CartItem id).
   */
  removeCartItem(cartItemId: string): Observable<void> {
    if (this.salesforceCartId) {
      return this.salesforceApi.placeDeleteCartItem(this.salesforceCartId, cartItemId).pipe(map(() => undefined));
    }
    return of(undefined);
  }

  /**
   * Removes an item by product id from local list only (no API). Use for fallback cart when not using GraphQL.
   */
  removeItemLocal(productId: string): void {
    this.items = this.items.filter((i) => i.id !== productId);
    this.count$.next(this.totalCount);
  }

  updateQuantity(id: string, quantity: number): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      if (quantity < 1) {
        this.items = this.items.filter((i) => i.id !== id);
      } else {
        item.quantity = quantity;
      }
      this.count$.next(this.totalCount);
    }
  }

  /**
   * Updates cart item quantity by CartItem id. When a Salesforce cart exists, calls place API (CartItem PATCH).
   * Returns Observable so caller can refetch or handle errors. Use for GraphQL cart (node.id is CartItem id).
   */
  updateCartItemQuantity(cartItemId: string, quantity: number): Observable<void> {
    if (this.salesforceCartId) {
      return this.salesforceApi.placeUpdateCartItemQuantity(this.salesforceCartId, cartItemId, quantity).pipe(map(() => undefined));
    }
    return of(undefined);
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

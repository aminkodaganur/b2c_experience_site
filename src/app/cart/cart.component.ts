import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';
import { AccountService } from '../services/account.service';
import { CartItemNode } from '../services/salesforce-api.service';

/** Flatten tree for display with depth (0 = root, 1 = child, ...). */
function flattenWithDepth(nodes: CartItemNode[], depth = 0): { node: CartItemNode; depth: number }[] {
  const out: { node: CartItemNode; depth: number }[] = [];
  nodes.forEach((node) => {
    out.push({ node, depth });
    if (node.children?.length) out.push(...flattenWithDepth(node.children, depth + 1));
  });
  return out;
}

function nodeSubtotal(node: CartItemNode): number {
  const price = node.salesPrice ?? 0;
  const qty = node.quantity ?? 1;
  let sum = price * qty;
  node.children?.forEach((c) => (sum += nodeSubtotal(c)));
  return sum;
}

function totalFromTree(nodes: CartItemNode[]): number {
  return nodes.reduce((s, n) => s + nodeSubtotal(n), 0);
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  cartItems: CartItemNode[] = [];
  loading = true;
  error: string | null = null;
  /** Cart item id currently being removed (disables that row's remove button). */
  removingId: string | null = null;
  /** Cart item id currently having quantity updated (disables that row's qty input). */
  updatingId: string | null = null;
  /** Parent cart item ids that are expanded (children visible). */
  expandedParentIds = new Set<string>();

  constructor(
    public cart: CartService,
    private account: AccountService,
    private router: Router
  ) {}

  goToCheckout(): void {
    if (this.account.isLoggedIn()) {
      this.router.navigate(['/payment']);
    } else {
      this.router.navigate(['/register']);
    }
  }

  isExpanded(parentId: string): boolean {
    return this.expandedParentIds.has(parentId);
  }

  toggleExpand(parentId: string): void {
    if (this.expandedParentIds.has(parentId)) {
      this.expandedParentIds.delete(parentId);
    } else {
      this.expandedParentIds.add(parentId);
    }
    this.expandedParentIds = new Set(this.expandedParentIds);
  }

  ngOnInit(): void {
    this.loadCartItems();
  }

  loadCartItems(): void {
    this.loading = true;
    this.error = null;
    this.cart.getCartItemsFromGraphQL().subscribe({
      next: (tree) => {
        this.cartItems = tree;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message ?? 'Failed to load cart.';
        this.cartItems = [];
        this.loading = false;
      }
    });
  }

  get items() {
    return this.cart.getItems();
  }

  /** Flattened list with depth for template (GraphQL cart tree). */
  get flattenedCartItems(): { node: CartItemNode; depth: number }[] {
    return flattenWithDepth(this.cartItems);
  }

  /** Total item count for header (GraphQL rows or fallback items). */
  get itemCount(): number {
    if (this.cartItems.length > 0) return this.flattenedCartItems.length;
    return this.items.length;
  }

  get subtotal(): number {
    if (this.cartItems.length > 0) return totalFromTree(this.cartItems);
    return this.cart.subtotal;
  }

  get total(): number {
    return this.subtotal;
  }

  /** Subtotal for a single row (price * quantity), not including children. */
  rowSubtotal(node: CartItemNode): number {
    return (node.salesPrice ?? 0) * (node.quantity ?? 1);
  }

  /** Remove from GraphQL cart (calls place API, then refetches). */
  remove(cartItemId: string): void {
    this.removingId = cartItemId;
    this.error = null;
    this.cart.removeCartItem(cartItemId).subscribe({
      next: () => {
        this.removingId = null;
        this.loadCartItems();
      },
      error: (err) => {
        this.removingId = null;
        this.error = err?.message ?? 'Failed to remove item.';
      }
    });
  }

  /** Remove from local fallback cart only. */
  removeLocal(productId: string): void {
    this.cart.removeItemLocal(productId);
  }

  /** Update quantity in GraphQL cart (calls place API, then refetches). */
  updateQty(cartItemId: string, quantity: number): void {
    const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
    this.updatingId = cartItemId;
    this.error = null;
    this.cart.updateCartItemQuantity(cartItemId, qty).subscribe({
      next: () => {
        this.updatingId = null;
        this.loadCartItems();
      },
      error: (err) => {
        this.updatingId = null;
        this.error = err?.message ?? 'Failed to update quantity.';
      }
    });
  }

  /** Update quantity in local fallback cart only. */
  updateQtyLocal(productId: string, quantity: number): void {
    const qty = Math.max(1, Math.floor(Number(quantity)) || 1);
    this.cart.updateQuantity(productId, qty);
  }
}

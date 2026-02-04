import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SalesforceApiService, ProductListItem } from '../services/salesforce-api.service';

@Component({
  selector: 'app-product-listing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-listing.component.html',
  styleUrl: './product-listing.component.scss'
})
export class ProductListingComponent implements OnInit {
  categoryId: string | null = null;
  products: ProductListItem[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private salesforceApi: SalesforceApiService
  ) {
    this.route.queryParams.subscribe(p => this.categoryId = p['categoryId'] || null);
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.salesforceApi.getProducts(100).subscribe({
      next: (list) => {
        this.products = list;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load products from Salesforce.';
        this.products = [];
        this.loading = false;
      }
    });
  }

  get filteredProducts(): ProductListItem[] {
    if (!this.categoryId) return this.products;
    const catNum = Number(this.categoryId);
    if (Number.isNaN(catNum)) return this.products;
    return this.products.filter(p => p.categoryId === catNum);
  }

  updateQuantity(product: ProductListItem, delta: number): void {
    const newQty = product.quantity + delta;
    product.quantity = Math.max(1, Math.min(99, newQty));
  }

  clampQuantity(product: ProductListItem): void {
    const q = Number(product.quantity);
    if (isNaN(q) || q < 1) product.quantity = 1;
    else if (q > 99) product.quantity = 99;
    else product.quantity = Math.floor(q);
  }
}

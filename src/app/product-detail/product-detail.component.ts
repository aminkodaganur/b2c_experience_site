import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil, combineLatest, map } from 'rxjs';
import { SalesforceApiService, ProductDetail } from '../services/salesforce-api.service';
import { environment } from '../../environments/environment';

type StaticProduct = { id: number; name: string; price: number; description: string };

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnDestroy {
  id: string | null = null;
  product: ProductDetail | StaticProduct | null = null;
  loading = false;
  error: string | null = null;
  private readonly destroy$ = new Subject<void>();

  staticProducts: Record<number, StaticProduct> = {
    1: { id: 1, name: 'Wireless Headphones', price: 49.99, description: 'Noise-cancelling over-ear headphones with 20h battery.' },
    2: { id: 2, name: 'Laptop Stand', price: 29.99, description: 'Adjustable aluminum stand for better ergonomics.' },
    3: { id: 3, name: 'Cotton T-Shirt', price: 19.99, description: '100% organic cotton, unisex fit.' },
    4: { id: 4, name: 'Garden Chair', price: 79.99, description: 'Weather-resistant outdoor folding chair.' },
    5: { id: 5, name: 'Yoga Mat', price: 24.99, description: 'Non-slip, eco-friendly mat with carry strap.' }
  };

  constructor(private route: ActivatedRoute, private salesforceApi: SalesforceApiService) {
    combineLatest([
      this.route.params,
      this.route.queryParams,
    ]).pipe(
      takeUntil(this.destroy$),
      map(([params, queryParams]) => ({
        id: params['id'] ?? null,
        catalogId: queryParams['catalogId'] as string | undefined,
        priceBookId: queryParams['priceBookId'] as string | undefined,
      }))
    ).subscribe(({ id, catalogId, priceBookId }) => {
      this.id = id;
      this.error = null;
      this.product = null;
      if (!this.id) return;

      const numId = Number(this.id);
      if (!Number.isNaN(numId) && this.staticProducts[numId]) {
        this.product = this.staticProducts[numId];
        return;
      }

      const fromCache = this.salesforceApi.getProductById(this.id);
      const catalogIdToUse =
        catalogId ?? fromCache?.catalogId ?? (environment.salesforce as { catalogId?: string }).catalogId ?? '';
      const priceBookIdToUse =
        priceBookId ?? fromCache?.priceBookId ?? (environment.salesforce as { priceBookId?: string }).priceBookId ?? '';
      if (!catalogIdToUse || !priceBookIdToUse) {
        this.error = 'Product context (catalog / price book) is missing. Open this product from the product list.';
        return;
      }

      this.loading = true;
      this.salesforceApi.getProductDetails(this.id, catalogIdToUse, priceBookIdToUse).pipe(takeUntil(this.destroy$)).subscribe({
        next: (detail) => {
          this.product = detail;
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.message ?? 'Failed to load product details.';
          this.loading = false;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get productPrice(): number {
    return this.product && 'price' in this.product ? this.product.price : 0;
  }

  get productImageUrl(): string | undefined {
    return this.product && 'imageUrl' in this.product ? (this.product as ProductDetail).imageUrl : undefined;
  }

  get hasImage(): boolean {
    const url = this.productImageUrl;
    return !!url && url.length > 0;
  }

  get productImageError(): boolean {
    const p = this.product as ProductDetail | undefined;
    return !!(p && 'imageError' in p && p.imageError);
  }

  onImageError(): void {
    if (this.product && 'imageError' in this.product) (this.product as ProductDetail).imageError = true;
  }
}

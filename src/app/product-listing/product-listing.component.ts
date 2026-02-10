import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SalesforceApiService, ProductListItem, ProductCategoryRecord } from '../services/salesforce-api.service';
import { CartService } from '../services/cart.service';
import { ToastService } from '../services/toast.service';
import { CategorySidebarComponent, CategoryItem } from '../category-sidebar/category-sidebar.component';

/** Maps static sidebar category id to query param (used when no catalog selected). */
const STATIC_CATEGORY_TO_ID: Record<string, string | null> = {
  all: null,
  laptops: '1',
  desktops: '2',
  accessories: '3'
};

@Component({
  selector: 'app-product-listing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CategorySidebarComponent],
  templateUrl: './product-listing.component.html',
  styleUrl: './product-listing.component.scss'
})
export class ProductListingComponent implements OnInit {
  categoryId: string | null = null;
  catalogId: string | null = null;
  selectedSidebarCategoryId = 'all';
  /** Categories from GraphQL (ProductCategory by CatalogId); null when no catalog selected. */
  categories: CategoryItem[] | null = null;
  categoriesLoading = false;
  products: ProductListItem[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salesforceApi: SalesforceApiService,
    private cart: CartService,
    private toast: ToastService
  ) {
    this.route.queryParams.subscribe(p => {
      this.categoryId = p['categoryId'] || null;
      this.catalogId = p['catalogId'] || null;
      this.syncSidebarSelectionFromQuery();
      this.loadCategories();
      this.loadProducts();
    });
  }

  ngOnInit(): void {}

  private syncSidebarSelectionFromQuery(): void {
    const id = this.categoryId ?? null;
    if (id === null) {
      this.selectedSidebarCategoryId = 'all';
      return;
    }
    if (this.categories?.length) {
      const found = this.categories.some((c) => c.id === id);
      this.selectedSidebarCategoryId = found ? id : 'all';
    } else {
      const entry = Object.entries(STATIC_CATEGORY_TO_ID).find(([, v]) => v === id);
      this.selectedSidebarCategoryId = entry ? entry[0] : 'all';
    }
  }

  private loadCategories(): void {
    const catalogId = this.catalogId ?? undefined;
    if (!catalogId) {
      this.categories = null;
      return;
    }
    this.categoriesLoading = true;
    this.salesforceApi.getCategoriesByCatalogId(catalogId).subscribe({
      next: (list: ProductCategoryRecord[]) => {
        this.categories = list.map((c) => ({ id: c.id, label: c.name }));
        this.categoriesLoading = false;
        this.syncSidebarSelectionFromQuery();
      },
      error: () => {
        this.categories = null;
        this.categoriesLoading = false;
      }
    });
  }

  onCategoryChange(sidebarCategoryId: string): void {
    this.selectedSidebarCategoryId = sidebarCategoryId;
    const categoryId =
      sidebarCategoryId === 'all'
        ? null
        : this.categories?.some((c) => c.id === sidebarCategoryId)
          ? sidebarCategoryId
          : Object.keys(STATIC_CATEGORY_TO_ID).includes(sidebarCategoryId)
            ? STATIC_CATEGORY_TO_ID[sidebarCategoryId] ?? null
            : null;
    const params = { ...this.route.snapshot.queryParams };
    if (categoryId != null) params['categoryId'] = categoryId;
    else delete params['categoryId'];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true
    });
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    const catalogId = this.catalogId ?? undefined;
    this.salesforceApi.getProducts(100, catalogId).subscribe({
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
    const id = this.categoryId;
    if (id.length >= 15) {
      return this.products.filter((p) => p.categoryIdStr === id);
    }
    const catNum = Number(id);
    if (Number.isNaN(catNum)) return this.products;
    return this.products.filter((p) => p.categoryId === catNum);
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

  goToDetail(product: ProductListItem): void {
    this.router.navigate(['/product', product.id], {
      queryParams: { catalogId: product.catalogId ?? undefined, priceBookId: product.priceBookId ?? undefined }
    });
  }

  addToCart(product: ProductListItem): void {
    this.cart
      .addItem(
        product.id,
        product.name,
        product.price,
        product.quantity,
        product.priceBookEntryId,
        product.priceBookId
      )
      .subscribe({
        next: () => this.toast.show(`${product.name} added to cart`),
        error: (err) => {
          this.error = err?.message ?? 'Failed to add to cart.';
        }
      });
  }
}

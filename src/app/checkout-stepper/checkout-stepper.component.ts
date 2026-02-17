import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CatalogContextService } from '../services/catalog-context.service';

const STEPS: { label: string; route: string }[] = [
  { label: 'Browse & Select Catalog', route: '/catalog' },
  { label: 'Add / Configure product', route: '/products' },
  { label: 'Review Cart', route: '/cart' },
  { label: 'Register/Login', route: '/register' },
  { label: 'Payment', route: '/payment' },
  { label: 'Place Order', route: '/payment' },
];

function getPath(url: string): string {
  return (url.split('?')[0] || '').replace(/^\/+|\/+$/g, '') || 'catalog';
}

/** Derives current step (1-based) from the first segment of the URL. Product listing = step 2 so "Browse" shows completed. */
function getStepFromUrl(url: string): number {
  const path = getPath(url);
  if (path === 'catalog') return 1;
  if (path === 'products' || path.startsWith('product/') || path.startsWith('configure/')) return 2;
  if (path === 'cart') return 3;
  if (path === 'register') return 4;
  if (path === 'payment') return 5;
  return 1;
}

function hasCatalogContextInPath(path: string): boolean {
  return path === 'catalog' || path === 'products' || path.startsWith('product/') || path.startsWith('configure/');
}

@Component({
  selector: 'app-checkout-stepper',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-stepper.component.html',
  styleUrl: './checkout-stepper.component.scss',
})
export class CheckoutStepperComponent {
  readonly steps = STEPS;
  currentStep = 1;
  /** Preserved when linking to Add/Configure (step 2); comes from CatalogContextService so it persists from other steps. */
  productsQueryParams: { catalogId?: string; categoryId?: string } = {};

  constructor(
    private router: Router,
    private catalogContext: CatalogContextService
  ) {
    this.currentStep = getStepFromUrl(this.router.url);
    this.syncQueryParams();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentStep = getStepFromUrl(this.router.url);
        this.syncQueryParams();
      });
  }

  private syncQueryParams(): void {
    const url = this.router.url;
    const tree = this.router.parseUrl(url);
    const path = getPath(url);
    const q = tree.queryParams;
    const catalogId = q['catalogId'] as string | undefined;
    const categoryId = q['categoryId'] as string | undefined;
    if (hasCatalogContextInPath(path) && (catalogId || categoryId)) {
      this.catalogContext.setContext(catalogId, categoryId);
    }
    this.productsQueryParams = this.catalogContext.getQueryParams();
  }

  status(stepIndex: number): 'completed' | 'in_progress' | 'pending' {
    const oneBased = stepIndex + 1;
    if (oneBased < this.currentStep) return 'completed';
    if (oneBased === this.currentStep) return 'in_progress';
    return 'pending';
  }

  stepRoute(stepIndex: number): string {
    return STEPS[stepIndex].route;
  }

  /** Step 2 (Add/Configure) link uses /products with catalogId & categoryId when present. */
  isProductsStep(stepIndex: number): boolean {
    return stepIndex === 1;
  }

  /** Only steps 1–3 (Browse, Add/Configure, Review Cart) are clickable; Register, Payment, Place Order are not. */
  isStepRoutable(stepIndex: number): boolean {
    return stepIndex <= 2;
  }
}

import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'catalog', pathMatch: 'full' },
  { path: 'catalog', loadComponent: () => import('./browse-catalog/browse-catalog.component').then(m => m.BrowseCatalogComponent) },
  { path: 'products', loadComponent: () => import('./product-listing/product-listing.component').then(m => m.ProductListingComponent) },
  { path: 'product/:id', loadComponent: () => import('./product-detail/product-detail.component').then(m => m.ProductDetailComponent) },
  { path: 'configure/:id', loadComponent: () => import('./configure-product/configure-product.component').then(m => m.ConfigureProductComponent) },
  { path: 'cart', loadComponent: () => import('./cart/cart.component').then(m => m.CartComponent) },
  { path: 'register', loadComponent: () => import('./register-account/register-account.component').then(m => m.RegisterAccountComponent) },
  { path: 'payment', loadComponent: () => import('./payment/payment.component').then(m => m.PaymentComponent) },
  { path: '**', redirectTo: 'catalog' }
];

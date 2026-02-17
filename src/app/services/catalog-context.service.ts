import { Injectable } from '@angular/core';

/**
 * Persists the last known catalogId and categoryId so the "Add / Configure product"
 * stepper link can restore them when the user is on other steps (cart, register, payment).
 */
@Injectable({ providedIn: 'root' })
export class CatalogContextService {
  private catalogId: string | null = null;
  private categoryId: string | null = null;

  setContext(catalogId: string | null | undefined, categoryId: string | null | undefined): void {
    if (catalogId != null && catalogId !== '') this.catalogId = catalogId;
    if (categoryId != null && categoryId !== '') this.categoryId = categoryId;
  }

  /** Query params to use for the /products link (e.g. in the stepper). */
  getQueryParams(): { catalogId?: string; categoryId?: string } {
    const params: { catalogId?: string; categoryId?: string } = {};
    if (this.catalogId) params['catalogId'] = this.catalogId;
    if (this.categoryId) params['categoryId'] = this.categoryId;
    return params;
  }
}

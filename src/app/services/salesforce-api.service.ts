import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductListItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  imageUrl: string;
  quantity: number;
  imageError?: boolean;
  productCode?: string;
  nodeType?: string;
  /** From product list API: categories[0].catalogId – use for product details request */
  catalogId?: string;
  /** From product list API: prices[0].priceBookId – use for product details request */
  priceBookId?: string;
}

/** Product detail from Salesforce product details API (single product). */
export interface ProductDetail {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  imageError?: boolean;
  productCode?: string;
  nodeType?: string;
}

interface TokenResponse {
  access_token: string;
  instance_url?: string;
  token_type?: string;
  expires_in?: number;
}

interface SalesforceProductPrice {
  price: number;
  isDefault?: boolean;
  priceBookId?: string;
  pricingModel?: { name?: string; frequency?: string };
}

interface SalesforceProductCategory {
  id: string;
  name: string;
  catalogId?: string;
}

interface SalesforceProduct {
  id: string;
  name: string;
  description?: string;
  displayUrl?: string;
  prices?: SalesforceProductPrice[];
  categories?: SalesforceProductCategory[];
  productCode?: string;
  nodeType?: string;
}

interface ProductListRequest {
  productListRequest: { limit: number };
}

interface ProductListResponse {
  productListResponse?: {
    result?: SalesforceProduct[];
    apiStatus?: { statusCode?: string; statusMessage?: string };
  };
}

interface ProductDetailsRequest {
  productDetailsRequest: { catalogId: string; priceBookId: string };
}

interface SalesforceProductDetailPrice {
  price: number;
  isDefault?: boolean;
  priceBookId?: string;
}

interface SalesforceProductDetail {
  id: string;
  name: string;
  description?: string;
  displayUrl?: string | null;
  prices?: SalesforceProductDetailPrice[];
  productCode?: string;
  nodeType?: string;
}

interface ProductDetailsResponse {
  productBaseDetailsResponse?: {
    result?: SalesforceProductDetail;
    apiStatus?: { statusCode?: string };
  };
}

@Injectable({ providedIn: 'root' })
export class SalesforceApiService {
  private readonly baseUrl = environment.salesforce.baseUrl;
  private readonly tokenUrl = `${this.baseUrl}/services/oauth2/token`;
  private readonly productsUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/products`;

  private cachedToken: string | null = null;
  private cachedProducts: ProductListItem[] | null = null;

  constructor(private http: HttpClient) {}

  private getAccessToken(): Observable<string> {
    if (this.cachedToken) {
      return of(this.cachedToken);
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: environment.salesforce.clientId,
      client_secret: environment.salesforce.clientSecret,
    }).toString();
    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    return this.http.post<TokenResponse>(this.tokenUrl, body, { headers }).pipe(
      map((res) => {
        this.cachedToken = res.access_token;
        return res.access_token;
      }),
      catchError((err) => {
        console.error('Salesforce token error', err);
        throw err;
      })
    );
  }

  getProducts(limit = 100): Observable<ProductListItem[]> {
    if (this.cachedProducts?.length) {
      return of(this.cachedProducts);
    }
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        const body: ProductListRequest = { productListRequest: { limit } };
        return this.http.post<ProductListResponse>(this.productsUrl, body, { headers });
      }),
      map((res) => {
        const result = res.productListResponse?.result ?? [];
        this.cachedProducts = result.map((item) => this.mapProduct(item));
        return this.cachedProducts;
      }),
      catchError((err) => {
        console.error('Salesforce products error', err);
        throw err;
      })
    );
  }

  getProductById(id: string): ProductListItem | null {
    if (!this.cachedProducts) return null;
    return this.cachedProducts.find((p) => p.id === id) ?? null;
  }

  /** Fetch full product details by id (POST .../products/{productId}). Uses catalogId and priceBookId from the product list response for the clicked product. */
  getProductDetails(productId: string, catalogId: string, priceBookId: string): Observable<ProductDetail> {
    const url = `${this.productsUrl}/${encodeURIComponent(productId)}`;
    const body: ProductDetailsRequest = {
      productDetailsRequest: { catalogId, priceBookId },
    };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<ProductDetailsResponse>(url, body, { headers });
      }),
      map((res) => {
        const result = res.productBaseDetailsResponse?.result;
        if (!result) throw new Error('Product details not found');
        return this.mapProductDetail(result);
      }),
      catchError((err) => {
        console.error('Salesforce product details error', err);
        throw err;
      })
    );
  }

  private mapProductDetail(item: SalesforceProductDetail): ProductDetail {
    const price = item.prices?.[0]?.price ?? 0;
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price,
      imageUrl: item.displayUrl ?? '',
      productCode: item.productCode,
      nodeType: item.nodeType,
    };
  }

  clearCache(): void {
    this.cachedToken = null;
    this.cachedProducts = null;
  }

  private mapProduct(item: SalesforceProduct): ProductListItem {
    const price = item.prices?.[0]?.price ?? 0;
    const firstCategory = item.categories?.[0];
    const firstPrice = item.prices?.[0];
    const categoryId = firstCategory ? this.hashCode(firstCategory.id) % 10 : 0;
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price,
      categoryId: Math.max(1, Math.abs(categoryId)),
      imageUrl: item.displayUrl ?? '',
      quantity: 1,
      productCode: item.productCode,
      nodeType: item.nodeType,
      catalogId: firstCategory?.catalogId,
      priceBookId: firstPrice?.priceBookId,
    };
  }

  private hashCode(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }
}

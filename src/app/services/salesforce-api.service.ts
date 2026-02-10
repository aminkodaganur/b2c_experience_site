import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { B2C_CONSTANTS } from '../constants/b2c.constants';

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
  /** From product list API: prices[0].priceBookId – use for product details request and place API */
  priceBookId?: string;
  /** From product list API: prices[0].priceBookEntryId – use for place API CartItem */
  priceBookEntryId?: string;
  /** From product list API: categories[0].id – use for category filter when using GraphQL categories */
  categoryIdStr?: string;
}

/** Product category from GraphQL ProductCategory sobject (filtered by CatalogId). */
export interface ProductCategoryRecord {
  id: string;
  name: string;
  catalogId?: string;
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
  /** From product details API: prices[0].priceBookId */
  priceBookId?: string;
  /** From product details API: prices[0].priceBookEntryId – use for place API CartItem */
  priceBookEntryId?: string;
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
  priceBookEntryId?: string;
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
  productListRequest: { limit: number; catalogId?: string };
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
  priceBookEntryId?: string;
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

/** Catalog record as returned from Salesforce GraphQL (Catalog or ProductCatalog sobject). */
export interface CatalogRecord {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** GraphQL response for catalog query (uiapi.query.Catalog or ProductCatalog). */
export interface CatalogGraphQLResponse {
  data?: {
    uiapi?: {
      query?: {
        [objectKey: string]: {
          edges?: Array<{
            node?: {
              Id?: string;
              Name?: { value?: string } | string;
              [key: string]: unknown;
            };
          }>;
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          totalCount?: number;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

/** Same shape as CatalogGraphQLResponse; used for ProductCategory query. */
type ProductCategoryGraphQLResponse = CatalogGraphQLResponse;

/** Place API (create cart / add cart item) request body. */
interface PlaceSalesTransactionRequest {
  placeSalesTransactionRequest: {
    graph: {
      graphId: string;
      records: Array<{
        referenceId: string;
        record: Record<string, unknown>;
      }>;
    };
  };
}

/** Place API response – salesTransactionId is at placeSalesTransactionResponse.salesTransactionId. */
export interface PlaceSalesTransactionResponse {
  placeSalesTransactionResponse?: {
    salesTransactionId?: string;
    isSuccess?: boolean;
    contextDetails?: { contextId?: string; isBuiltInTransaction?: boolean };
    errorResponse?: unknown[];
  };
}

/** Extract salesTransactionId from place API response. */
function getSalesTransactionId(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const place = (res as Record<string, unknown>)['placeSalesTransactionResponse'] as Record<string, unknown> | undefined;
  if (!place) return null;
  const id = place['salesTransactionId'];
  return typeof id === 'string' ? id : null;
}

@Injectable({ providedIn: 'root' })
export class SalesforceApiService {
  private readonly baseUrl = environment.salesforce.baseUrl;
  private readonly tokenUrl = `${this.baseUrl}/services/oauth2/token`;
  private readonly productsUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/products`;
  private readonly placeUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/place`;
  private readonly graphqlUrl = `${this.baseUrl}/services/data/v66.0/graphql`;

  private cachedToken: string | null = null;
  private cachedProducts: ProductListItem[] | null = null;
  private cachedCatalog: CatalogRecord[] | null = null;

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

  /**
   * Calls the consumer place API to create a cart (first time) and add a cart item, or add an item to an existing cart.
   * Uses priceBookEntryId and priceBookId from the selected product when provided; otherwise falls back to B2C_CONSTANTS.
   * Returns the cart id (new or existing) for use on the next call.
   */
  placeAddToCart(
    cartId: string | null,
    productId: string,
    quantity: number,
    salesPrice: number,
    priceBookEntryId?: string,
    priceBookId?: string
  ): Observable<{ cartId: string }> {
    const webStoreId = B2C_CONSTANTS.WebStoreId;
    const pricebook2Id = priceBookId ?? B2C_CONSTANTS.Pricebook2Id;
    const pricebookEntryId = priceBookEntryId ?? B2C_CONSTANTS.Pricebook2Id;
    const records: PlaceSalesTransactionRequest['placeSalesTransactionRequest']['graph']['records'] = [];

    if (!cartId) {
      records.push({
        referenceId: 'cart_id',
        record: {
          attributes: { type: 'WebCart', method: 'POST' },
          WebStoreId: webStoreId,
          Pricebook2Id: pricebook2Id,
          Name: 'B2C Cart',
        },
      });
    }

    records.push({
      referenceId: 'cartItemRef',
      record: {
        attributes: { type: 'CartItem', method: 'POST' },
        CartId: cartId ?? '@{cart_id.id}',
        Product2Id: productId,
        PricebookEntryId: pricebookEntryId,
        BillingFrequency: null,
        Quantity: quantity,
        SalesPrice: salesPrice,
        StartDate: null,
        SubscriptionTerm: null,
        PeriodBoundary: null,
      },
    });

    const body: PlaceSalesTransactionRequest = {
      placeSalesTransactionRequest: {
        graph: {
          graphId: cartId ? 'updateCart' : 'createCart',
          records,
        },
      },
    };

    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<PlaceSalesTransactionResponse>(this.placeUrl, body, { headers });
      }),
      map((res) => {
        const salesTransactionId = getSalesTransactionId(res);
        if (!salesTransactionId) {
          console.error('Place API response (salesTransactionId not found at expected paths):', res);
          throw new Error('Place API did not return a salesTransactionId');
        }
        return { cartId: salesTransactionId };
      }),
      catchError((err) => {
        console.error('Salesforce place API error', err);
        throw err;
      })
    );
  }

  /**
   * Fetches the product list. When catalogId is provided, only products in that catalog are returned.
   */
  getProducts(limit = 100, catalogId?: string): Observable<ProductListItem[]> {
    if (!catalogId && this.cachedProducts?.length) {
      return of(this.cachedProducts);
    }
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        const productListRequest: ProductListRequest['productListRequest'] = { limit };
        if (catalogId) {
          productListRequest.catalogId = catalogId;
        }
        const body: ProductListRequest = { productListRequest };
        return this.http.post<ProductListResponse>(this.productsUrl, body, { headers });
      }),
      map((res) => {
        const result = res.productListResponse?.result ?? [];
        const products = result.map((item) => this.mapProduct(item));
        if (!catalogId) {
          this.cachedProducts = products;
        }
        return products;
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
    const firstPrice = item.prices?.[0];
    const price = firstPrice?.price ?? 0;
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price,
      imageUrl: item.displayUrl ?? '',
      productCode: item.productCode,
      nodeType: item.nodeType,
      priceBookId: firstPrice?.priceBookId,
      priceBookEntryId: firstPrice?.priceBookEntryId,
    };
  }

  /**
   * Fetches ProductCategory records from Salesforce via GraphQL, filtered by catalog.
   * Only categories whose CatalogId matches the given catalogId are returned.
   */
  getCategoriesByCatalogId(catalogId: string, first = 100): Observable<ProductCategoryRecord[]> {
    const query = `
      query GetProductCategories($catalogId: ID, $first: Int) {
        uiapi {
          query {
            ProductCategory(where: { CatalogId: { eq: $catalogId } }, first: $first) {
              edges {
                node {
                  Id
                  Name { value }
                  CatalogId { value }
                }
              }
              pageInfo { hasNextPage endCursor }
              totalCount
            }
          }
        }
      }
    `;
    const body = {
      query: query.replace(/\s+/g, ' ').trim(),
      variables: { catalogId, first },
      operationName: 'GetProductCategories',
    };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<ProductCategoryGraphQLResponse>(this.graphqlUrl, body, { headers });
      }),
      map((res) => {
        if (res.errors?.length) {
          throw new Error(res.errors.map((e) => e.message).join('; '));
        }
        const queryData = res.data?.uiapi?.query?.['ProductCategory'];
        const edges = queryData?.edges ?? [];
        return edges
          .map((e) => e.node)
          .filter((n): n is NonNullable<typeof n> => n != null)
          .map((node) => {
            const name = node.Name;
            const nameStr =
              typeof name === 'object' && name !== null && 'value' in name
                ? (name as { value?: string }).value ?? ''
                : typeof name === 'string'
                  ? name
                  : '';
            const catalogIdVal = node['CatalogId'];
            const catalogIdStr =
              typeof catalogIdVal === 'object' && catalogIdVal !== null && 'value' in catalogIdVal
                ? (catalogIdVal as { value?: string }).value ?? undefined
                : typeof catalogIdVal === 'string'
                  ? catalogIdVal
                  : undefined;
            return {
              id: node.Id ?? '',
              name: nameStr,
              catalogId: catalogIdStr,
            } as ProductCategoryRecord;
          });
      }),
      catchError((err) => {
        const message = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce GraphQL ProductCategory error', message, err);
        throw new Error(message);
      })
    );
  }

  /**
   * Fetches catalog records from Salesforce via GraphQL (Catalog or ProductCatalog sobject).
   * Tries 'ProductCatalog' first (common in B2C/Commerce), then 'Catalog'.
   * @param first - Max number of records (default 50)
   */
  getCatalog(first = 50): Observable<CatalogRecord[]> {
    if (this.cachedCatalog?.length) {
      return of(this.cachedCatalog);
    }
    return this.getCatalogWithObjectName('ProductCatalog', first).pipe(
      catchError(() => this.getCatalogWithObjectName('Catalog', first)),
      map((records) => {
        this.cachedCatalog = records;
        return records;
      })
    );
  }

  /**
   * Fetches catalog records for a specific sObject name (e.g. 'Catalog' or 'ProductCatalog').
   * Uses minimal fields (Id, Name) to avoid schema mismatches.
   */
  private getCatalogWithObjectName(
    catalogObjectName: string,
    first: number
  ): Observable<CatalogRecord[]> {
    const query = `
      query GetCatalog($first: Int) {
        uiapi {
          query {
            ${catalogObjectName}(first: $first) {
              edges {
                node {
                  Id
                  Name { value }
                }
              }
              pageInfo { hasNextPage endCursor }
              totalCount
            }
          }
        }
      }
    `;
    const body = {
      query: query.replace(/\s+/g, ' ').trim(),
      variables: { first },
      operationName: 'GetCatalog',
    };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<CatalogGraphQLResponse>(this.graphqlUrl, body, { headers });
      }),
      map((res) => {
        if (res.errors?.length) {
          throw new Error(res.errors.map((e) => e.message).join('; '));
        }
        const queryData = res.data?.uiapi?.query?.[catalogObjectName];
        const edges = queryData?.edges ?? [];
        const records: CatalogRecord[] = edges
          .map((e) => e.node)
          .filter((n): n is NonNullable<typeof n> => n != null)
          .map((node) => {
            const name = node.Name;
            const nameStr =
              typeof name === 'object' && name !== null && 'value' in name
                ? (name as { value?: string }).value ?? ''
                : typeof name === 'string'
                  ? name
                  : '';
            return {
              id: node.Id ?? '',
              name: nameStr,
              ...node,
            } as CatalogRecord;
          });
        return records;
      }),
      catchError((err) => {
        const message = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce GraphQL catalog error', message, err);
        throw new Error(message);
      })
    );
  }

  private getGraphQLOrHttpErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    const e = err as { error?: { errors?: Array<{ message?: string }>; message?: string }; message?: string };
    if (Array.isArray(e?.error?.errors) && e.error.errors.length > 0) {
      return e.error.errors.map((x) => x?.message ?? '').filter(Boolean).join('; ') || 'GraphQL error';
    }
    if (e?.error?.message) return e.error.message;
    if (e?.message) return e.message;
    return 'Failed to fetch catalog from Salesforce';
  }

  clearCache(): void {
    this.cachedToken = null;
    this.cachedProducts = null;
    this.cachedCatalog = null;
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
      priceBookEntryId: firstPrice?.priceBookEntryId,
      categoryIdStr: firstCategory?.id,
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

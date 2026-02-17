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
  /** From product list API: productSellingModelOptions.productSellingModel – for subscription cart item */
  sellingModelType?: string;
  subscriptionPricingTerm?: number;
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
  /** For subscription cart item when not one-time */
  sellingModelType?: string;
  subscriptionPricingTerm?: number;
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

interface SalesforceProductSellingModel {
  sellingModelType?: string;
  pricingTerm?: number;
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
  productSellingModelOptions?: { productSellingModel?: SalesforceProductSellingModel }[];
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
  productSellingModelOptions?: { productSellingModel?: { sellingModelType?: string; pricingTerm?: number } }[];
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

/** Flat cart item from GraphQL (CartItem sobject). */
export interface CartItemRecord {
  id: string;
  cartId: string;
  parentCartItemId: string | null;
  quantity: number;
  salesPrice?: number;
  product2Id?: string;
  name?: string;
}

/** Cart item node with children for tree display. */
export interface CartItemNode {
  id: string;
  cartId: string;
  parentCartItemId: string | null;
  quantity: number;
  salesPrice?: number;
  product2Id?: string;
  name?: string;
  children: CartItemNode[];
}

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

/** Place API error item (when isSuccess is false). */
export interface PlaceErrorItem {
  errorCode?: string;
  message?: string;
  referenceId?: string;
}

/** Place API response – require isSuccess true and salesTransactionId for success; else use errorResponse. */
export interface PlaceSalesTransactionResponse {
  placeSalesTransactionResponse?: {
    salesTransactionId?: string;
    isSuccess?: boolean;
    contextDetails?: { contextId?: string; isBuiltInTransaction?: boolean };
    errorResponse?: PlaceErrorItem[];
  };
}

/** Extract place response body (placeSalesTransactionResponse). */
function getPlaceResponse(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== 'object') return null;
  const place = (res as Record<string, unknown>)['placeSalesTransactionResponse'];
  return place && typeof place === 'object' ? (place as Record<string, unknown>) : null;
}

/** Build error message from place API errorResponse array. */
function getPlaceErrorMessage(place: Record<string, unknown>): string {
  const errList = place['errorResponse'];
  if (!Array.isArray(errList) || errList.length === 0) {
    return 'Add to cart failed.';
  }
  const messages = errList
    .map((e) => {
      if (e && typeof e === 'object' && 'message' in e) return String((e as { message?: string }).message ?? '');
      return '';
    })
    .filter(Boolean);
  return messages.length > 0 ? messages.join(' ') : 'Add to cart failed.';
}

/** Read string/number from GraphQL value type { value } or scalar. */
function readGraphQLValue(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'object' && 'value' in val) return String((val as { value?: unknown }).value ?? '');
  return typeof val === 'string' || typeof val === 'number' ? String(val) : null;
}

/** Build parent-child tree from flat CartItem records. */
function buildCartItemTree(records: CartItemRecord[]): CartItemNode[] {
  const byId = new Map<string, CartItemNode>();
  records.forEach((r) => {
    byId.set(r.id, {
      id: r.id,
      cartId: r.cartId,
      parentCartItemId: r.parentCartItemId,
      quantity: r.quantity,
      salesPrice: r.salesPrice,
      product2Id: r.product2Id,
      name: r.name,
      children: [],
    });
  });
  const roots: CartItemNode[] = [];
  byId.forEach((node) => {
    const parentId = node.parentCartItemId;
    if (!parentId || !byId.has(parentId)) {
      roots.push(node);
    } else {
      byId.get(parentId)!.children.push(node);
    }
  });
  return roots;
}

@Injectable({ providedIn: 'root' })
export class SalesforceApiService {
  private readonly baseUrl = environment.salesforce.baseUrl;
  private readonly tokenUrl = `${this.baseUrl}/services/oauth2/token`;
  private readonly productsUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/products`;
  private readonly placeUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/place`;
  private readonly checkoutUrl = `${this.baseUrl}/services/data/v66.0/connect/consumer/checkout`;
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
    priceBookId?: string,
    subscriptionOptions?: { sellingModelType: string; pricingTerm: number }
  ): Observable<{ cartId: string }> {
    const webStoreId = B2C_CONSTANTS.WebStoreId;
    const pricebook2Id = priceBookId ?? B2C_CONSTANTS.Pricebook2Id;
    const pricebookEntryId = priceBookEntryId ?? B2C_CONSTANTS.Pricebook2Id;
    const records: PlaceSalesTransactionRequest['placeSalesTransactionRequest']['graph']['records'] = [];
    const isSubscription =
      subscriptionOptions &&
      subscriptionOptions.sellingModelType?.toLowerCase() !== 'one time' &&
      subscriptionOptions.sellingModelType?.toLowerCase() !== 'onetime';
    const todayIso = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';

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
      records.push({
        referenceId: 'cartItemRef',
        record: {
          attributes: { type: 'CartItem', method: 'POST' },
          CartId: '@{cart_id.id}',
          Product2Id: productId,
          PricebookEntryId: pricebookEntryId,
          BillingFrequency: null,
          Quantity: quantity,
          SalesPrice: salesPrice,
          StartDate: isSubscription && subscriptionOptions ? todayIso : null,
          SubscriptionTerm: isSubscription && subscriptionOptions ? subscriptionOptions.pricingTerm : null,
          PeriodBoundary: isSubscription && subscriptionOptions ? 'Anniversary' : null,
        },
      });
    } else {
      records.push({
        referenceId: 'refCart',
        record: {
          attributes: { type: 'WebCart', method: 'PATCH', id: cartId },
        },
      });
      records.push({
        referenceId: 'cartItemNew',
        record: {
          attributes: { type: 'CartItem', method: 'POST' },
          CartId: '@{refCart.id}',
          Product2Id: productId,
          PricebookEntryId: pricebookEntryId,
          Quantity: quantity,
          ...(isSubscription && subscriptionOptions
            ? {
                StartDate: todayIso,
                SubscriptionTerm: subscriptionOptions.pricingTerm,
                PeriodBoundary: 'Anniversary',
              }
            : {}),
        },
      });
    }

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
        const place = getPlaceResponse(res);
        if (!place) {
          throw new Error('Invalid place API response.');
        }
        const isSuccess = place['isSuccess'] === true;
        const salesTransactionId = typeof place['salesTransactionId'] === 'string' ? place['salesTransactionId'] : null;

        if (!isSuccess) {
          throw new Error(getPlaceErrorMessage(place));
        }
        if (!salesTransactionId) {
          throw new Error('Place API did not return a salesTransactionId.');
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
   * Calls place API to delete a single CartItem. Uses graphId "updateCart" with WebCart PATCH + CartItem DELETE.
   */
  placeDeleteCartItem(cartId: string, cartItemId: string): Observable<void> {
    const records: PlaceSalesTransactionRequest['placeSalesTransactionRequest']['graph']['records'] = [
      {
        referenceId: cartId,
        record: {
          attributes: { type: 'WebCart', method: 'PATCH', id: cartId },
        },
      },
      {
        referenceId: cartItemId,
        record: {
          attributes: { type: 'CartItem', method: 'DELETE', id: cartItemId },
        },
      },
    ];
    return this.placeUpdateCart(cartId, records);
  }

  /**
   * Calls place API to update a CartItem's quantity. Uses graphId "updateCart" with WebCart PATCH + CartItem PATCH.
   */
  placeUpdateCartItemQuantity(cartId: string, cartItemId: string, quantity: number): Observable<void> {
    const records: PlaceSalesTransactionRequest['placeSalesTransactionRequest']['graph']['records'] = [
      {
        referenceId: cartId,
        record: {
          attributes: { type: 'WebCart', method: 'PATCH', id: cartId },
        },
      },
      {
        referenceId: cartItemId,
        record: {
          attributes: { type: 'CartItem', method: 'PATCH', id: cartItemId },
          Quantity: quantity,
        },
      },
    ];
    return this.placeUpdateCart(cartId, records);
  }

  /**
   * POSTs to place API with graphId "updateCart" and given records. Returns void on success.
   */
  private placeUpdateCart(
    _cartId: string,
    records: PlaceSalesTransactionRequest['placeSalesTransactionRequest']['graph']['records']
  ): Observable<void> {
    const body: PlaceSalesTransactionRequest = {
      placeSalesTransactionRequest: {
        graph: {
          graphId: 'updateCart',
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
        const place = getPlaceResponse(res);
        if (!place) {
          throw new Error('Invalid place API response.');
        }
        if (place['isSuccess'] !== true) {
          throw new Error(getPlaceErrorMessage(place));
        }
        return undefined;
      }),
      catchError((err) => {
        console.error('Salesforce place API (update cart) error', err);
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
    const sellingModel = item.productSellingModelOptions?.[0]?.productSellingModel;
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
      sellingModelType: sellingModel?.sellingModelType,
      subscriptionPricingTerm: sellingModel?.pricingTerm,
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
   * Fetches cart items for a cart from GraphQL (CartItem sobject), builds parent-child tree using ParentCartItem.
   */
  getCartItems(cartId: string, first = 200): Observable<CartItemNode[]> {
    const query = `
      query GetCartItems($cartId: ID, $first: Int) {
        uiapi {
          query {
            CartItem(where: { CartId: { eq: $cartId } }, first: $first) {
              edges {
                node {
                  Id
                  CartId { value }
                  ParentCartItem { Id }
                  Quantity { value }
                  SalesPrice { value }
                  Product2Id { value }
                  Product2 {
                    Name { value }
                  }
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
      variables: { cartId, first },
      operationName: 'GetCartItems',
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
        const queryData = res.data?.uiapi?.query?.['CartItem'];
        const edges = queryData?.edges ?? [];
        const records: CartItemRecord[] = edges
          .map((e) => e.node)
          .filter((n): n is NonNullable<typeof n> => n != null)
          .map((node) => {
            const cartIdVal = node['CartId'];
            const cartIdStr = readGraphQLValue(cartIdVal);
            const parentVal = node['ParentCartItem'];
            let parentId: string | null = null;
            if (parentVal && typeof parentVal === 'object' && parentVal !== null) {
              const p = parentVal as Record<string, unknown>;
              const raw = p['Id'];
              parentId = typeof raw === 'string' ? raw : readGraphQLValue(raw);
            }
            const qtyVal = node['Quantity'];
            const qty = parseInt(readGraphQLValue(qtyVal) ?? '1', 10) || 1;
            const priceVal = node['SalesPrice'];
            const salesPrice = parseFloat(readGraphQLValue(priceVal) ?? '0') || 0;
            const product2Id = readGraphQLValue(node['Product2Id']);
            const product2 = node['Product2'] as Record<string, unknown> | null | undefined;
            const productName =
              product2 && typeof product2 === 'object' && product2['Name'] != null
                ? readGraphQLValue(product2['Name'])
                : null;
            return {
              id: node.Id ?? '',
              cartId: cartIdStr ?? '',
              parentCartItemId: parentId ?? null,
              quantity: qty,
              salesPrice: salesPrice || undefined,
              product2Id: product2Id ?? undefined,
              name: productName ?? undefined,
            } as CartItemRecord;
          });
        return buildCartItemTree(records);
      }),
      catchError((err) => {
        const message = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce GraphQL CartItem error', message, err);
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
    const sellingModel = item.productSellingModelOptions?.[0]?.productSellingModel;
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
      sellingModelType: sellingModel?.sellingModelType,
      subscriptionPricingTerm: sellingModel?.pricingTerm,
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

  /**
   * Creates an Account via REST API. Returns the new Account Id.
   * Uses individual shipping fields: ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry.
   */
  createAccount(record: {
    Name: string;
    ShippingStreet: string;
    ShippingCity: string;
    ShippingState: string;
    ShippingPostalCode: string;
    ShippingCountry: string;
    Phone: string;
    Email__c: string;
    Password__c: string;
  }): Observable<{ id: string }> {
    const url = `${this.baseUrl}/services/data/v66.0/sobjects/Account`;
    const body = {
      Name: record.Name,
      Phone: record.Phone,
      ShippingStreet: record.ShippingStreet,
      ShippingCity: record.ShippingCity,
      ShippingState: record.ShippingState,
      ShippingPostalCode: record.ShippingPostalCode,
      ShippingCountry: record.ShippingCountry,
      Email__c: record.Email__c,
      Password__c: record.Password__c,
    };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<{ id: string }>(url, body, { headers });
      }),
      map((res) => {
        const id = res?.id;
        if (!id) {
          throw new Error('Account create did not return an id.');
        }
        return { id };
      }),
      catchError((err) => {
        const msg = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce create Account error', msg, err);
        throw new Error(msg);
      })
    );
  }

  /**
   * Updates WebCart's AccountId via REST API. PATCH sobjects/WebCart/{cartId}.
   */
  updateWebCartAccountId(cartId: string, accountId: string): Observable<void> {
    const url = `${this.baseUrl}/services/data/v66.0/sobjects/WebCart/${encodeURIComponent(cartId)}`;
    const body = { AccountId: accountId };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.patch<unknown>(url, body, { headers });
      }),
      map(() => undefined),
      catchError((err) => {
        const msg = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce update WebCart AccountId error', msg, err);
        throw new Error(msg);
      })
    );
  }

  /**
   * Deletes the WebCart via REST API. DELETE sobjects/WebCart/{cartId}. Call after successful checkout.
   */
  deleteWebCart(cartId: string): Observable<void> {
    const url = `${this.baseUrl}/services/data/v66.0/sobjects/WebCart/${encodeURIComponent(cartId)}`;
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
        });
        return this.http.delete<unknown>(url, { headers });
      }),
      map(() => undefined),
      catchError((err) => {
        const msg = this.getGraphQLOrHttpErrorMessage(err);
        console.error('Salesforce delete WebCart error', msg, err);
        throw new Error(msg);
      })
    );
  }

  /**
   * Checkout: POST to connect/consumer/checkout with cartId.
   * Response may have orderId (success) or orderId null with errors array (e.g. Revenue Transaction Error Logs).
   */
  checkout(cartId: string): Observable<CheckoutResponse> {
    const body = { cartId };
    return this.getAccessToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        });
        return this.http.post<CheckoutResponse>(this.checkoutUrl, body, { headers });
      }),
      catchError((err) => {
        console.error('Salesforce checkout error', err);
        throw err;
      })
    );
  }
}

/** Checkout API response. When orderId is null, errors contain the reason. */
export interface CheckoutResponse {
  orderId: string | null;
  errors?: Array<{
    errorMessage: string;
    referenceId: string | null;
    statusCode: string;
  }>;
}

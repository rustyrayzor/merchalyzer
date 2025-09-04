import { PrintifyStore, PrintifyProduct } from './types';

/**
 * Printify API client class
 */
export class PrintifyAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.printify.com/v1';
  }

  /**
   * Make an authenticated request to the Printify API
   */
  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Merchalyzer/1.0',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          errorText = 'Unable to read error response';
        }
        throw new Error(`Printify API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        throw new Error(`Printify API returned non-JSON response: ${contentType}`);
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Printify API. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Get all stores for the authenticated user
   */
  async getStores(): Promise<PrintifyStore[]> {
    try {
      const response: unknown = await this.makeRequest('/shops.json');

      // Handle different response formats
      let stores: PrintifyStore[];

      // Check if response is an array (direct format)
      if (Array.isArray(response)) {
        stores = response;
      }
      // Check if response has data property (wrapped format)
      else if (
        typeof response === 'object' && response !== null &&
        Array.isArray((response as { data?: unknown }).data)
      ) {
        stores = (response as { data: PrintifyStore[] }).data;
      }
      // Handle unexpected format
      else {
        console.error('Printify API response format unexpected:', response);
        throw new Error('Printify API returned unexpected response format');
      }

      // Validate that each store has required fields
      for (const store of stores) {
        if (!store.id || !store.title) {
          console.error('Invalid store object:', store);
          throw new Error('Printify API returned invalid store data');
        }
      }

      return stores;
    } catch (error) {
      console.error('Error fetching Printify stores:', error);
      throw error;
    }
  }

  /**
   * Get products for a specific store
   */
  async getStoreProducts(storeId: string): Promise<PrintifyProduct[]> {
    try {
      const all: PrintifyProduct[] = [];
      // Printify API enforces limit <= 50
      const limit = 50;
      let pageNum = 1;
      while (true) {
        const response: unknown = await this.makeRequest(`/shops/${storeId}/products.json?limit=${limit}&page=${pageNum}`);
        let items: PrintifyProduct[] = [];
        let totalFromMeta: number | undefined = undefined;

        if (Array.isArray(response)) {
          items = response as PrintifyProduct[];
        } else if (typeof response === 'object' && response !== null) {
          const obj = response as { data?: unknown; meta?: { total?: number } };
          if (Array.isArray(obj.data)) items = obj.data as PrintifyProduct[];
          if (obj.meta && typeof obj.meta.total === 'number') totalFromMeta = obj.meta.total;
        } else {
          console.error('Printify products API response format unexpected (page):', response);
          throw new Error('Printify API returned unexpected response format for products');
        }

        // Validate page
        for (const product of items) {
          if (!product.id || !product.title) {
            console.error('Invalid product object:', product);
            throw new Error('Printify API returned invalid product data');
          }
        }

        all.push(...items);
        if (items.length < limit) break;
        if (typeof totalFromMeta === 'number' && all.length >= totalFromMeta) break;
        pageNum += 1;
      }

      return all;
    } catch (error) {
      console.error(`Error fetching products for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific product by ID
   */
  async getProduct(storeId: string, productId: string): Promise<PrintifyProduct> {
    try {
      const product: PrintifyProduct = await this.makeRequest(`/shops/${storeId}/products/${productId}.json`);
      return product;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getStores();
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  /**
   * Get a single page of products with limit/offset.
   * Returns page data and total count from meta when available.
   */
  async getStoreProductsPage(
    storeId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ products: PrintifyProduct[]; total: number | undefined }> {
    try {
      // Enforce Printify limit <= 50; user requested 20
      const capped = Math.max(1, Math.min(50, Math.floor(limit)));
      const safeOffset = Math.max(0, Math.floor(offset));
      const page = Math.floor(safeOffset / capped) + 1;
      const response: unknown = await this.makeRequest(
        `/shops/${storeId}/products.json?limit=${capped}&page=${page}`
      );

      let products: PrintifyProduct[] = [];
      let total: number | undefined = undefined;

      if (Array.isArray(response)) {
        products = response as PrintifyProduct[];
      } else if (typeof response === 'object' && response !== null) {
        const obj = response as { data?: unknown; meta?: { total?: number } };
        if (Array.isArray(obj.data)) products = obj.data as PrintifyProduct[];
        if (obj.meta && typeof obj.meta.total === 'number') total = obj.meta.total;
      } else {
        console.error('Printify products API response format unexpected (paged):', response);
        throw new Error('Printify API returned unexpected response format for products');
      }

      for (const product of products) {
        if (!product.id || !product.title) {
          console.error('Invalid product object:', product);
          throw new Error('Printify API returned invalid product data');
        }
      }

      return { products, total };
    } catch (error) {
      console.error(`Error fetching paged products for store ${storeId}:`, error);
      throw error;
    }
  }
}

/**
 * Create a Printify API client instance
 */
export function createPrintifyClient(): PrintifyAPI {
  const apiKey = process.env.PRINTIFY_API_KEY;

  if (!apiKey) {
    throw new Error('PRINTIFY_API_KEY environment variable is not set');
  }

  return new PrintifyAPI(apiKey);
}

/**
 * Validate Printify API key
 */
export async function validatePrintifyApiKey(): Promise<boolean> {
  try {
    const client = createPrintifyClient();
    return await client.validateApiKey();
  } catch {
    return false;
  }
}


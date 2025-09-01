import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Store, Package, AlertCircle, Search, Filter, X, Copy, Plus, Trash2, Upload } from 'lucide-react';
import { cn, formatCentsUSD } from '@/lib/utils';
import { PrintifyStore, PrintifyProduct } from '@/lib/types';
import ProductCreator from '@/components/printify/ProductCreator';

interface StoresResponse {
  success: boolean;
  data?: PrintifyStore[];
  count?: number;
  error?: string;
  details?: string;
}

interface ProductsResponse {
  success: boolean;
  data?: PrintifyProduct[];
  count?: number;
  totalCount?: number;
  storeId?: string;
  error?: string;
  details?: string;
  filters?: {
    search?: string | null;
    status?: string;
    tag?: string | null;
    limit?: number | null;
    offset?: number;
  };
}

interface ProductFilters {
  search: string;
  status: 'all' | 'visible' | 'hidden';
  tag: string;
  showFilters: boolean;
}

export default function PrintifyPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [stores, setStores] = useState<PrintifyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<PrintifyStore | null>(null);
  const [products, setProducts] = useState<PrintifyProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  // Removed unused productsError state
  const [totalProducts, setTotalProducts] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const PAGE_LIMIT = 20;
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [bulkCsv, setBulkCsv] = useState<File | null>(null);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<{ running: boolean; created: number; failed: number; total: number; message?: string } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ title: string; imageName: string; success: boolean; error?: string }>>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'bulk'>('products');
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    tag: '',
    showFilters: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/printify/stores');
      const data: StoresResponse = await response.json();

      if (!data.success) {
        throw new Error(data.details || data.error || 'Failed to fetch stores');
      }

      setStores(data.data || []);
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = useCallback(async (
    storeId: string,
    options?: { filterParams?: Partial<ProductFilters>; offset?: number; append?: boolean }
  ) => {
    try {
      setLoadingProducts(true);
      // no-op

      const params = new URLSearchParams();
      params.append('storeId', storeId);

      // Add filter parameters
      const searchFilter = options?.filterParams?.search ?? filters.search;
      const statusFilter = options?.filterParams?.status ?? filters.status;
      const tagFilter = options?.filterParams?.tag ?? filters.tag;

      if (searchFilter) params.append('search', searchFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (tagFilter) params.append('tag', tagFilter);

      // Pagination
      const effectiveOffset = options?.offset ?? 0;
      params.append('limit', String(PAGE_LIMIT));
      params.append('offset', String(effectiveOffset));

      const response = await fetch(`/api/printify/products?${params.toString()}`);
      const data: ProductsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.details || data.error || 'Failed to fetch products');
      }

      setProducts(prev => (options?.append ? [...prev, ...(data.data || [])] : (data.data || [])));
      setTotalProducts(data.totalCount || data.count || 0);
      setPageOffset(effectiveOffset);

      // Extract all available tags from products
      const allTags = new Set<string>();
      data.data?.forEach(product => {
        product.tags?.forEach(tag => allTags.add(tag));
      });
      setAvailableTags(Array.from(allTags).sort());
    } catch (err) {
      console.error('Error fetching products:', err);
      // no-op
    } finally {
      setLoadingProducts(false);
    }
  }, [filters.search, filters.status, filters.tag]);

  const handleStoreSelect = (store: PrintifyStore) => {
    setSelectedStore(store);
    // Reset filters when switching stores
    setFilters({
      search: '',
      status: 'all',
      tag: '',
      showFilters: false,
    });
    setProducts([]);
    setPageOffset(0);
    fetchProducts(store.id.toString(), { offset: 0, append: false });
  };

  const handleFilterChange = (newFilters: Partial<ProductFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      tag: '',
      showFilters: filters.showFilters,
    });
  };

  const hasActiveFilters = filters.search || (filters.status !== 'all') || filters.tag;

  // Debounced search effect
  useEffect(() => {
    if (!selectedStore) return;

    const debounceTimer = setTimeout(() => {
      setProducts([]);
      setPageOffset(0);
      fetchProducts(selectedStore.id.toString(), { offset: 0, append: false });
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [filters.search, selectedStore, fetchProducts]);

  const handleProductCreated = (newProduct: PrintifyProduct) => {
    // Refresh the products list to include the new product
    if (selectedStore) {
      setProducts([]);
      setPageOffset(0);
      fetchProducts(selectedStore.id.toString(), { offset: 0, append: false });
    }
    // TODO: Show success toast/notification
    console.log('Product created successfully:', newProduct);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <main className={cn(
      "space-y-6 transition-all duration-500 ease-out",
      isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
    )}>
      <Card className={cn(
        "transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Store className="h-6 w-6" />
            Printify Integration
          </CardTitle>
          <p className="text-muted-foreground">
            Connect and manage your Printify stores. View products, manage inventory, and sync with your merchandise workflow.
          </p>
        </CardHeader>
        <CardContent className={cn(
          "transition-all duration-500 ease-out delay-200",
          isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading stores...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-500 mr-2" />
              <div className="text-left">
                <p className="text-red-500 font-medium">Error loading stores</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={fetchStores}
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No stores found</h3>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have any Printify stores connected, or your API key may not be configured correctly.
              </p>
              <Button onClick={fetchStores} variant="outline">
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Your Stores ({stores.length})
                </h3>
                <Button onClick={fetchStores} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stores.map((store) => (
                  <Card key={store.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{store.title}</CardTitle>
                        <Badge variant="secondary">
                          {store.sales_channel}
                        </Badge>
                      </div>
                      {store.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {store.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Created:</span>
                          <span>{formatDate(store.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Updated:</span>
                          <span>{formatDate(store.updated_at)}</span>
                        </div>
                        <Button
                          className="w-full mt-3"
                          size="sm"
                          onClick={() => handleStoreSelect(store)}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          View Products
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedStore && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Products in {selectedStore.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant={activeTab === 'products' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('products')}
                      >
                        All Products
                      </Button>
                      <Button
                        variant={activeTab === 'bulk' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('bulk')}
                      >
                        Bulk Create
                      </Button>
                    </div>
                    {bulkStatus && (
                      <div className="text-sm text-muted-foreground">
                        {bulkStatus.running ? (
                          <span>Bulk running… {bulkStatus.total ? `(${bulkStatus.total} items)` : ''}</span>
                        ) : (
                          (bulkStatus.total > 0) && <span>Bulk complete: {bulkStatus.created} created, {bulkStatus.failed} failed</span>
                        )}
                        {bulkStatus.message && (<div className="text-red-500">{bulkStatus.message}</div>)}
                      </div>
                    )}
                    <div className="flex flex-col gap-4">
                      {activeTab === 'products' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{products.length} of {totalProducts} products</span>
                          {hasActiveFilters && (
                            <Badge variant="secondary" className="text-xs">
                              Filtered
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <ProductCreator
                            storeId={selectedStore.id.toString()}
                            onSuccess={handleProductCreated}
                            trigger={
                              <Button size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Create Product
                              </Button>
                            }
                          />
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                          >
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchProducts(selectedStore.id.toString())}
                            disabled={loadingProducts}
                          >
                            {loadingProducts ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Package className="h-4 w-4 mr-2" />
                            )}
                            Refresh
                          </Button>
                        </div>
                      </div>
                      )}

                      {activeTab === 'bulk' && (
                        <div className="space-y-4 p-4 border rounded-lg">
                          <h4 className="text-lg font-medium">Bulk Duplicate</h4>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Template Product</Label>
                              <select
                                className="border rounded-md h-10 text-sm px-2 w-full"
                                value={bulkTemplateId}
                                onChange={(e) => setBulkTemplateId(e.target.value)}
                              >
                                <option value="">Select template…</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                              </select>
                              <p className="text-xs text-muted-foreground">Duplicates will be based on this template.</p>
                            </div>
                            <div className="space-y-2">
                              <Label>CSV File</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept=".csv"
                                  className="hidden"
                                  onChange={(e) => setBulkCsv(e.target.files?.[0] || null)}
                                  id="bulk-csv-input"
                                />
                                <Button asChild variant="outline">
                                  <label htmlFor="bulk-csv-input" className="cursor-pointer">
                                    <Upload className="h-4 w-4 mr-2" /> Choose CSV
                                  </label>
                                </Button>
                                <span className="text-sm text-muted-foreground">{bulkCsv?.name || 'No file selected'}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">CSV headers required: Title, Image Name. Images must exist in /Images.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                if (!selectedStore || !bulkCsv || !bulkTemplateId) return;
                                try {
                                  setBulkStatus({ running: true, created: 0, failed: 0, total: 0 });
                                  const text = await bulkCsv.text();
                                  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
                                  if (lines.length < 2) throw new Error('CSV must include header and at least one row');
                                  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                                  const titleIdx = headers.findIndex(h => h === 'title' || h === 'tile');
                                  const imageIdx = headers.findIndex(h => h === 'image name' || h === 'imagename' || h === 'image');
                                  if (titleIdx === -1 || imageIdx === -1) throw new Error('CSV needs "Title" and "Image Name" headers');
                                  const rows = lines.slice(1).map(line => {
                                    const parts = line.split(',');
                                    return {
                                      title: (parts[titleIdx] || '').trim(),
                                      imageName: (parts[imageIdx] || '').trim(),
                                    };
                                  }).filter(r => r.title && r.imageName);
                                  setBulkStatus({ running: true, created: 0, failed: 0, total: rows.length });
                                  const res = await fetch('/api/printify/bulk-duplicate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      storeId: selectedStore.id.toString(),
                                      template: { id: bulkTemplateId },
                                      rows,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok || !data.success) throw new Error(data.details || data.error || 'Bulk duplicate failed');
                                  setBulkStatus({ running: false, created: data.created || 0, failed: data.failed || 0, total: data.results?.length || rows.length });
                                  setBulkResults((data.results || []).map((r: { title: string; imageName: string; success?: boolean; error?: string }) => ({
                                    title: r.title,
                                    imageName: r.imageName,
                                    success: !!r.success,
                                    error: r.error,
                                  })));
                                  fetchProducts(selectedStore.id.toString(), { offset: 0, append: false });
                                } catch (err) {
                                  console.error(err);
                                  setBulkStatus({ running: false, created: 0, failed: 0, total: 0, message: err instanceof Error ? err.message : 'Bulk failed' });
                                }
                              }}
                              disabled={!bulkCsv || !bulkTemplateId || (bulkStatus?.running ?? false)}
                            >
                              {(bulkStatus?.running ?? false) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
                                </>
                              ) : (
                                'Start Bulk'
                              )}
                            </Button>
                            {bulkStatus && !bulkStatus.running && bulkStatus.total > 0 && (
                              <div className="text-sm text-muted-foreground">
                                Bulk complete: {bulkStatus.created} created, {bulkStatus.failed} failed
                                {bulkStatus.message && (<span className="text-red-500 ml-2">{bulkStatus.message}</span>)}
                              </div>
                            )}
                          </div>
                          {/* Row-by-row results under bulk tab */}
                          <div className="space-y-3">
                            {bulkStatus?.running && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running bulk...
                              </div>
                            )}
                            {(!bulkStatus?.running && bulkResults.length > 0) && (
                              <div className="border rounded-md">
                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b text-sm font-medium bg-muted/40">
                                  <div>Title</div>
                                  <div>Image</div>
                                  <div>Status</div>
                                </div>
                                <div className="max-h-[50vh] overflow-auto">
                                  {bulkResults.map((r, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b text-sm">
                                      <div className="truncate" title={r.title}>{r.title}</div>
                                      <div className="truncate" title={r.imageName}>{r.imageName}</div>
                                      <div className={r.success ? 'text-green-600' : 'text-red-600'}>
                                        {r.success ? 'Created' : `Failed${r.error ? `: ${r.error}` : ''}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(!bulkStatus?.running && bulkResults.length === 0) && (
                              <p className="text-sm text-muted-foreground">Upload a CSV and start bulk to see results here.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Filter Controls (Products tab only) */}
                      {activeTab === 'products' && filters.showFilters && (
                        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search products..."
                              value={filters.search}
                              onChange={(e) => handleFilterChange({ search: e.target.value })}
                              className="h-8"
                            />
                          </div>

                          <Select
                            value={filters.status}
                            onValueChange={(value: 'all' | 'visible' | 'hidden') =>
                              handleFilterChange({ status: value })
                            }
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="visible">Visible</SelectItem>
                              <SelectItem value="hidden">Hidden</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={filters.tag}
                            onValueChange={(value) => handleFilterChange({ tag: value })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="All Tags" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Tags</SelectItem>
                              {availableTags.map((tag) => (
                                <SelectItem key={tag} value={tag}>
                                  {tag}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {hasActiveFilters && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearFilters}
                              className="h-8 px-2"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeTab === 'products' && (
                      <>
                        {loadingProducts ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading products…
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {products.map((product) => (
                                <Card key={product.id}>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-base line-clamp-1">{product.title}</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {/* Price (min across variants) */}
                                    {product.variants && product.variants.length > 0 && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Price:</span>
                                        <span className="font-medium">
                                          ${formatCentsUSD(Math.min(...product.variants.map(v => v.price)))}
                                          {product.variants.some(v => v.price !== product.variants[0].price) && '+'}
                                        </span>
                                      </div>
                                    )}

                                    {/* Tags */}
                                    {product.tags && product.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {product.tags.slice(0, 3).map((tag, index) => (
                                          <Badge key={index} variant="outline" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                        {product.tags.length > 3 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{product.tags.length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 mt-3">
                                      <ProductCreator
                                        storeId={selectedStore!.id.toString()}
                                        templateProduct={product}
                                        onSuccess={handleProductCreated}
                                        trigger={
                                          <Button variant="outline" size="sm" className="flex-1">
                                            <Copy className="h-3 w-3 mr-1" />
                                            Duplicate
                                          </Button>
                                        }
                                      />
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="flex-1"
                                        onClick={async () => {
                                          if (!selectedStore) return;
                                          const confirmed = window.confirm(`Delete "${product.title}"? This cannot be undone.`);
                                          if (!confirmed) return;
                                          try {
                                            const res = await fetch(`/api/printify/products/${product.id}?storeId=${selectedStore.id}`, { method: 'DELETE' });
                                            const data = await res.json();
                                            if (!data.success) throw new Error(data.details || data.error || 'Failed to delete');
                                            await fetchProducts(selectedStore.id.toString());
                                          } catch (err) {
                                            console.error('Failed to delete product', err);
                                            alert(err instanceof Error ? err.message : 'Failed to delete product');
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {/* Load More */}
                            {products.length < totalProducts && (
                              <div className="flex justify-center mt-6">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    if (!selectedStore) return;
                                    const nextOffset = pageOffset + PAGE_LIMIT;
                                    fetchProducts(selectedStore.id.toString(), { offset: nextOffset, append: true });
                                  }}
                                  disabled={loadingProducts}
                                >
                                  {loadingProducts ? (
                                    <span>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading...
                                    </span>
                                  ) : (
                                    'Load More'
                                  )}
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {activeTab === 'bulk' && (
                      <p className="text-sm text-muted-foreground">Use the bulk tools above.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}


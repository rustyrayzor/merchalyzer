import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Store, Package, AlertCircle, Search, Filter, X, Copy, Plus, Trash2, Upload, Tag, Check, LayoutGrid, List, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn, formatCentsUSD } from '@/lib/utils';
import { PrintifyStore, PrintifyProduct } from '@/lib/types';
import ProductCreator from '@/components/printify/ProductCreator';
import TagInput from '@/components/ui/tag-input';

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
  hasMore?: boolean;
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
  // const [totalProducts, setTotalProducts] = useState(0); // unused
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_LIMIT = 50;
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [bulkCsv, setBulkCsv] = useState<File | null>(null);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<{ running: boolean; created: number; failed: number; total: number; message?: string } | null>(null);
  const [bulkResults, setBulkResults] = useState<Array<{ title: string; imageName: string; success: boolean; error?: string }>>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'bulk'>('products');
  // Bulk preview/mapping state
  const [bulkFolderFiles, setBulkFolderFiles] = useState<File[]>([]);
  const [bulkRowsPreview, setBulkRowsPreview] = useState<Array<{ title: string; imageName: string; file?: File; previewUrl?: string; matched: boolean; selected: boolean }>>([]);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    status: 'all',
    tag: '',
    showFilters: false,
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const applyUpdatedTags = (productId: string, newTags: string[]) => {
    setProducts(prev => {
      const next = prev.map(p => (p.id === productId ? { ...p, tags: newTags } : p));
      const all = new Set<string>();
      next.forEach(p => p.tags?.forEach(t => all.add(t)));
      setAvailableTags(Array.from(all).sort());
      return next;
    });
  };

  const applyUpdatedTitle = (productId: string, newTitle: string) => {
    setProducts(prev => prev.map(p => (p.id === productId ? { ...p, title: newTitle } : p)));
  };

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

      setProducts(prev => {
        const incoming = data.data || [];
        if (options?.append) {
          const seen = new Set(prev.map(p => p.id));
          const merged = [...prev];
          for (const p of incoming) {
            if (!seen.has(p.id)) {
              merged.push(p);
              seen.add(p.id);
            }
          }
          return merged;
        }
        // On refresh, ensure uniqueness as well
        const deduped: PrintifyProduct[] = [];
        const seen = new Set<string>();
        for (const p of incoming) {
          if (!seen.has(p.id)) {
            deduped.push(p);
            seen.add(p.id);
          }
        }
        return deduped;
      });
      // total count unused in UI
      setPageOffset(effectiveOffset);
      setHasMore(Boolean(data.hasMore ?? ((data.data?.length || 0) === PAGE_LIMIT)));

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
    setHasMore(false);
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
      setHasMore(false);
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

  // Helpers for bulk flow
  const parseCsvToRows = async (csvFile: File): Promise<Array<{ title: string; imageName: string }>> => {
    const text = await csvFile.text();
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
    return rows;
  };

  const mapRowsToFolder = (rows: Array<{ title: string; imageName: string }>, files: File[]) => {
    // Build index by lowercase basename and basename without extension
    const byBase: Map<string, File> = new Map();
    const byStem: Map<string, File> = new Map();
    for (const f of files) {
      const name = (f.name || '').toLowerCase();
      const stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
      byBase.set(name, f);
      if (!byStem.has(stem)) byStem.set(stem, f);
    }
    // Revoke any previous object URLs
    setBulkRowsPreview(prev => {
      prev.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
      return prev;
    });
    const mapped = rows.map(r => {
      const wanted = (r.imageName || '').split(/[/\\]/).pop()!.toLowerCase();
      const stem = wanted.includes('.') ? wanted.slice(0, wanted.lastIndexOf('.')) : wanted;
      let f: File | undefined = byBase.get(wanted);
      if (!f) {
        // try by stem if CSV omits or differs by extension
        f = byStem.get(stem);
      }
      const previewUrl = f ? URL.createObjectURL(f) : undefined;
      return { title: r.title, imageName: r.imageName, file: f, previewUrl, matched: Boolean(f), selected: Boolean(f) };
    });
    setBulkRowsPreview(mapped);
  };

  const handleFolderInput = (fileList: FileList | null) => {
    const all = fileList ? Array.from(fileList) : [];
    const images = all.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    setBulkFolderFiles(images);
    const csvCandidates = all.filter(f => /\.csv$/i.test(f.name));
    const pickedCsv = csvCandidates[0] || null;
    if (pickedCsv) setBulkCsv(pickedCsv);
    const csvToUse = pickedCsv || bulkCsv;
    if (csvToUse) {
      parseCsvToRows(csvToUse).then(rows => mapRowsToFolder(rows, images)).catch(err => {
        console.error('CSV parse error:', err);
        setBulkRowsPreview([]);
      });
    }
  };

  // Drag & drop folder support (recursively traverses directories)
  type FileSystemEntry = {
    isFile: boolean;
    isDirectory: boolean;
    file: (cb: (file: File) => void) => void;
    createReader: () => { readEntries: (cb: (entries: FileSystemEntry[]) => void) => void };
  };

  const gatherFilesFromItems = async (items: DataTransferItemList): Promise<File[]> => {
    const traverseEntry = async (entry: FileSystemEntry | null): Promise<File[]> => {
      return new Promise((resolve) => {
        if (!entry) return resolve([]);
        if (entry.isFile) {
          entry.file((file: File) => resolve([file]));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          reader.readEntries(async (entries: FileSystemEntry[]) => {
            const batches = await Promise.all(entries.map(traverseEntry));
            resolve(batches.flat());
          });
        } else {
          resolve([]);
        }
      });
    };
    const promises: Promise<File[]>[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const entry = (it as unknown as { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() || null;
      if (entry) promises.push(traverseEntry(entry));
      else {
        const file = it.getAsFile();
        if (file) promises.push(Promise.resolve([file]));
      }
    }
    return (await Promise.all(promises)).flat();
  };

  const handleDropOnZone = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const items = e.dataTransfer?.items;
    let allFiles: File[] = [];
    if (items && items.length > 0) {
      try {
        allFiles = await gatherFilesFromItems(items);
      } catch {
        allFiles = Array.from(e.dataTransfer?.files || []);
      }
    } else {
      allFiles = Array.from(e.dataTransfer?.files || []);
    }
    const images = allFiles.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    setBulkFolderFiles(images);
    const csvCandidates = allFiles.filter(f => /\.csv$/i.test(f.name));
    const pickedCsv = csvCandidates[0] || null;
    if (pickedCsv) setBulkCsv(pickedCsv);
    const csvToUse = pickedCsv || bulkCsv;
    if (csvToUse) {
      try {
        const rows = await parseCsvToRows(csvToUse);
        mapRowsToFolder(rows, images);
      } catch (err) {
        console.error('CSV parse error:', err);
        setBulkRowsPreview([]);
      }
    }
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
                          <span>{products.length}{hasMore ? '+' : ''} products</span>
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
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewMode('list')}
                              title="List view"
                            >
                              <List className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewMode('grid')}
                              title="Grid view"
                            >
                              <LayoutGrid className="h-4 w-4" />
                            </Button>
                          </div>
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
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0] || null;
                                    setBulkCsv(file);
                                    if (file) {
                                      try {
                                        const rows = await parseCsvToRows(file);
                                        if (bulkFolderFiles.length > 0) mapRowsToFolder(rows, bulkFolderFiles);
                                        else setBulkRowsPreview(rows.map(r => ({ ...r, matched: false, selected: false })));
                                      } catch (err) {
                                        console.error('CSV parse error:', err);
                                        setBulkRowsPreview([]);
                                      }
                                    } else {
                                      setBulkRowsPreview([]);
                                    }
                                  }}
                                  id="bulk-csv-input"
                                />
                                <Button asChild variant="outline">
                                  <label htmlFor="bulk-csv-input" className="cursor-pointer">
                                    <Upload className="h-4 w-4 mr-2" /> Choose CSV
                                  </label>
                                </Button>
                                <span className="text-sm text-muted-foreground">{bulkCsv?.name || 'No file selected'}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">CSV headers required: Title, Image Name.</p>
                            </div>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Images Folder</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                multiple
                                {...({ webkitdirectory: '' } as unknown as Record<string, unknown>)}
                                className="hidden"
                                onChange={(e) => handleFolderInput(e.target.files)}
                                id="bulk-folder-input"
                              />
                              <Button asChild variant="outline">
                                <label htmlFor="bulk-folder-input" className="cursor-pointer">
                                  <Upload className="h-4 w-4 mr-2" /> Choose Folder
                                </label>
                              </Button>
                              <span className="text-sm text-muted-foreground">
                                {bulkFolderFiles.length > 0 ? `${bulkFolderFiles.length} image(s) selected` : 'No folder selected'}
                              </span>
                            </div>
                            <div
                              ref={dropRef}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onDrop={handleDropOnZone}
                              className="mt-2 border border-dashed rounded-md p-4 text-sm text-muted-foreground hover:bg-muted/30"
                            >
                              Drag and drop a folder containing your CSV and images to auto-detect and preview. You can also choose a folder above.
                            </div>
                          </div>

                          {bulkRowsPreview.length > 0 && (
                            <div className="space-y-2 md:col-span-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                  Previewing {bulkRowsPreview.length} row(s). Matched {bulkRowsPreview.filter(r => r.matched).length}, Missing {bulkRowsPreview.filter(r => !r.matched).length}. Selected {bulkRowsPreview.filter(r => r.selected).length}.
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkRowsPreview(prev => prev.map(r => ({ ...r, selected: r.matched })))}
                                  >Select All</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkRowsPreview(prev => prev.map(r => ({ ...r, selected: false })))}
                                  >Clear</Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setBulkRowsPreview(prev => {
                                      prev.forEach(p => { if (p.selected && p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
                                      return prev.filter(p => !p.selected);
                                    })}
                                  >Remove Selected</Button>
                                </div>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {bulkRowsPreview.map((r, idx) => (
                                  <div key={`${r.title}-${idx}`} className="border rounded-md p-3 flex items-center gap-3">
                                    <Checkbox
                                      checked={r.selected}
                                      onCheckedChange={(checked) => setBulkRowsPreview(prev => prev.map((p, i) => i === idx ? { ...p, selected: checked === true } : p))}
                                      disabled={!r.matched}
                                    />
                                    <div className="w-16 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
                                      {r.previewUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.previewUrl} alt={r.imageName} className="object-contain w-full h-full" />
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground text-center px-1">No image</span>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium truncate" title={r.title}>{r.title}</div>
                                      <div className="text-xs text-muted-foreground truncate" title={r.imageName}>{r.imageName}</div>
                                      <div className={`text-xs ${r.matched ? 'text-green-600' : 'text-red-600'}`}>{r.matched ? 'Matched' : 'Missing'}</div>
                                    </div>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setBulkRowsPreview(prev => {
                                        const next = [...prev];
                                        const removed = next.splice(idx, 1)[0];
                                        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                                        return next;
                                      })}
                                      title="Remove"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 md:col-span-2">
                            <Button
                              onClick={async () => {
                                if (!selectedStore || !bulkCsv || !bulkTemplateId) return;
                                try {
                                  // If folder provided, run client-side duplicates with data URLs; otherwise fallback to server bulk
                                  if (bulkFolderFiles.length > 0 && bulkRowsPreview.length > 0) {
                                    const selectedPreviews = bulkRowsPreview.filter(p => p.selected && p.file);
                                    if (selectedPreviews.length === 0) {
                                      setBulkStatus({ running: false, created: 0, failed: 0, total: 0, message: 'No selected rows to process' });
                                      return;
                                    }
                                    setBulkStatus({ running: true, created: 0, failed: 0, total: selectedPreviews.length });
                                    setBulkResults([]);
                                    const results: Array<{ title: string; imageName: string; success: boolean; error?: string }> = [];
                                    for (const row of selectedPreviews) {
                                      try {
                                        const file = row.file as File | undefined;
                                        if (!file) {
                                          results.push({ title: row.title, imageName: row.imageName, success: false, error: 'Image not found in folder' });
                                          setBulkResults([...results]);
                                          continue;
                                        }
                                        const dataUrl: string = await new Promise((resolve, reject) => {
                                          const reader = new FileReader();
                                          reader.onload = () => resolve(String(reader.result));
                                          reader.onerror = () => reject(new Error('Failed to read image'));
                                          reader.readAsDataURL(file);
                                        });
                                        const payload = {
                                          storeId: selectedStore.id.toString(),
                                          productId: bulkTemplateId,
                                          overrides: {
                                            title: row.title,
                                            images: [{ src: dataUrl, position: 'front' }],
                                          },
                                        };
                                        const dupRes = await fetch('/api/printify/products/duplicate', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(payload),
                                        });
                                        const dupJson = await dupRes.json().catch(() => ({}));
                                        if (!dupRes.ok || !dupJson?.success) {
                                          results.push({ title: row.title, imageName: row.imageName, success: false, error: dupJson?.details || dupJson?.error || `${dupRes.status} ${dupRes.statusText}` });
                                        } else {
                                          results.push({ title: row.title, imageName: row.imageName, success: true });
                                        }
                                        setBulkResults([...results]);
                                      } catch (e) {
                                        results.push({ title: row.title, imageName: row.imageName, success: false, error: e instanceof Error ? e.message : 'Unknown error' });
                                        setBulkResults([...results]);
                                      }
                                    }
                                    const created = results.filter(r => r.success).length;
                                    const failed = results.length - created;
                                    setBulkStatus({ running: false, created, failed, total: results.length });
                                    fetchProducts(selectedStore.id.toString(), { offset: 0, append: false });
                                  } else {
                                    setBulkStatus({ running: true, created: 0, failed: 0, total: 0 });
                                    const rows = await parseCsvToRows(bulkCsv);
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
                                  }
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
                              <p className="text-sm text-muted-foreground">Upload a CSV and select a folder to preview, then start bulk.</p>
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
                            {viewMode === 'list' && (
                              <div className="border rounded-md divide-y">
                                {products.map((product) => {
                                  const cover = (product.images && product.images.length > 0)
                                    ? (product.images.find((img) => img.is_default) || product.images[0])
                                    : undefined;
                                  const coverSrc = cover?.src;
                                  const hasVariants = product.variants && product.variants.length > 0;
                                  const minPrice = hasVariants ? Math.min(...product.variants.map(v => v.price)) : null;
                                  const varied = hasVariants ? product.variants.some(v => v.price !== product.variants![0].price) : false;

                                  return (
                                    <div key={product.id} className="flex items-center gap-4 p-3">
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <div className="relative h-24 w-24 bg-muted overflow-hidden rounded cursor-zoom-in group">
                                            {coverSrc ? (
                                              <Image src={coverSrc} alt={product.title} fill sizes="96px" className="object-cover" />
                                            ) : (
                                              <div className="flex items-center justify-center h-24 w-24 text-xs text-muted-foreground">No image</div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs sm:text-sm opacity-0 transition-opacity group-hover:opacity-100">
                                              Click to preview
                                            </div>
                                          </div>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-4xl p-4">
                                          <DialogHeader>
                                            <DialogTitle className="truncate">{product.title}</DialogTitle>
                                          </DialogHeader>
                                          <div className="relative w-full h-[70vh]">
                                            {coverSrc ? (
                                              <Image src={coverSrc} alt={product.title} fill sizes="100vw" className="object-contain object-center" />
                                            ) : (
                                              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No image</div>
                                            )}
                                          </div>
                                          {/* All color previews (front) */}
                                          {(() => {
                                            const previews = getFrontPreviews(product);
                                            if (previews.length === 0) return null;
                                            return (
                                              <div className="mt-4">
                                                <div className="text-sm text-muted-foreground mb-2">All colors (front)</div>
                                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                                                  {previews.map((pv, idx) => (
                                                    <div key={`${pv.color}-${idx}`} className="">
                                                      <div className="relative w-full aspect-[4/5] rounded overflow-hidden">
                                                        {pv.src ? (
                                                          <Image src={pv.src} alt={`${product.title} - ${pv.color}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain bg-muted" />
                                                        ) : (
                                                          <div className="flex items-center justify-center w-full h-full text-xs bg-muted" style={{ backgroundColor: pv.swatch || undefined }}>
                                                            No preview
                                                          </div>
                                                        )}
                                                      </div>
                                                      <div className="mt-1 text-xs text-center truncate">{pv.color}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </DialogContent>
                                      </Dialog>
                                      <div className="flex-1 min-w-0">
                                        <TitleBlock
                                          product={product}
                                          storeId={selectedStore!.id.toString()}
                                          onSaved={(t) => applyUpdatedTitle(product.id, t)}
                                        />
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          {hasVariants ? (
                                            <>
                                              From ${formatCentsUSD(minPrice!)}{varied && '+'}
                                            </>
                                          ) : (
                                            '—'
                                          )}
                                        </div>
                                        <div className="mt-1">
                                          <TagsBlock
                                            product={product}
                                            storeId={selectedStore!.id.toString()}
                                            onSaved={(tags) => applyUpdatedTags(product.id, tags)}
                                          />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <ProductCreator
                                          storeId={selectedStore!.id.toString()}
                                          templateProduct={product}
                                          onSuccess={handleProductCreated}
                                          trigger={
                                            <Button variant="outline" size="sm">
                                              <Copy className="h-3 w-3 mr-1" />
                                              Duplicate
                                            </Button>
                                          }
                                        />
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={async () => {
                                            if (!selectedStore) return;
                                            const confirmed = window.confirm(`Delete \"${product.title}\"? This cannot be undone.`);
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
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {viewMode === 'grid' && (
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {products.map((product) => {
                                const cover = (product.images && product.images.length > 0)
                                  ? (product.images.find((img) => img.is_default) || product.images[0])
                                  : undefined;
                                const coverSrc = cover?.src;

                                return (
                                  <Card key={product.id}>
                                    {/* Product cover image */}
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden cursor-zoom-in group">
                                            {coverSrc ? (
                                              <Image
                                                src={coverSrc}
                                                alt={product.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                className="object-cover"
                                              />
                                            ) : (
                                              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                                No image
                                              </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm opacity-0 transition-opacity group-hover:opacity-100">
                                              Click to preview
                                            </div>
                                          </div>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-4xl p-4">
                                          <DialogHeader>
                                            <DialogTitle className="truncate">{product.title}</DialogTitle>
                                          </DialogHeader>
                                          <div className="relative w-full h-[70vh]">
                                            {coverSrc ? (
                                              <Image src={coverSrc} alt={product.title} fill sizes="100vw" className="object-contain object-center" />
                                            ) : (
                                              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No image</div>
                                            )}
                                          </div>
                                          {/* All color previews (front) */}
                                          {(() => {
                                            const previews = getFrontPreviews(product);
                                            if (previews.length === 0) return null;
                                            return (
                                              <div className="mt-4">
                                                <div className="text-sm text-muted-foreground mb-2">All colors (front)</div>
                                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                                                  {previews.map((pv, idx) => (
                                                    <div key={`${pv.color}-${idx}`} className="">
                                                      <div className="relative w-full aspect-[4/5] rounded bg-muted overflow-hidden">
                                                        {pv.src ? (
                                                          <Image src={pv.src} alt={`${product.title} - ${pv.color}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain" />
                                                        ) : (
                                                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No image</div>
                                                        )}
                                                      </div>
                                                      <div className="mt-1 text-xs text-center truncate">{pv.color}</div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </DialogContent>
                                      </Dialog>
                                      <CardHeader className="pb-2">
                                        <TitleBlock
                                          product={product}
                                          storeId={selectedStore!.id.toString()}
                                          onSaved={(t) => applyUpdatedTitle(product.id, t)}
                                          compact
                                        />
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
                                    {product.tags && (
                                      <TagsBlock
                                        product={product}
                                        storeId={selectedStore!.id.toString()}
                                        onSaved={(tags) => applyUpdatedTags(product.id, tags)}
                                      />
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
                              );
                              })}
                              </div>
                            )}

                            {/* Load More */}
                            {hasMore && (
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

// Local component to manage viewing/editing tags per product
function TagsBlock({ product, storeId, onSaved }: { product: PrintifyProduct; storeId: string; onSaved: (tags: string[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(product.tags || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTags(product.tags || []);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/printify/products/${product.id}?storeId=${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.details || data.error || 'Failed to update tags');
      onSaved(tags);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tags');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {(product.tags || []).slice(0, 3).map((t, idx) => (
              <Badge key={`${t}-${idx}`} variant="outline" className="text-xs">{t}</Badge>
            ))}
            {(product.tags || []).length > 3 && (
              <Badge variant="outline" className="text-xs">+{(product.tags || []).length - 3}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
            <Tag className="h-3.5 w-3.5 mr-1" /> Edit tags
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <TagInput value={tags} onChange={setTags} placeholder="Type a tag, press comma or Enter" />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</>) : (<><Check className="h-4 w-4 mr-2" />Save</>)}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>
          <X className="h-4 w-4 mr-2" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// Local component to manage editing product title
function TitleBlock({ product, storeId, onSaved, compact }: { product: PrintifyProduct; storeId: string; onSaved: (title: string) => void; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState<string>(product.title || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(product.title || '');
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (!title.trim() || title.trim() === product.title) {
      setEditing(false);
      setError(null);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/printify/products/${product.id}?storeId=${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.details || data.error || 'Failed to update title');
      onSaved(title.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update title');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className={compact ? 'text-base font-medium line-clamp-1' : 'font-medium truncate'} title={product.title}>{product.title}</div>
        <Button variant="ghost" size="sm" className={compact ? 'h-7 px-2' : 'h-8 px-2'} onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Product title"
        className={compact ? 'h-8' : ''}
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
          {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving</>) : (<>Save</>)}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>
          <X className="h-4 w-4 mr-2" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// Helper: derive front preview images per color variant
function getFrontPreviews(product: PrintifyProduct): Array<{ color: string; src?: string; swatch?: string }> {
  try {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const images = Array.isArray(product.images) ? product.images : [];
    // Group variant ids by color
    const byColor = new Map<string, { ids: string[]; swatch?: string }>();
    for (const v of variants) {
      const color = (v.color || 'Unknown').trim();
      const id = String(v.id);
      const entry = byColor.get(color) || { ids: [], swatch: (v.color_code || v.color_code2 || '').toString() };
      entry.ids.push(id);
      if (!entry.swatch && (v.color_code || v.color_code2)) entry.swatch = (v.color_code || v.color_code2) as string;
      byColor.set(color, entry);
    }

    const result: Array<{ color: string; src?: string; swatch?: string }> = [];

    // Helper to pick best matching image for a set of variant ids
    const pickFor = (ids: string[]): string | undefined => {
      const withMatch = images
        .filter(img => Array.isArray(img.variant_ids) && img.variant_ids.some((id) => ids.includes(String(id))));
      if (withMatch.length > 0) {
        // Prefer position front, then is_default
        withMatch.sort((a, b) => {
          const af = String(a.position || '').toLowerCase() === 'front' ? 0 : 1;
          const bf = String(b.position || '').toLowerCase() === 'front' ? 0 : 1;
          if (af !== bf) return af - bf;
          const ad = a.is_default ? 0 : 1;
          const bd = b.is_default ? 0 : 1;
          return ad - bd;
        });
        return withMatch[0]!.src;
      }
      // Fallback to any variant.image
      const v = variants.find(v => ids.includes(String(v.id)) && typeof v.image === 'string' && v.image);
      return v?.image;
    };

    for (const [color, { ids, swatch }] of byColor.entries()) {
      const src = pickFor(ids);
      result.push({ color, src, swatch });
    }

    // Sort by color name for stable output
    result.sort((a, b) => a.color.localeCompare(b.color));
    return result;
  } catch {
    return [];
  }
}


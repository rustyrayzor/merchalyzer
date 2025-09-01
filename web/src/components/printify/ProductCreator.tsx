import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, X, Copy, Tag, ArrowLeft } from 'lucide-react';
import { PrintifyProduct } from '@/lib/types';

interface ProductCreatorProps {
  storeId: string;
  templateProduct?: PrintifyProduct;
  trigger?: React.ReactNode;
  onSuccess?: (product: PrintifyProduct) => void;
}

interface ProductFormData {
  title: string;
  description: string;
  images: {
    front: string;
    back: string;
    neck: string;
  };
  tags: string[];
  mockups: {
    front: string;
    back: string;
    neck: string;
  };
}

export default function ProductCreator({ storeId, templateProduct, trigger, onSuccess }: ProductCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    images: {
      front: '',
      back: '',
      neck: '',
    },
    tags: [],
    mockups: {
      front: '',
      back: '',
      neck: '',
    },
  });

  // Initialize form with template product data if provided
  useEffect(() => {
    if (templateProduct && isOpen) {
      // Extract design images (non-mockup) by position
      const frontImage = templateProduct.images?.find(img =>
        img.position === 'front' && !img.src.includes('mockup')
      )?.src || '';

      const backImage = templateProduct.images?.find(img =>
        img.position === 'back' && !img.src.includes('mockup')
      )?.src || '';

      const neckImage = templateProduct.images?.find(img =>
        img.position === 'neck' && !img.src.includes('mockup')
      )?.src || '';

      // Extract mockup images by position
      const frontMockup = templateProduct.images?.find(img =>
        img.position === 'front' && img.src.includes('mockup')
      )?.src || templateProduct.images?.find(img =>
        img.position === 'front'
      )?.src || '';

      const backMockup = templateProduct.images?.find(img =>
        img.position === 'back' && img.src.includes('mockup')
      )?.src || templateProduct.images?.find(img =>
        img.position === 'back'
      )?.src || '';

      const neckMockup = templateProduct.images?.find(img =>
        img.position === 'neck' && img.src.includes('mockup')
      )?.src || templateProduct.images?.find(img =>
        img.position === 'neck'
      )?.src || '';

      setFormData({
        title: `${templateProduct.title} (Copy)`,
        description: templateProduct.description || '',
        images: {
          front: frontImage,
          back: backImage,
          neck: neckImage,
        },
        tags: templateProduct.tags || [],
        mockups: {
          front: frontMockup,
          back: backMockup,
          neck: neckMockup,
        },
      });
    } else if (!templateProduct && isOpen) {
      // Reset form for new product
      setFormData({
        title: '',
        description: '',
        images: {
          front: '',
          back: '',
          neck: '',
        },
        tags: [],
        mockups: {
          front: '',
          back: '',
          neck: '',
        },
      });
    }
  }, [templateProduct, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Prepare images array for API
      const images = [];
      if (formData.images.front) {
        images.push({ src: formData.images.front, position: 'front' });
      }
      if (formData.images.back) {
        images.push({ src: formData.images.back, position: 'back' });
      }
      if (formData.images.neck) {
        images.push({ src: formData.images.neck, position: 'neck' });
      }

      let response: Response;
      if (templateProduct) {
        // Duplicate flow: preserve everything by default; override selected fields
        const payload = {
          storeId,
          productId: templateProduct.id,
          overrides: {
            title: formData.title,
            description: formData.description,
            tags: formData.tags,
            images,
          },
        };

        response = await fetch('/api/printify/products/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create-new flow: use original creation endpoint
        const productData = {
          storeId,
          title: formData.title,
          description: formData.description,
          blueprint_id: '',
          variants: [],
          images,
          tags: formData.tags,
          visible: true,
        };

        response = await fetch('/api/printify/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        });
      }

      const result = await response.json();

      if (result.success) {
        setIsOpen(false);
        onSuccess?.(result.data);
        // Reset form
        setFormData({
          title: '',
          description: '',
          images: {
            front: '',
            back: '',
            neck: '',
          },
          tags: [],
          mockups: {
            front: '',
            back: '',
            neck: '',
          },
        });
      } else {
        throw new Error(result.details || result.error);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      // TODO: Show error toast/notification
    } finally {
      setIsLoading(false);
    }
  };

  const updateImage = (position: 'front' | 'back' | 'neck', value: string) => {
    setFormData(prev => ({
      ...prev,
      images: {
        ...prev.images,
        [position]: value
      }
    }));
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleImageUpload = (position: 'front' | 'back' | 'neck', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateImage(position, result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button>
            <Copy className="h-4 w-4 mr-2" />
            {templateProduct ? 'Duplicate Product' : 'Create Product'}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="fixed inset-0 w-full h-full max-w-none sm:max-w-none md:max-w-none lg:max-w-none xl:max-w-none 2xl:max-w-none p-0 border-0"
      >
        <SheetHeader className="sticky top-0 z-10 border-b bg-background p-4">
          <div className="flex items-center gap-3">
            <SheetClose asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Button>
            </SheetClose>
            <SheetTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              {templateProduct ? 'Duplicate Product' : 'Create New Product'}
            </SheetTitle>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 p-4 overflow-y-auto h-[calc(100vh-64px)]">
          {/* Original Product Previews (only for duplication) */}
          {templateProduct && (formData.mockups.front || formData.mockups.back || formData.mockups.neck) && (
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader>
                <CardTitle className="text-lg text-green-800">Original Product Mockups</CardTitle>
                <p className="text-sm text-green-700">
                  Preview of the product you&apos;re duplicating
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                  {formData.mockups.front && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Front</Label>
                      <div className="relative w-full h-48 rounded-md border border-green-200 overflow-hidden">
                        <Image
                          src={formData.mockups.front}
                          alt="Original front mockup"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  {formData.mockups.back && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Back</Label>
                      <div className="relative w-full h-48 rounded-md border border-green-200 overflow-hidden">
                        <Image
                          src={formData.mockups.back}
                          alt="Original back mockup"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  {formData.mockups.neck && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">Neck Label</Label>
                      <div className="relative w-full h-48 rounded-md border border-green-200 overflow-hidden">
                        <Image
                          src={formData.mockups.neck}
                          alt="Original neck mockup"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter product title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter product description"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                {/* Front Image */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Front Image</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={formData.images.front}
                        onChange={(e) => updateImage('front', e.target.value)}
                        placeholder="Enter front image URL"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload('front', file);
                        }}
                        className="hidden"
                        id="front-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('front-upload')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.images.front && (
                      <div className="mt-2 relative w-full h-32 rounded-md border overflow-hidden">
                        <Image
                          src={formData.images.front}
                          alt="Front preview"
                          fill
                          sizes="100vw"
                          className="object-cover"
                          unoptimized
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          New design uploaded
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Image */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Back Image</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={formData.images.back}
                        onChange={(e) => updateImage('back', e.target.value)}
                        placeholder="Enter back image URL"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload('back', file);
                        }}
                        className="hidden"
                        id="back-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('back-upload')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.images.back && (
                      <div className="mt-2 relative w-full h-32 rounded-md border overflow-hidden">
                        <Image
                          src={formData.images.back}
                          alt="Back preview"
                          fill
                          sizes="100vw"
                          className="object-cover"
                          unoptimized
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          New design uploaded
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Neck Label */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Neck Label</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={formData.images.neck}
                        onChange={(e) => updateImage('neck', e.target.value)}
                        placeholder="Enter neck label URL"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload('neck', file);
                        }}
                        className="hidden"
                        id="neck-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('neck-upload')?.click()}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.images.neck && (
                      <div className="mt-2 relative w-full h-32 rounded-md border overflow-hidden">
                        <Image
                          src={formData.images.neck}
                          alt="Neck label preview"
                          fill
                          sizes="100vw"
                          className="object-cover"
                          unoptimized
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          New design uploaded
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* T-Shirt Previews */}
          {(formData.mockups.front || formData.mockups.back || formData.mockups.neck) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">T-Shirt Previews</CardTitle>
                <p className="text-sm text-muted-foreground">
                  See how your designs will look on the actual product
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                  {/* Front Preview */}
                  {formData.mockups.front && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Front Preview</Label>
                      <div className="relative w-full h-64 rounded-md border bg-gray-50 overflow-hidden">
                        <Image
                          src={formData.mockups.front}
                          alt="Front mockup preview"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                        {formData.images.front && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs">
                              Design Updated
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Back Preview */}
                  {formData.mockups.back && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Back Preview</Label>
                      <div className="relative w-full h-64 rounded-md border bg-gray-50 overflow-hidden">
                        <Image
                          src={formData.mockups.back}
                          alt="Back mockup preview"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                        {formData.images.back && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs">
                              Design Updated
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Neck Preview */}
                  {formData.mockups.neck && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Neck Label Preview</Label>
                      <div className="relative w-full h-64 rounded-md border bg-gray-50 overflow-hidden">
                        <Image
                          src={formData.mockups.neck}
                          alt="Neck label mockup preview"
                          fill
                          sizes="(max-width: 1024px) 100vw, 33vw"
                          className="object-contain"
                          unoptimized
                        />
                        {formData.images.neck && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs">
                              Design Updated
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> These previews show the original mockups. When you upload new designs,
                    the actual product will reflect your changes. The preview above helps you visualize the
                    final result on the t-shirt.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          addTag(input.value.trim());
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Add a tag..."]') as HTMLInputElement;
                      if (input?.value.trim()) {
                        addTag(input.value.trim());
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background p-4 -mx-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

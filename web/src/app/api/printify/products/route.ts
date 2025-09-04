import { NextRequest, NextResponse } from 'next/server';
import { createPrintifyClient } from '@/lib/printify';

// Minimal types for product creation payload
type NewImage = { src: string; position?: string };
type NewPlaceholder = { position?: string; images: unknown[] };
type NewPrintArea = { variant_ids: number[]; placeholders: NewPlaceholder[] };
type NewProductPayload = {
  title: string;
  blueprint_id: number;
  description?: string;
  images?: NewImage[];
  tags?: string[];
  visible?: boolean;
  print_provider_id?: number;
  variants?: Array<{ id: number; price: number; is_enabled?: boolean }>;
  print_areas?: NewPrintArea[];
};

// Product creation request interface
interface CreateProductRequest {
  storeId: string;
  title: string;
  description?: string;
  blueprint_id: string;
  print_provider_id?: string;
  variants: Array<{
    id: string;
    price: number;
    cost?: number;
    sku?: string;
  }>;
  images?: Array<{
    src: string;
    position?: string;
  }>;
  tags?: string[];
  visible?: boolean;
  // Used to duplicate from an existing product
  templateProduct?: {
    blueprint_id?: string | number;
    print_provider_id?: string | number;
    print_provider?: { id?: string | number };
    print_areas?: NewPrintArea[];
    variants?: Array<{ id: string | number; price?: number; cost?: number; is_enabled?: boolean }>;
    id?: string | number;
  };
}

/**
 * GET /api/printify/products?storeId=<store_id>&search=<query>&status=<visible|hidden>&tag=<tag>&limit=<num>&offset=<num>
 * Fetches all products for a specific Printify store with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const search = searchParams.get('search');
    const status = searchParams.get('status'); // 'visible', 'hidden', or 'all'
    const tag = searchParams.get('tag');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing store ID',
          details: 'Please provide a storeId parameter'
        },
        { status: 400 }
      );
    }

    // Create Printify client
    const printifyClient = createPrintifyClient();

    // Fetch products page (default 20)
    const parsedLimit = limit ? Math.max(1, Math.min(50, parseInt(limit, 10))) : 20;
    const parsedOffset = offset ? Math.max(0, parseInt(offset, 10)) : 0;
    const { products: pageProducts, total } = await printifyClient.getStoreProductsPage(
      storeId,
      parsedLimit,
      parsedOffset,
    );

    // Apply filters
    let filteredProducts = pageProducts;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(product =>
        product.title.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (status && status !== 'all') {
      filteredProducts = filteredProducts.filter(product =>
        status === 'visible' ? product.visible : !product.visible
      );
    }

    // Tag filter
    if (tag) {
      filteredProducts = filteredProducts.filter(product =>
        product.tags?.includes(tag)
      );
    }

    // totalCount: total from Printify (store-wide), not just the page
    const totalCount = typeof total === 'number' ? total : filteredProducts.length;

    // Determine if there are more products to load. Use raw page data (pre-filter)
    // so searches/tags don't hide the option to fetch next pages.
    const hasMore =
      typeof total === 'number'
        ? parsedOffset + pageProducts.length < total
        : pageProducts.length === parsedLimit;

    return NextResponse.json({
      success: true,
      data: filteredProducts,
      count: filteredProducts.length,
      totalCount,
      hasMore,
      storeId,
      filters: {
        search: search || null,
        status: status || 'all',
        tag: tag || null,
        limit: parsedLimit || null,
        offset: parsedOffset || 0,
      },
    });

  } catch (error) {
    console.error('Error fetching Printify products:', error);

    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes('PRINTIFY_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API key not configured',
            details: 'Please set PRINTIFY_API_KEY in your environment variables'
          },
          { status: 500 }
        );
      }

      if (error.message.includes('Printify API error')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API error',
            details: error.message
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: 'Failed to fetch Printify products'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/printify/products
 * Creates a new product in the specified Printify store
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProductRequest = await request.json();

    // Validate required fields (allow blueprint_id to come from templateProduct)
    const hasBlueprint = Boolean(body.blueprint_id || body.templateProduct?.blueprint_id);
    if (!body.storeId || !body.title || !hasBlueprint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'storeId, title, and blueprint_id (or templateProduct with blueprint_id) are required'
        },
        { status: 400 }
      );
    }

    // Prepare product data for Printify API
    const productData = {
      title: body.title,
      description: body.description || '',
      blueprint_id: body.blueprint_id,
      variants: body.variants.map(variant => ({
        id: variant.id,
        price: variant.price,
        cost: variant.cost || variant.price * 0.4, // Default cost to 40% of price
        sku: variant.sku || `${body.title.replace(/\s+/g, '-').toLowerCase()}-${variant.id}`,
      })),
      images: body.images || [],
      tags: body.tags || [],
      visible: body.visible !== false, // Default to visible
    };

    // Create the product using Printify API
    try {
      // Ensure we have a Printify client (validates API key presence)
      createPrintifyClient();

      // Validate required data
      // Prefer explicit blueprint_id; fall back to template product if provided
      const resolvedBlueprintId = productData.blueprint_id
        ? parseInt(productData.blueprint_id)
        : (body.templateProduct?.blueprint_id ? parseInt(String(body.templateProduct.blueprint_id)) : NaN);
      if (!resolvedBlueprintId || isNaN(resolvedBlueprintId) || resolvedBlueprintId <= 0) {
        throw new Error(`Invalid blueprint_id: "${productData.blueprint_id ?? body.templateProduct?.blueprint_id}" must be a valid positive number`);
      }

      if (!productData.title || productData.title.trim().length === 0) {
        throw new Error('Title is required and cannot be empty');
      }

      // Validate title length (Printify has limits)
      if (productData.title.trim().length > 255) {
        throw new Error('Title is too long (max 255 characters)');
      }

      // Prepare the product data for Printify API
      const printifyProductData: NewProductPayload = {
        title: productData.title.trim(),
        blueprint_id: resolvedBlueprintId,
      };

      // Add optional fields only if they have valid data
      if (productData.description?.trim()) {
        printifyProductData.description = productData.description.trim();
      }

      // Only add images if they have valid sources
      const validImages = productData.images.filter(img => img.src && img.src.trim());
      if (validImages.length > 0) {
        printifyProductData.images = validImages;

        // Also add images to appropriate placeholders in print_areas
        if (printifyProductData.print_areas) {
          printifyProductData.print_areas = printifyProductData.print_areas.map((area: NewPrintArea) => {
            let updatedPlaceholders = area.placeholders || [];

            // If no placeholders exist, create them for our image positions
            if (updatedPlaceholders.length === 0) {
              const positions = [...new Set(validImages.map(img => img.position))];
              updatedPlaceholders = positions.map(position => ({
                position,
                images: []
              }));
            }

            // Update placeholders with our images
            updatedPlaceholders = updatedPlaceholders.map((placeholder: NewPlaceholder) => {
              // Find images that match this placeholder's position
              const matchingImages = validImages.filter(img => img.position === placeholder.position);
               return {
                 ...placeholder,
                 images: matchingImages.map(img => ({
                   src: img.src,
                   // Add minimal required fields for new images
                   name: `Custom ${placeholder.position} design`,
                   type: 'image/png', // Assume PNG, could be enhanced to detect actual type
                   x: 0.5, // Center horizontally
                   y: 0.5, // Center vertically
                   scale: 1,
                   angle: 0
                 }))
               };
            });

            return {
              ...area,
              placeholders: updatedPlaceholders
            };
          });
        }
      }

      // Only add tags if there are any
      if (productData.tags && productData.tags.length > 0) {
        printifyProductData.tags = productData.tags;
      }

      // Only add visible if it's explicitly set to false
      if (productData.visible === false) {
        printifyProductData.visible = false;
      }

      // Determine print_provider_id (required by Printify) from request or template
      const resolvedPrintProviderId = body.print_provider_id
        ?? body.templateProduct?.print_provider_id
        ?? body.templateProduct?.print_provider?.id;
      if (resolvedPrintProviderId) {
        printifyProductData.print_provider_id = parseInt(String(resolvedPrintProviderId));
      }

      // Determine variants: prefer provided; otherwise derive from template
      if (Array.isArray(body.variants) && body.variants.length > 0) {
        printifyProductData.variants = body.variants.map(v => ({
          id: parseInt(String(v.id)),
          price: parseInt(String(v.price)),
          // Keep enabled by default unless explicitly disabled later
          is_enabled: true,
        }));
      } else if (Array.isArray(body.templateProduct?.variants) && body.templateProduct.variants.length > 0) {
        printifyProductData.variants = body.templateProduct.variants.map((v: { id: string | number; price?: number; cost?: number; is_enabled?: boolean }) => ({
          id: parseInt(String(v.id)),
          price: parseInt(String(v.price ?? v.cost ?? 0)),
          is_enabled: Boolean(v.is_enabled ?? true),
        }));
      }

      // CRITICAL: Add print_areas from template product - this is required by Printify
      if (body.templateProduct?.print_areas) {
        // Clean the print_areas by removing specific images from placeholders
        // This prevents conflicts with the original product's images
        printifyProductData.print_areas = (body.templateProduct.print_areas || []).map((area: NewPrintArea) => ({
          ...area,
          placeholders: (area.placeholders || []).map((placeholder: NewPlaceholder) => ({
            ...placeholder,
            images: [] // Remove existing images for new product
          })) || []
        }));
      } else if (body.templateProduct?.variants) {
        // Fallback: create basic print areas using variant IDs from template
        printifyProductData.print_areas = [
          {
            variant_ids: (body.templateProduct.variants || []).map((v: { id: string | number }) => parseInt(String(v.id))),
            placeholders: [] // No placeholders for basic structure
          }
        ];
      } else {
        // Last resort: try to use the variants from the main productData
        printifyProductData.print_areas = [
          {
            variant_ids: (productData.variants || []).map(v => parseInt(String(v.id))) || [],
            placeholders: [] // No placeholders for basic structure
          }
        ];
      }

      console.log('=== SENDING TO PRINTIFY API ===');
      console.log('Store ID:', body.storeId);
      console.log('Template Product ID:', body.templateProduct?.id || 'None');
      console.log('API Key exists:', !!process.env.PRINTIFY_API_KEY);
      console.log('API Key prefix:', process.env.PRINTIFY_API_KEY?.substring(0, 10));
      console.log('Data:', JSON.stringify(printifyProductData, null, 2));
      console.log('================================');

      // Make the actual API call to Printify
      const createResponse = await fetch(`https://api.printify.com/v1/shops/${body.storeId}/products.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Merchalyzer/1.0',
        },
        body: JSON.stringify(printifyProductData),
      });

      console.log('Printify API response status:', createResponse.status);
      console.log('Response headers:', Object.fromEntries(createResponse.headers.entries()));

      // Try to get response text for debugging
      let responseText = '';
      try {
        responseText = await createResponse.text();
        console.log('Raw response text:', responseText);
      } catch (e) {
        console.log('Could not read response text:', e);
      }

      if (!createResponse.ok) {
        let errorData;
        try {
          // First try to parse as JSON
          if (responseText) {
            errorData = JSON.parse(responseText);
          } else {
            errorData = await createResponse.json();
          }
        } catch {
          // If JSON parsing fails, use the raw text
          errorData = { message: responseText || 'Unknown error' };
        }
        console.error('=== PRINTIFY API ERROR DETAILS ===');
        console.error('Status:', createResponse.status, createResponse.statusText);
        console.error('Error Data:', JSON.stringify(errorData, null, 2));
        console.error('Sent Data:', JSON.stringify(printifyProductData, null, 2));
        console.error('Headers:', Object.fromEntries(createResponse.headers.entries()));
        console.error('=====================================');

        // Try to get more specific error information
        let specificError = 'Validation failed';
        if (errorData.errors) {
          specificError = JSON.stringify(errorData.errors);
        } else if (errorData.message) {
          specificError = errorData.message;
        } else if (typeof errorData === 'string') {
          specificError = errorData;
        }

        throw new Error(`Printify API error: ${createResponse.status} - ${specificError}`);
      }

      let createdProduct;
      try {
        if (responseText) {
          createdProduct = JSON.parse(responseText);
        } else {
          createdProduct = await createResponse.json();
        }
      } catch (e) {
        console.error('Failed to parse successful response:', e);
        createdProduct = { id: 'unknown', message: 'Product created but response parsing failed' };
      }

      console.log('Printify product created successfully:', createdProduct);

      return NextResponse.json({
        success: true,
        data: createdProduct,
        message: 'Product created successfully in Printify'
      });

    } catch (printifyError) {
      console.error('Error creating product in Printify:', printifyError);
      throw new Error(`Failed to create product in Printify: ${printifyError instanceof Error ? printifyError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error creating Printify product:', error);

    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes('PRINTIFY_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API key not configured',
            details: 'Please set PRINTIFY_API_KEY in your environment variables'
          },
          { status: 500 }
        );
      }

      if (error.message.includes('Printify API error')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API error',
            details: error.message
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: 'Failed to create Printify product'
      },
      { status: 500 }
    );
  }
}


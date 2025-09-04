import { NextRequest, NextResponse } from 'next/server';
import { createPrintifyClient } from '@/lib/printify';
import { PrintifyPlaceholder, PrintifyProduct } from '@/lib/types';

// Minimal types for product creation payload to satisfy ESLint/TS
type NewVariant = { id: number; price: number; is_enabled?: boolean };
type NewImage = { id: string; x: number; y: number; scale: number; angle: number };
type NewPlaceholder = { position?: string; images: unknown[] };
type NewPrintArea = { variant_ids: number[]; placeholders: NewPlaceholder[]; background?: string };
type NewProductPayload = {
  title: string;
  blueprint_id: number;
  print_provider_id?: number;
  visible?: boolean;
  description?: string;
  tags?: string[];
  variants?: NewVariant[];
  print_areas?: NewPrintArea[];
};

interface DuplicateProductRequest {
  storeId: string;
  productId: string;
  overrides?: {
    title?: string;
    description?: string;
    tags?: string[];
    visible?: boolean;
    images?: Array<{ src: string; position?: string }>;
    variants?: Array<{ id: string | number; price: number; is_enabled?: boolean }>;
    blueprint_id?: string | number;
    print_provider_id?: string | number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: DuplicateProductRequest = await request.json();

    if (!body.storeId || !body.productId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: 'storeId and productId are required',
        },
        { status: 400 }
      );
    }

    const client = createPrintifyClient();

    // Fetch the template product
    const templateProduct: PrintifyProduct = await client.getProduct(body.storeId, body.productId);

    // Resolve core fields
    const blueprintId = body.overrides?.blueprint_id
      ? parseInt(String(body.overrides.blueprint_id))
      : parseInt(String(templateProduct.blueprint_id));

    if (!blueprintId || Number.isNaN(blueprintId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid blueprint_id',
          details: 'Could not resolve a valid blueprint_id from overrides or template product',
        },
        { status: 400 }
      );
    }

    const printProviderId = body.overrides?.print_provider_id
      ?? (templateProduct as unknown as { print_provider_id?: string | number }).print_provider_id
      ?? (templateProduct as unknown as { print_provider?: { id?: string | number } }).print_provider?.id;

    // Title transform: remove the word "Design" and append "T-Shirt"
    const transformTitle = (raw: string): string => {
      let t = (raw || '').toString();
      // Remove 'Design'/'Designs' tokens (case-insensitive) and adjacent separators/punctuation
      t = t.replace(/\bdesigns?\b/gi, '');
      // Collapse extra whitespace
      t = t.replace(/\s{2,}/g, ' ').trim();
      // Trim trailing separators after removal
      t = t.replace(/[-–—|:;,\.\s]+$/g, '').trim();
      // Append 'T-Shirt' if not already ending with it
      if (!/t-?shirt\s*$/i.test(t)) {
        t = `${t} T-Shirt`;
      }
      return t.trim();
    };

    // Build product payload for Printify
    const rawTitle = (body.overrides?.title ?? `${templateProduct.title} (Copy)`).trim();
    const title = transformTitle(rawTitle).slice(0, 255);

    const printifyProductData: NewProductPayload = {
      title,
      blueprint_id: blueprintId,
      // Preserve visibility by default, allow override
      visible: body.overrides?.visible ?? templateProduct.visible,
    };

    // Preserve description by default; allow override when provided
    if (typeof body.overrides?.description === 'string') {
      const desc = body.overrides.description.trim();
      if (desc) printifyProductData.description = desc;
    } else if (templateProduct.description) {
      printifyProductData.description = templateProduct.description;
    }

    // Preserve tags by default; allow override
    if (Array.isArray(body.overrides?.tags)) {
      printifyProductData.tags = body.overrides!.tags;
    } else if (Array.isArray(templateProduct.tags)) {
      printifyProductData.tags = templateProduct.tags;
    }

    // visible is already set above to override or template default

    if (printProviderId) {
      const parsedProvider = parseInt(String(printProviderId));
      if (!Number.isNaN(parsedProvider) && parsedProvider > 0) {
        printifyProductData.print_provider_id = parsedProvider;
      }
    }

    // Ensure print_provider_id is present for creation
    if (!printifyProductData.print_provider_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid print_provider_id',
          details: 'Could not resolve a valid print_provider_id from overrides or template product',
        },
        { status: 400 }
      );
    }

    // Variants: prefer overrides, else derive from template
    if (Array.isArray(body.overrides?.variants) && body.overrides!.variants.length > 0) {
      printifyProductData.variants = body.overrides!.variants.map(v => ({
        id: parseInt(String(v.id)),
        price: parseInt(String(v.price)),
        is_enabled: v.is_enabled ?? true,
      }));
    } else if (Array.isArray(templateProduct.variants) && templateProduct.variants.length > 0) {
      printifyProductData.variants = templateProduct.variants.map(v => ({
        id: parseInt(String(v.id)),
        price: parseInt(String(v.price ?? v.cost ?? 0)),
        is_enabled: Boolean(v.is_enabled ?? true),
      }));
    }

    // Helper to fetch remote image and upload to Printify to get an image ID
    const uploadImageAndGetId = async (src: string, defaultName: string): Promise<string> => {
      // If the src looks like a 24-char hex (existing Printify image id), use it directly
      if (/^[a-f0-9]{24}$/i.test(src)) {
        return src;
      }

      let base64Data: string | null = null;
      let fileName = defaultName;

      // Data URL case
      if (src.startsWith('data:')) {
        const commaIdx = src.indexOf(',');
        base64Data = commaIdx !== -1 ? src.slice(commaIdx + 1) : '';
        const match = /^data:([^;]+);/.exec(src);
        const ext = match?.[1]?.split('/')[1] || 'png';
        fileName = `${defaultName}.${ext}`;
      } else {
        // Remote URL: fetch and convert to base64
        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
        }
        const arrayBuf = await res.arrayBuffer();
        const buff = Buffer.from(arrayBuf);
        base64Data = buff.toString('base64');
        const urlExt = src.split('?')[0].split('#')[0].split('.').pop() || 'png';
        fileName = `${defaultName}.${urlExt}`;
      }

      const uploadRes = await fetch('https://api.printify.com/v1/uploads/images.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Merchalyzer/1.0',
        },
        body: JSON.stringify({
          file_name: fileName,
          contents: base64Data,
        }),
      });

      const text = await uploadRes.text();
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${text}`);
      }
      let data: unknown;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
      const id = typeof data === 'object' && data !== null
        ? ((data as { id?: unknown; data?: { id?: unknown } }).id
          ?? (data as { data?: { id?: unknown } }).data?.id)
        : undefined;
      if (!id) throw new Error('Upload succeeded but no id returned');
      return String(id);
    };

    // Print areas: start from template structure and KEEP existing images by default,
    // but ensure each image has a valid 'id' by uploading when missing.
    if (Array.isArray(templateProduct.print_areas) && templateProduct.print_areas.length > 0) {
      const newAreas: NewPrintArea[] = [];
      for (const area of templateProduct.print_areas) {
        const variantIds = (area.variant_ids || []).map(id => parseInt(String(id)));
        const newPlaceholders: NewPlaceholder[] = [];
        for (const ph of area.placeholders || []) {
          const pos = ph.position;
          const newImages: NewImage[] = [];
          for (let i = 0; i < (ph.images || []).length; i++) {
            const img = ph.images[i] as unknown as {
              id?: unknown;
              src?: unknown;
              name?: unknown;
              type?: unknown;
              x?: unknown; y?: unknown; scale?: unknown; angle?: unknown;
            };
            let imgId: string | undefined = undefined;
            // Always upload from src to obtain a fresh upload id; do not reuse product image ids
            if (typeof img.src === 'string' && img.src) {
              imgId = await uploadImageAndGetId(img.src, `template-${pos || 'design'}-${i + 1}`);
            }
            if (!imgId) continue; // skip invalid
            newImages.push({
              id: imgId,
              x: typeof img.x === 'number' ? img.x : 0.5,
              // Default to center if missing when copying template assets
              y: typeof img.y === 'number' ? img.y : 0.5,
              scale: typeof img.scale === 'number' ? img.scale : 1,
              angle: typeof img.angle === 'number' ? img.angle : 0,
            });
          }
          if (newImages.length > 0) {
            newPlaceholders.push({ position: pos, images: newImages });
          }
        }
        newAreas.push({ variant_ids: variantIds, placeholders: newPlaceholders, background: area.background });
      }
      printifyProductData.print_areas = newAreas;
    } else if (Array.isArray(templateProduct.variants)) {
      printifyProductData.print_areas = [
        {
          variant_ids: templateProduct.variants.map(v => parseInt(String(v.id))),
          placeholders: [],
        },
      ];
    }

    // If override images provided, place them in placeholders by position (replace matching positions)
    const images = body.overrides?.images?.filter(img => img.src && img.src.trim()) || [];
    if (images.length > 0) {
      // Ensure structure exists
      if (!printifyProductData.print_areas || printifyProductData.print_areas.length === 0) {
        printifyProductData.print_areas = [
          { variant_ids: (templateProduct.variants || []).map(v => parseInt(String(v.id))), placeholders: [] },
        ];
      }

      const positionSet = new Set(images.map(i => i.position).filter(Boolean) as string[]);

      // For each print area, replace only matching placeholder images; keep others
      const updatedAreas: NewPrintArea[] = [];
      for (const area of printifyProductData.print_areas as NewPrintArea[]) {
        let placeholders: NewPlaceholder[] = Array.isArray(area.placeholders) ? [...area.placeholders] : [];

        // Index placeholders by position for quick access
        const byPos = new Map<string | undefined, NewPlaceholder>();
        for (const ph of placeholders) {
          byPos.set(ph.position as string | undefined, ph);
        }

        // Ensure placeholders exist for provided positions
        for (const pos of positionSet) {
          if (!byPos.has(pos)) {
            const ph: NewPlaceholder = { position: pos, images: [] };
            placeholders.push(ph);
            byPos.set(pos, ph);
          }
        }

        // Build replacements using uploaded image IDs
        for (const pos of positionSet) {
          const matching = images.filter(img => !img.position || img.position === pos);
          if (matching.length === 0) continue;

          // Find an existing placeholder to copy transforms from (x,y,scale,angle)
          const templatePh: PrintifyPlaceholder | undefined = (templateProduct.print_areas || [])
            .flatMap(a => a.placeholders || [])
            .find(p => p.position === pos);

          const defaultTransform = {
            x: templatePh?.images?.[0]?.x ?? 0.5,
            // Keep template y if present; we will override per-position below for overrides
            y: templatePh?.images?.[0]?.y ?? 0.5,
            scale: templatePh?.images?.[0]?.scale ?? 1,
            angle: templatePh?.images?.[0]?.angle ?? 0,
          };

          const uploadedIds: string[] = [];
          for (let i = 0; i < matching.length; i++) {
            const m = matching[i]!;
            const id = await uploadImageAndGetId(m.src, `design-${pos}-${i + 1}`);
            uploadedIds.push(id);
          }

          // Replace images for this placeholder
          const ph = byPos.get(pos)!;
          const adjustedY = (pos === 'front')
            ? Math.min(1, Math.max(0, (defaultTransform.y ?? 0.5) + 0.025))
            : defaultTransform.y;
          ph.images = uploadedIds.map((id) => ({
            id,
            x: defaultTransform.x,
            y: adjustedY,
            scale: defaultTransform.scale,
            angle: defaultTransform.angle,
          } as NewImage));
        }

        // Filter out any placeholders that ended up without images to satisfy API validation
        placeholders = placeholders.filter(ph => Array.isArray(ph.images) && ph.images.length > 0);
        updatedAreas.push({ ...area, placeholders });
      }

      printifyProductData.print_areas = updatedAreas;
    }

    // Create the duplicate on Printify
    const createResponse = await fetch(`https://api.printify.com/v1/shops/${body.storeId}/products.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Merchalyzer/1.0',
      },
      body: JSON.stringify(printifyProductData),
    });

    const rawText: string = await createResponse.text().catch(() => '');
    if (!createResponse.ok) {
      let errorData: unknown = undefined;
      try {
        errorData = rawText ? JSON.parse(rawText) : undefined;
      } catch {
        errorData = { message: rawText } as unknown;
      }

      let specificError = 'Validation failed';
      if (typeof errorData === 'object' && errorData !== null && 'errors' in errorData) {
        try { specificError = JSON.stringify((errorData as Record<string, unknown>).errors); } catch {}
      } else if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
        const msg = (errorData as Record<string, unknown>).message;
        if (typeof msg === 'string') specificError = msg;
      } else if (rawText) {
        specificError = rawText;
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Printify API error',
          details: `${createResponse.status} ${createResponse.statusText} - ${specificError}`,
          sent: printifyProductData,
        },
        { status: 400 }
      );
    }

    let created: unknown = undefined;
    try { created = rawText ? JSON.parse(rawText) : undefined; } catch {}

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Product duplicated successfully in Printify',
    });
  } catch (error) {
    console.error('Error duplicating Printify product:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import mime from 'mime-types';
import { createPrintifyClient } from '@/lib/printify';

interface BulkRow {
  title: string;
  imageName: string;
}

interface BulkDuplicateRequest {
  storeId: string;
  template?: { id?: string; title?: string };
  rows: BulkRow[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkDuplicateRequest;

    if (!body.storeId || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: 'storeId and non-empty rows are required' },
        { status: 400 }
      );
    }

    const client = createPrintifyClient();

    // Resolve template product id
    let templateProductId: string | undefined = body.template?.id;
    if (!templateProductId && body.template?.title) {
      const all = await client.getStoreProducts(body.storeId);
      const match = all.find(p => p.title.toLowerCase() === body.template!.title!.toLowerCase());
      if (!match) {
        return NextResponse.json(
          { success: false, error: 'Template not found', details: `No product titled "${body.template.title}"` },
          { status: 404 }
        );
      }
      templateProductId = match.id;
    }
    if (!templateProductId) {
      return NextResponse.json(
        { success: false, error: 'Missing template', details: 'Provide template.id or template.title' },
        { status: 400 }
      );
    }

    // Build origin to call internal duplicate route
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    const results: Array<{ title: string; imageName: string; success: boolean; data?: unknown; error?: string }> = [];

    for (const row of body.rows) {
      try {
        const imagePath = path.join(process.cwd(), 'Images', row.imageName);
        const file = await fs.readFile(imagePath);
        const type = mime.lookup(imagePath) || 'image/png';
        const dataUrl = `data:${type};base64,${file.toString('base64')}`;

        const payload = {
          storeId: body.storeId,
          productId: templateProductId,
          overrides: {
            title: row.title,
            images: [{ src: dataUrl, position: 'front' }],
          },
        };

        const dupRes = await fetch(`${origin}/api/printify/products/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const dupJson = await dupRes.json().catch(() => ({}));
        if (!dupRes.ok || !dupJson?.success) {
          results.push({ title: row.title, imageName: row.imageName, success: false, error: dupJson?.details || dupJson?.error || `${dupRes.status} ${dupRes.statusText}` });
          continue;
        }
        results.push({ title: row.title, imageName: row.imageName, success: true, data: dupJson.data });
      } catch (e) {
        results.push({ title: row.title, imageName: row.imageName, success: false, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    const created = results.filter(r => r.success).length;
    const failed = results.length - created;

    return NextResponse.json({ success: true, created, failed, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


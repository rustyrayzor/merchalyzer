import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const productId = params.id;

    if (!storeId || !productId) {
      return NextResponse.json(
        { success: false, error: 'Missing storeId or product id' },
        { status: 400 }
      );
    }

    const resp = await fetch(`https://api.printify.com/v1/shops/${storeId}/products/${productId}.json`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Merchalyzer/1.0',
      },
    });

    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      let details = text;
      try { details = JSON.parse(text); } catch {}
      return NextResponse.json(
        { success: false, error: 'Printify API error', details },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const productId = params.id;

    if (!storeId || !productId) {
      return NextResponse.json(
        { success: false, error: 'Missing storeId or product id' },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { title?: unknown; tags?: unknown };

    // Build update payload, allowing title and/or tags
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Title cannot be empty' },
          { status: 400 }
        );
      }
      updatePayload.title = title.slice(0, 255);
    }

    if (Array.isArray(body.tags)) {
      // Normalize tags: trim, drop empties, de-dup case-insensitively
      const seen = new Set<string>();
      const tags: string[] = [];
      for (const t of body.tags as unknown[]) {
        if (typeof t !== 'string') continue;
        const trimmed = t.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          tags.push(trimmed);
        }
      }
      updatePayload.tags = tags;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updatable fields provided (title or tags)' },
        { status: 400 }
      );
    }

    const resp = await fetch(`https://api.printify.com/v1/shops/${storeId}/products/${productId}.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Merchalyzer/1.0',
      },
      body: JSON.stringify(updatePayload),
    });

    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      let details: unknown = text;
      try { details = JSON.parse(text); } catch {}
      return NextResponse.json(
        { success: false, error: 'Printify API error', details },
        { status: 400 }
      );
    }

    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    return NextResponse.json({ success: true, data, updated: updatePayload });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

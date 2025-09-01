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

import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouterForImages, toHeaderSafe } from '@/lib/openrouter';

interface DesignMockupRequest {
  idea: string;
  model: string; // e.g., google/gemini-2.5-flash-image-preview
}

interface DesignMockupResponse {
  base64DataUrl: string;
}

function buildSystemPrompt(): string {
  return [
    'You are a T-shirt mockup and composition assistant.',
    'Generate a single image that visually represents the provided idea text as a centered T-shirt design mockup.',
    'Background must be a flat dark grey, composition centered, with clean presentation suitable as a thumbnail preview.',
    'Favor crisp vector-like shapes, sharp edges, and high-dpi detail. Avoid camera/photography jargon and avoid embedding UI elements.',
  ].join('\n');
}

function buildUserContent(idea: string) {
  return [
    { type: 'text' as const, text: `Create a centered apparel design mockup preview from this text idea: ${idea}` },
  ];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<DesignMockupRequest>;
    const idea = String(body?.idea || '').trim();
    const model = String(body?.model || '').trim();
    if (!idea || !model) {
      return NextResponse.json({ error: 'Missing required fields: idea, model' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt();
    const userContent = buildUserContent(idea);
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const urls = await callOpenRouterForImages(model, systemPrompt, userContent, referer);
    const img = urls[0] ?? '';
    if (!img) {
      return NextResponse.json({ error: 'Model did not return an image' }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(model) } });
    }
    const payload: DesignMockupResponse = { base64DataUrl: img };
    return NextResponse.json(payload, { headers: { 'X-Model-Used': toHeaderSafe(model) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/design-mockup error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


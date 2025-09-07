import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouterForImages, toHeaderSafe as toHeaderSafeOR } from '@/lib/openrouter';
import { callIdeogramGenerate, fetchImageAsDataUrl, toHeaderSafe as toHeaderSafeIdeo, type IdeogramAspectRatio, type IdeogramRenderingSpeed, type IdeogramMagicPrompt, type IdeogramStyleType, type IdeogramGenerateOptions } from '@/lib/ideogram';

interface DesignMockupRequest {
  idea: string;
  model?: string; // used when provider = openrouter
  provider?: 'ideogram' | 'openrouter';
  ideogram?: {
    aspect_ratio?: IdeogramAspectRatio;
    rendering_speed?: IdeogramRenderingSpeed;
    magic_prompt?: IdeogramMagicPrompt;
    style_type?: IdeogramStyleType;
    negative_prompt?: string;
    seed?: number | null;
  };
  count?: number; // number of images to generate (ideogram only, 1-8)
}

interface DesignMockupResponse {
  images: string[];
}

// Shared mockup intent translated to a single Ideogram prompt string
const NEGATIVE_DEFAULT = [
  'text', 'signage', 'speech bubbles', 'posters', 'banners', 'billboards',
  'characters holding signs', 'people holding objects with text', 'meme-style captions',
  'labels', 'icons with text', 'word balloons', 'graffiti', 'chalkboard', 'whiteboard',
  'logo mockups'
].join(', ');

function buildIdeogramPrompt(idea: string): string {
  const intent = [
    'Centered T-shirt design mockup preview, flat dark grey background, composition centered.',
    'Crisp vector-like shapes, sharp edges, high-dpi details. Clean presentation. No UI elements.',
    'Do not include any overlay text or signage elements of any kind (no text, signage, speech bubbles, posters, banners, billboards, characters holding signs, meme captions, labels, icons with text, word balloons, graffiti, chalkboard, whiteboard, or logo mockups).',
  ].join(' ');
  return `${intent} Idea — ${idea}`;
}

// OpenRouter helper to keep compatibility
function buildORSystemPrompt(): string {
  return [
    'You are a T-shirt mockup and composition assistant.',
    'Generate a single image that visually represents the provided idea text as a centered T-shirt design mockup.',
    'Background must be a flat dark grey, composition centered, with clean presentation suitable as a thumbnail preview.',
    'Favor crisp vector-like shapes, sharp edges, and high-dpi detail. Avoid camera/photography jargon and avoid embedding UI elements.',
  ].join('\n');
}

function buildORUserContent(idea: string) {
  return [
    { type: 'text' as const, text: `Create a centered apparel design mockup preview from this text idea — ${idea}` },
  ];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<DesignMockupRequest>;
    const provider: 'ideogram' | 'openrouter' = (body?.provider === 'openrouter' || body?.provider === 'ideogram')
      ? body.provider
      : 'ideogram';
    const idea = String(body?.idea || '').trim();
    if (!idea) {
      return NextResponse.json({ error: 'Missing required field: idea' }, { status: 400 });
    }

    if (provider === 'ideogram') {
      const prompt = buildIdeogramPrompt(idea);
      const reqCount = typeof body?.count === 'number' ? body!.count! : 1;
      const clamped = Math.max(1, Math.min(8, reqCount));
      const opts: IdeogramGenerateOptions = {
        // Force preview to a single image per requirement
        num_images: clamped,
        // Apply user defaults if provided
        aspect_ratio: body?.ideogram?.aspect_ratio,
        rendering_speed: body?.ideogram?.rendering_speed,
        magic_prompt: body?.ideogram?.magic_prompt,
        style_type: body?.ideogram?.style_type,
        negative_prompt: [NEGATIVE_DEFAULT, body?.ideogram?.negative_prompt || ''].filter(Boolean).join('. ').trim(),
        seed: typeof body?.ideogram?.seed === 'number' ? body?.ideogram?.seed : undefined,
      };

      const urls = await callIdeogramGenerate(prompt, opts);
      if (!urls || urls.length === 0) {
        return NextResponse.json({ error: 'Ideogram did not return an image' }, { status: 502, headers: { 'X-Provider-Used': 'ideogram', 'X-Prompt-Preview': toHeaderSafeIdeo(prompt) } });
      }
      const dataUrls: string[] = [];
      for (const u of urls) {
        try {
          dataUrls.push(await fetchImageAsDataUrl(u));
        } catch {
          // skip failed fetches
        }
      }
      if (dataUrls.length === 0) {
        return NextResponse.json({ error: 'Failed to fetch generated images' }, { status: 502, headers: { 'X-Provider-Used': 'ideogram', 'X-Prompt-Preview': toHeaderSafeIdeo(prompt) } });
      }
      const payload: DesignMockupResponse = { images: dataUrls };
      return NextResponse.json(payload, { headers: { 'X-Provider-Used': 'ideogram', 'X-Prompt-Preview': toHeaderSafeIdeo(prompt), 'X-Count': String(dataUrls.length) } });
    }

    // OpenRouter fallback
    const model = String(body?.model || '').trim();
    if (!model) {
      return NextResponse.json({ error: 'Missing required field: model (for OpenRouter provider)' }, { status: 400 });
    }
    const systemPrompt = buildORSystemPrompt();
    const userContent = buildORUserContent(idea);
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const urls = await callOpenRouterForImages(model, systemPrompt, userContent, referer);
    if (!urls || urls.length === 0) {
      return NextResponse.json({ error: 'Model did not return an image' }, { status: 502, headers: { 'X-Provider-Used': 'openrouter', 'X-Model-Used': toHeaderSafeOR(model) } });
    }
    const payload: DesignMockupResponse = { images: urls };
    return NextResponse.json(payload, { headers: { 'X-Provider-Used': 'openrouter', 'X-Model-Used': toHeaderSafeOR(model), 'X-Count': String(urls.length) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/design-mockup error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

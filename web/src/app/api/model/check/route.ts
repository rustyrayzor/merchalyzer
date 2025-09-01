import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// 1x1 transparent PNG (remote URL for providers that reject base64 data URLs)
const TINY_PNG_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Transparent_pixel.png';
const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5KYII=';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
    }
    const body = (await req.json()) as { model?: string } | null;
    const model = body?.model?.trim();
    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Title': 'Merchalyzer',
    };

    interface ChatMessageImageUrlPart { type: 'image_url'; image_url: { url: string }; }
    interface ChatMessageTextPart { type: 'text'; text: string; }
    type ChatMessageContent = Array<ChatMessageTextPart | ChatMessageImageUrlPart>;
    interface ChatCompletionsRequest { model: string; messages: Array<{ role: 'system' | 'user'; content: string | ChatMessageContent }>; temperature?: number; top_p?: number; }

    const buildPayload = (imageUrl: string): ChatCompletionsRequest => ({
      model,
      messages: [
        { role: 'system', content: 'Answer with a single word: yes or no.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Can you see the attached image? Answer yes or no.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0,
      top_p: 0,
    });

    // Try remote URL first (most providers accept), then fallback to data URL
    let res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildPayload(TINY_PNG_URL)),
    });

    if (!res.ok) {
      const text = await res.text();
      // Fallback attempt with data URL (some providers may accept base64)
      const fallback = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPayload(TINY_PNG_DATA_URL)),
      });
      if (!fallback.ok) {
        const ftext = await fallback.text();
        const lowered = (text + ' ' + ftext).toLowerCase();
        const likelyNotVision =
          (res.status === 400 || fallback.status === 400) &&
          (lowered.includes('image') || lowered.includes('image_url') || lowered.includes('vision'));
        if (likelyNotVision) {
          return NextResponse.json({ vision: false, reason: 'provider_rejected_image' }, { status: 200 });
        }
        return NextResponse.json({ error: `OpenRouter error ${fallback.status}: ${ftext}` }, { status: 502 });
      }
      res = fallback;
    }

    // If the provider responds OK, assume vision is supported
    return NextResponse.json({ vision: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



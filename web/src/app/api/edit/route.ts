import { NextRequest, NextResponse } from 'next/server';
import { EditImageRequest, EditImageResponse } from '@/lib/types';
import { callOpenRouterForImages, toHeaderSafe } from '@/lib/openrouter';

// For image editing, we ask the model to output a JSON object with a single key
// { "image": "data:image/png;base64,..." }
// This keeps transport simple. Some models may only describe edits; we target
// Gemini 2.5 Flash Image Preview which supports image outputs when routed via providers.

function buildSystemPrompt(): string {
  return 'You are an image editing assistant. Perform the requested edit on the provided image. Reply with an assistant message that includes images containing the edited image as a base64 data URL. Do not include unrelated content.';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as EditImageRequest;
    if (!body || !body.model || !body.imageName || !body.originalBase64 || !body.instruction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = `Edit the attached image. Image Name: ${body.imageName}. Edit Instruction: ${body.instruction}`;
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const urls = await callOpenRouterForImages(
      body.model,
      systemPrompt,
      [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: body.originalBase64 } },
      ],
      referer,
    );
    const editedDataUrl = urls[0] ?? '';

    if (!editedDataUrl) {
      return NextResponse.json({ error: 'Model did not return an edited image' }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(body.model) } });
    }

    const payload: EditImageResponse = { base64DataUrl: editedDataUrl };
    return NextResponse.json(payload, { headers: { 'X-Model-Used': toHeaderSafe(body.model), 'X-User-Prompt-Preview': toHeaderSafe(userPrompt) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/edit error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}



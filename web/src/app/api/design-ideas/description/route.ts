import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, safeParseJson, toHeaderSafe } from '@/lib/openrouter';

interface RegenDescriptionRequest {
  quote: string;
  model: string;
  contextPrompt?: string; // full prompt text including Tone/Style info
  tone?: string; // optional override
  tshirtStyle?: string; // optional override
  primaryNiche?: string;
  secondaryNiche?: string;
}

interface RegenDescriptionResponse {
  description: string;
}

function buildSystemPrompt(): string {
  return [
    'You are a design ideation assistant for print-on-demand apparel.',
    'Given a QUOTE and context, generate ONLY the second sentence of a three-sentence design spec.',
    '',
    'Rules for the single sentence to return:',
    '- Length: 18-36 words.',
    '- Provide a detailed visual description that explicitly mentions the selected tone and the selected T-shirt art style.',
    '- Include concrete style cues: color palette, typography style/weight/case (e.g., bold sans all-caps with drop shadow), effects (outline, distress, glow).',
    '- Explicitly state quote TEXT POSITION (e.g., center chest, arched, stacked).',
    '- If niches are provided, include iconography/motifs strongly associated with BOTH niches.',
    '- Do NOT repeat the quote text; refer to it implicitly as "the quote".',
    '- Avoid camera/photography terms. Do NOT include any colon character (:).',
    '',
    'Output ONLY strict JSON as: { "description": "..." }',
  ].join('\n');
}

function buildUserPrompt(body: RegenDescriptionRequest): string {
  const parts: string[] = [];
  parts.push(`Quote - ${body.quote}`);
  const tone = (body.tone || '').trim();
  const tshirtStyle = (body.tshirtStyle || '').trim();
  if (tone) parts.push(`Selected tone: ${tone}`); else parts.push('Selected tone: Auto');
  if (tshirtStyle) parts.push(`Selected T-shirt art style: ${tshirtStyle}`); else parts.push('Selected T-shirt art style: Auto');
  if (body.primaryNiche) parts.push(`Primary niche: ${body.primaryNiche}`);
  if (body.secondaryNiche) parts.push(`Secondary niche: ${body.secondaryNiche}`);
  if (body.contextPrompt) parts.push(`Additional context: ${body.contextPrompt}`);
  parts.push('Return ONLY JSON.');
  return parts.join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<RegenDescriptionRequest>;
    const quote = String(body?.quote || '').trim();
    const model = String(body?.model || '').trim();
    if (!quote || !model) {
      return NextResponse.json({ error: 'Missing required fields: quote, model' }, { status: 400 });
    }
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body as RegenDescriptionRequest);
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const raw = await callOpenRouter(model, systemPrompt, userPrompt, referer);
    const parsed = safeParseJson<RegenDescriptionResponse>(raw);
    const desc = String(parsed?.description || '').trim();
    if (!desc) {
      return NextResponse.json({ error: 'Model returned empty description' }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(model) } });
    }
    return NextResponse.json({ description: desc }, { headers: { 'X-Model-Used': toHeaderSafe(model), 'X-User-Prompt-Preview': toHeaderSafe(userPrompt) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/design-ideas/description error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') || lowered.includes('not valid json') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


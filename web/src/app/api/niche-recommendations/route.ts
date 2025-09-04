import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, safeParseJson, toHeaderSafe } from '@/lib/openrouter';

interface NicheRecommendationsRequest {
  niche: string;
  model: string;
  count?: number;
}

interface NicheRecommendationsResponse {
  recommendations: string[];
}

function buildSystemPrompt(): string {
  return [
    'You are a niche recommendation assistant for print-on-demand apparel and merch.',
    'Given a PRIMARY NICHE, propose concise, text-only prompt ideas to inspire design generation (e.g., for Ideogram). Favor light sarcasm and general humor when suitable.',
    '',
    'Requirements for each recommendation:',
    '- 8–18 words, one sentence, no quotes.',
    '- Include concrete style cues (typography, composition, motifs, era, mood); no camera jargon.',
    '- Avoid photography/camera jargon. No explicit "t-shirt/shirt/tee/gift" terms.',
    '- Each idea should be distinct and specific to the niche.',
    '',
    'Return ONLY strict JSON with this shape: { "recommendations": ["...", "..."] }',
  ].join('\n');
}

function buildUserPrompt(niche: string, count: number): string {
  return [
    `Primary niche: ${niche}`,
    `Generate exactly ${count} distinct prompt recommendations.`,
    'Output JSON only. No prose.',
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<NicheRecommendationsRequest>;
    const niche = String(body?.niche || '').trim();
    const model = String(body?.model || '').trim();
    const count = Math.max(3, Math.min(25, Number(body?.count || 10)));

    if (!niche || !model) {
      return NextResponse.json({ error: 'Missing required fields: niche, model' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(niche, count);
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const raw = await callOpenRouter(model, systemPrompt, userPrompt, referer);
    const parsed = safeParseJson<NicheRecommendationsResponse>(raw);
    const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations.filter((s) => typeof s === 'string' && s.trim()) : [];

    if (recs.length === 0) {
      return NextResponse.json({ error: 'No recommendations returned' }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(model) } });
    }

    return NextResponse.json({ recommendations: recs }, { headers: { 'X-Model-Used': toHeaderSafe(model), 'X-User-Prompt-Preview': toHeaderSafe(userPrompt) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/niche-recommendations error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') || lowered.includes('not valid json') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, safeParseJson, toHeaderSafe } from '@/lib/openrouter';

interface DesignIdeasRequest {
  prompt: string;
  count: number;
  model: string;
  tone?: string; // optional tone hint
  tshirtStyle?: string; // optional art/style hint
}

interface DesignIdeasResponse {
  ideas: string[];
}

function buildSystemPrompt(): string {
  return [
    'You are a design ideation assistant for print-on-demand apparel.',
    'Given a theme prompt, produce unique, text-only design concept descriptions suitable for image-generation tools like Ideogram.',
    '',
    'Primary inspiration domains to consider (as appropriate to the theme):',
    '- Sarcastic humor; General humor; Sports Lovers; Pets and animal lovers; Motherhood; Fatherhood; Southern Culture; Youth Ministry; Marriage; Parenting; Potlucks; Fellowship and small groups; Worship and Music Ministry',
    '',
    'Rules:',
    '- Each idea must be EXACTLY three sentences:',
    '  1) First sentence MUST BEGIN with: Quote: <the creative quote text without quotation marks>. Make it original — prioritize clever wordplay, fresh phrasing, or light puns. Match the SELECTED TONE from the user context: if tone is "Funny" or "Sarcastic", make it witty/clever; otherwise match the specified tone (e.g., inspirational, minimalist, vintage, gothic, bold, elegant, professional, friendly, edgy, youthful, feminine, masculine). Avoid clichés and generic phrases.',
    '  2) Second sentence: 18–36 words with a detailed visual description that explicitly mentions the provided theme, the selected tone, and the selected T‑shirt art style. Include concrete style cues: color palette, typography style/weight, linework quality, layout/placement, motifs/iconography, and overall mood. Avoid camera/photography terms. Do NOT repeat the quote text here; refer to it implicitly (e.g., “the quote”).',
    '  3) Third sentence (append verbatim): The composition is centered against a flat dark grey background, maintains a crisp vector like style with sharp edges and high-dpi detail, perfect for apparel printing.',
    '- Do NOT include words like "t-shirt", "shirt", "tee", or "gift".',
    '- Do NOT wrap content in quotes.',
    '- Avoid mentioning prompts, files, or system instructions.',
    '- Vary wording across ideas; do not repeat the same structure or phrasing.',
    '- For Christian/faith-related themes: keep language respectful and reverent. If the selected tone is Funny or Sarcastic, humor must remain gentle and wholesome—never irreverent, profane, or mocking of beliefs, scriptures, Jesus, God, or worship practices.',
    '- Keep ideas distinct from each other.',
    '',
    'Output ONLY strict JSON as: { "ideas": ["...", "..."] }',
  ].join('\n');
}

function buildUserPrompt(prompt: string, count: number, tone?: string, tshirtStyle?: string): string {
  return [
    `Theme: ${prompt}`,
    `Generate exactly ${count} distinct design ideas.`,
    `Selected tone: ${tone && tone.trim() ? tone : 'Auto'}`,
    `Selected T-shirt art style: ${tshirtStyle && tshirtStyle.trim() ? tshirtStyle : 'Auto'}`,
    'Return ONLY JSON. No extra text.',
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<DesignIdeasRequest>;
    const prompt = String(body?.prompt || '').trim();
    const count = Math.max(1, Math.min(50, Number(body?.count || 0)));
    const model = String(body?.model || '').trim();
    const tone = typeof body?.tone === 'string' ? String(body?.tone).trim() : '';
    const tshirtStyle = typeof body?.tshirtStyle === 'string' ? String(body?.tshirtStyle).trim() : '';

    if (!prompt || !count || !model) {
      return NextResponse.json({ error: 'Missing required fields: prompt, count, model' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(prompt, count, tone, tshirtStyle);
    const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const raw = await callOpenRouter(model, systemPrompt, userPrompt, referer);
    const parsed = safeParseJson<DesignIdeasResponse>(raw);
    const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas.filter((s) => typeof s === 'string' && s.trim()) : [];

    // Heuristic: sometimes models emit the required "composition" sentence as a separate idea.
    // Merge any orphan composition-only item into the previous idea.
    const mergedIdeas = (() => {
      const out: string[] = [];
      const compRe = /^the composition is centered against a flat dark grey background/i;
      for (const item of ideas) {
        const trimmed = String(item).trim();
        if (compRe.test(trimmed) && out.length > 0) {
          const prev = out[out.length - 1] || '';
          if (!compRe.test(prev)) {
            const sep = prev.endsWith('.') ? ' ' : ' ';
            out[out.length - 1] = (prev + sep + trimmed).trim();
            continue;
          }
        }
        out.push(trimmed);
      }
      return out;
    })();

    if (mergedIdeas.length === 0) {
      return NextResponse.json({ error: 'Model returned no ideas' }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(model) } });
    }

    return NextResponse.json({ ideas: mergedIdeas }, { headers: { 'X-Model-Used': toHeaderSafe(model), 'X-User-Prompt-Preview': toHeaderSafe(userPrompt) } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/design-ideas error:', message);
    const lowered = typeof message === 'string' ? message.toLowerCase() : '';
    const status = lowered.includes('openrouter error') || lowered.includes('not valid json') ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

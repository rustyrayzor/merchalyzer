import { NextRequest, NextResponse } from 'next/server';
import { GLOBAL_SYSTEM_PROMPT } from '@/lib/prompts';
import { GenerateFieldResponse, GenerateRowResponse, FieldName, GeneratedFields } from '@/lib/types';
import { callOpenRouter, safeParseJson, toHeaderSafe } from '@/lib/openrouter';

interface IncomingBodyBase {
	imageName: string;
	instructions: string;
	brand?: string;
	keywords?: string;
	model: string;
	imageBase64?: string;
	title?: string; // Optional user-provided title
}

type IncomingBody = (IncomingBodyBase & { mode: 'row' }) | (IncomingBodyBase & { mode: 'field'; field: FieldName });

// Using shared OpenRouter helpers; keep URL here if needed elsewhere

function buildSystemPrompt(): string {
	return GLOBAL_SYSTEM_PROMPT;
}

function buildUserPrompt(body: IncomingBodyBase, mode: 'row' | 'field', field?: FieldName): string {
	const parts: string[] = [];
	parts.push(`Image Name: ${body.imageName}`);
	if (body.brand) parts.push(`Brand (optional): ${body.brand}`);
	if (body.keywords) parts.push(`Keywords (optional): ${body.keywords}`);
	if (body.title) parts.push(`User-Provided Title: ${body.title}`);
	parts.push(`Global Instructions: ${body.instructions}`);
	if (mode === 'field' && field) {
		parts.push(`Generate ONLY the field: ${field}. Return JSON with a single key '${field}'. No other keys.`);
	} else {
		parts.push('Generate ALL fields. Return JSON with keys brand, title, bullet1, bullet2, description. No other keys.');
	}
	parts.push('Language: English only.');
	parts.push('Return ONLY JSON. No code fences or surrounding text.');
	return parts.join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
	try {
		const body = (await req.json()) as IncomingBody;
		if (!body || !body.imageName || !body.instructions || !body.model) {
			const modelHeader = typeof (body as Partial<IncomingBody>)?.model === 'string' ? (body as Partial<IncomingBody>).model as string : '';
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: { 'X-Model-Used': modelHeader } });
		}
		const systemPrompt = buildSystemPrompt();
		const mode = 'mode' in body ? body.mode : 'row';
		const referer = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
		console.log('POST /api/generate', { mode, model: body.model, imageName: body.imageName });
		if (mode === 'field') {
			const field = (body as IncomingBody & { mode: 'field' }).field as FieldName | undefined;
			if (!field) {
				return NextResponse.json({ error: 'Field is required for field mode' }, { status: 400, headers: { 'X-Model-Used': body.model } });
			}
			const userPrompt = buildUserPrompt(body, 'field', field);
			const promptPreview = toHeaderSafe(userPrompt);
			const systemPreview = toHeaderSafe(systemPrompt);
			const raw = await callOpenRouter(body.model, systemPrompt, userPrompt, referer, body.imageBase64);
			const parsed = safeParseJson<Record<FieldName, string>>(raw);
			if (!(field in parsed)) {
				return NextResponse.json({ error: `Response missing field ${field}` }, { status: 502, headers: { 'X-Model-Used': toHeaderSafe(body.model), 'X-User-Prompt-Preview': promptPreview, 'X-System-Prompt-Preview': systemPreview } });
			}

			// If user provided title and we're generating the title field, use the provided title
			let fieldValue = parsed[field];
			if (field === 'title' && body.title) {
				fieldValue = body.title;
			}

			const payload: GenerateFieldResponse = { field, value: fieldValue };
			console.log('System prompt:', systemPrompt);
			console.log('User prompt:', userPrompt);
			return NextResponse.json(payload, { headers: { 'X-Model-Used': toHeaderSafe(body.model), 'X-User-Prompt-Preview': promptPreview, 'X-System-Prompt-Preview': systemPreview } });
		}
		const userPrompt = buildUserPrompt(body, 'row');
		const promptPreview = toHeaderSafe(userPrompt);
		const systemPreview = toHeaderSafe(systemPrompt);
		const raw = await callOpenRouter(body.model, systemPrompt, userPrompt, referer, body.imageBase64);
		const parsed = safeParseJson<GeneratedFields>(raw);

		// If user provided a title, use it instead of the AI-generated one
		const finalFields: GeneratedFields = {
			...parsed,
			...(body.title ? { title: body.title } : {})
		};

		const payload: GenerateRowResponse = { fields: finalFields };
		console.log('System prompt:', systemPrompt);
		console.log('User prompt:', userPrompt);
		return NextResponse.json(payload, { headers: { 'X-Model-Used': toHeaderSafe(body.model), 'X-User-Prompt-Preview': promptPreview, 'X-System-Prompt-Preview': systemPreview } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('POST /api/generate error:', message);
		const lowered = typeof message === 'string' ? message.toLowerCase() : '';
		const status = lowered.includes('openrouter error') || lowered.includes('not valid json') ? 502 : 500;
		return NextResponse.json({ error: message }, { status });
	}
}



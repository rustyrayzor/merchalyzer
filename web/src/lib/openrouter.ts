const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessageTextPart { type: 'text'; text: string; }
export interface ChatMessageImageUrlPart { type: 'image_url'; image_url: { url: string }; }
export type ChatMessageContent = string | Array<ChatMessageTextPart | ChatMessageImageUrlPart>;
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: ChatMessageContent; }
export interface ChatCompletionsRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	top_p?: number;
	modalities?: Array<'image' | 'text'>;
	response_format?: { type: 'json_object' };
}
export interface ChatImage { type: 'image_url'; image_url: { url: string } }
export interface ChatMessageResponse { role: string; content: string; images?: ChatImage[] }
export interface ChatCompletionsResponse { choices: Array<{ message: ChatMessageResponse }> }

export function toHeaderSafe(value: string): string {
	const noNewlines = value.replace(/[\r\n]+/g, ' | ');
	const asciiOnly = noNewlines.replace(/[^\x20-\x7E]/g, '');
	return asciiOnly.slice(0, 512);
}

export async function callOpenRouter(
	model: string,
	systemPrompt: string,
	userPrompt: string,
	referer?: string,
	imageBase64?: string,
): Promise<string> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY not configured');
	}
	const headers = {
		'Authorization': `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		...(referer ? { 'HTTP-Referer': referer } : {}),
		'X-Title': 'Merchalyzer',
	} as Record<string, string>;

	// Handle Gemini models specially - they don't support response_format when images are present
	const isGemini = model.includes('gemini') || model.includes('google');
	const basePayload: ChatCompletionsRequest = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{
				role: 'user',
				content: imageBase64
					? [
						{ type: 'text', text: userPrompt },
						{ type: 'image_url', image_url: { url: imageBase64 } },
					]
					: userPrompt,
			},
		],
		temperature: 0.2,
		top_p: 0,
	};

    // Only set response_format for non-Gemini models when images are NOT present
    // Some providers (incl. Anthropic via OpenRouter) reject/ignore response_format with images
    const useResponseFormat = !isGemini && !imageBase64;
    const payload: ChatCompletionsRequest = useResponseFormat
        ? { ...basePayload, response_format: { type: 'json_object' } }
        : basePayload;

	let res = await fetch(OPENROUTER_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text();
		const lowered = text.toLowerCase();
		if (
			res.status === 400 && (
				lowered.includes('json mode is not enabled') ||
				lowered.includes('json mode') ||
				lowered.includes('json schema validation error') ||
				lowered.includes('response_format') ||
				lowered.includes('response_mime_type') ||
				lowered.includes('oneof')
			)
		) {
			console.warn('Provider rejected response_format; retrying without response_format');
			res = await fetch(OPENROUTER_URL, {
				method: 'POST',
				headers,
				body: JSON.stringify(basePayload),
			});
		}
		if (!res.ok) {
			if (res.status === 404 && text.includes('No endpoints found matching your data policy')) {
				throw new Error('OpenRouter error 404: Missing eligible endpoints for your data policy. Visit https://openrouter.ai/settings/privacy and enable a policy compatible with the selected model.');
			}
			throw new Error(`OpenRouter error ${res.status}: ${text}`);
		}
	}
    let data = await res.json() as ChatCompletionsResponse;
    let content: string = data?.choices?.[0]?.message?.content ?? '';

    // Fallback: if provider returned 200 but empty content (seen with some models when json mode conflicts),
    // retry once without response_format.
    if (!content && useResponseFormat) {
        console.warn('Empty content with response_format; retrying without response_format');
        const retryRes = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(basePayload),
        });
        if (!retryRes.ok) {
            const text = await retryRes.text();
            throw new Error(`OpenRouter error ${retryRes.status} (retry): ${text}`);
        }
        data = await retryRes.json() as ChatCompletionsResponse;
        content = data?.choices?.[0]?.message?.content ?? '';
    }

    if (!content) {
        throw new Error('Empty response from model');
    }
    return content;
}

export function safeParseJson<T>(raw: string): T {
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('Model response is not valid JSON');
	}
	const sliced = raw.slice(start, end + 1);
	return JSON.parse(sliced) as T;
}

export async function callOpenRouterForImages(
	model: string,
	systemPrompt: string,
	userContent: ChatMessageContent,
	referer?: string,
): Promise<string[]> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY not configured');
	}
	const headers = {
		'Authorization': `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
		'Accept': 'application/json',
		...(referer ? { 'HTTP-Referer': referer } : {}),
		'X-Title': 'Merchalyzer',
	} as Record<string, string>;

	// Handle Gemini models differently - they don't support modalities parameter for image generation
	const isGemini = model.includes('gemini') || model.includes('google');
	const payload: ChatCompletionsRequest = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userContent },
		],
		// Only set modalities for non-Gemini models
		...(isGemini ? {} : { modalities: ['image', 'text'] }),
		temperature: 0.2,
		top_p: 0,
	};

	const res = await fetch(OPENROUTER_URL, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`OpenRouter error ${res.status}: ${text}`);
	}
	const data = await res.json() as ChatCompletionsResponse;
	const images = data?.choices?.[0]?.message?.images ?? [];
	const urls = images.map((img) => img.image_url?.url).filter((u): u is string => typeof u === 'string' && !!u);
	return urls;
}



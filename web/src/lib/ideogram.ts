const IDEOGRAM_URL = 'https://api.ideogram.ai/v1/ideogram-v3/generate';

export type IdeogramAspectRatio =
  | '1x3' | '3x1' | '1x2' | '2x1' | '9x16' | '16x9' | '10x16' | '16x10'
  | '2x3' | '3x2' | '3x4' | '4x3' | '4x5' | '5x4' | '1x1';

export type IdeogramRenderingSpeed = 'TURBO' | 'DEFAULT' | 'QUALITY';
export type IdeogramMagicPrompt = 'AUTO' | 'ON' | 'OFF';
export type IdeogramStyleType = 'AUTO' | 'GENERAL' | 'REALISTIC' | 'DESIGN' | 'FICTION';

export interface IdeogramGenerateOptions {
  seed?: number;
  aspect_ratio?: IdeogramAspectRatio;
  rendering_speed?: IdeogramRenderingSpeed;
  magic_prompt?: IdeogramMagicPrompt;
  num_images?: number; // 1–8
  negative_prompt?: string;
  style_type?: IdeogramStyleType;
  // style_reference_images?: File[]; // Not used from server-side here
  // character_reference_images?: File[];
  // character_reference_images_mask?: File[];
}

interface IdeogramGenerateResponseItem {
  prompt: string;
  resolution: string;
  is_image_safe: boolean;
  seed: number;
  url: string;
  style_type?: string;
}

interface IdeogramGenerateResponse {
  created: string;
  data: IdeogramGenerateResponseItem[];
}

export function toHeaderSafe(value: string): string {
  const noNewlines = value.replace(/[\r\n]+/g, ' | ');
  const asciiOnly = noNewlines.replace(/[^\x20-\x7E]/g, '');
  return asciiOnly.slice(0, 512);
}

// Calls Ideogram generate and returns an array of image URLs
export async function callIdeogramGenerate(
  prompt: string,
  options: IdeogramGenerateOptions = {}
): Promise<string[]> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured');

  const form = new FormData();
  form.append('prompt', prompt);

  // Apply options if provided
  if (typeof options.seed === 'number') form.append('seed', String(options.seed));
  if (options.aspect_ratio) form.append('aspect_ratio', options.aspect_ratio);
  if (options.rendering_speed) form.append('rendering_speed', options.rendering_speed);
  if (options.magic_prompt) form.append('magic_prompt', options.magic_prompt);
  if (typeof options.num_images === 'number') form.append('num_images', String(options.num_images));
  if (options.negative_prompt) form.append('negative_prompt', options.negative_prompt);
  if (options.style_type) form.append('style_type', options.style_type);

  const res = await fetch(IDEOGRAM_URL, {
    method: 'POST',
    headers: { 'Api-Key': apiKey },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram error ${res.status}: ${text}`);
  }
  const data = await res.json() as IdeogramGenerateResponse;
  const urls = (data?.data || []).map((d) => d.url).filter((u): u is string => !!u && typeof u === 'string');
  return urls;
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  // Try to preserve content-type if present, else default to image/png
  const type = res.headers.get('content-type') || blob.type || 'image/png';
  return `data:${type};base64,${base64}`;
}

// Upscale via Ideogram API
export interface IdeogramUpscaleOptions {
  prompt?: string;
  resemblance?: number; // 1..100, default 50
  detail?: number; // 1..100, default 50
  magic_prompt_option?: 'AUTO' | 'ON' | 'OFF';
  num_images?: number; // default 1
  seed?: number;
}

export async function callIdeogramUpscale(
  image: Blob | File,
  opts: IdeogramUpscaleOptions = {}
): Promise<string[]> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured');

  const req: Record<string, unknown> = {};
  if (typeof opts.prompt === 'string' && opts.prompt.trim()) req.prompt = opts.prompt.trim();
  if (typeof opts.resemblance === 'number') req.resemblance = Math.max(1, Math.min(100, Math.floor(opts.resemblance)));
  if (typeof opts.detail === 'number') req.detail = Math.max(1, Math.min(100, Math.floor(opts.detail)));
  if (opts.magic_prompt_option) req.magic_prompt_option = opts.magic_prompt_option;
  if (typeof opts.num_images === 'number') req.num_images = Math.max(1, Math.min(8, Math.floor(opts.num_images)));
  if (typeof opts.seed === 'number') req.seed = opts.seed;

  const form = new FormData();
  form.append('image_request', JSON.stringify(req));
  form.append('image_file', image);

  const res = await fetch('https://api.ideogram.ai/upscale', {
    method: 'POST',
    headers: { 'Api-Key': apiKey },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram upscale error ${res.status}: ${text}`);
  }
  const data = await res.json() as { data?: Array<{ url?: string | null }> };
  const urls = (data?.data || []).map(d => (d?.url || '')).filter(Boolean) as string[];
  return urls;
}

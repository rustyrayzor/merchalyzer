import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { callIdeogramUpscale } from '@/lib/ideogram';

// Create processed/workflow/upscaled directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed', 'workflow', 'upscaled');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
};

const UPSCAYL_API_URL = process.env.UPSCAYL_API_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = (searchParams.get('provider') || 'upscayl').toLowerCase();
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    let processedImageBuffer: Buffer;

    if (provider === 'ideogram') {
      // Read optional Ideogram upscale params from form data
      const resemblance = Number(formData.get('ideo_resemblance') || '');
      const detail = Number(formData.get('ideo_detail') || '');
      const magic = String(formData.get('ideo_magic_prompt') || '').toUpperCase();
      const seed = Number(formData.get('ideo_seed') || '');

      const opts: import('@/lib/ideogram').IdeogramUpscaleOptions = {};
      if (!Number.isNaN(resemblance)) opts.resemblance = resemblance;
      if (!Number.isNaN(detail)) opts.detail = detail;
      if (magic === 'AUTO' || magic === 'ON' || magic === 'OFF') opts.magic_prompt_option = magic;
      if (!Number.isNaN(seed)) opts.seed = seed;

      const urls = await callIdeogramUpscale(file, opts);
      if (!urls || urls.length === 0) {
        return NextResponse.json({ error: 'Ideogram returned no image' }, { status: 502 });
      }
      const imgRes = await fetch(urls[0]!);
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch Ideogram image' }, { status: 502 });
      }
      const rawBuf = await imgRes.arrayBuffer();
      const pngBuf = await sharp(Buffer.from(rawBuf)).png().toBuffer();
      processedImageBuffer = pngBuf;
    } else {
      // Fallback to Upscayl HTTP service
      const upscaylFormData = new FormData();
      upscaylFormData.append('file', file);
      upscaylFormData.append('scale', '4');

      const response = await fetch(`${UPSCAYL_API_URL}/upscale`, {
        method: 'POST',
        body: upscaylFormData,
      });
      if (!response.ok) {
        throw new Error(`Upscayl service returned ${response.status}: ${response.statusText}`);
      }
      processedImageBuffer = Buffer.from(await response.arrayBuffer());
    }

    // Create processed directory in web folder if it doesn't exist
    const processedDir = await ensureProcessedDir();

    // Generate unique filename with processing chain
    const timestamp = Date.now();
    const originalName = path.parse(file.name).name;

    // Check if this is already a processed file by looking for existing suffixes
    let baseName = originalName;
    const processingSuffixes = [];

    if (originalName.includes('_bg_removed_')) {
      processingSuffixes.push('bg_removed');
      baseName = originalName.split('_bg_removed_')[0];
    }
    if (originalName.includes('_scaled_')) {
      processingSuffixes.push('scaled');
      baseName = originalName.split('_scaled_')[0];
    }
    if (originalName.includes('_upscaled_')) {
      processingSuffixes.push('upscaled');
      baseName = originalName.split('_upscaled_')[0];
    }

    // Add upscaled to the processing chain
    processingSuffixes.push('upscaled');

    const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
    const pngPath = path.join(processedDir, pngFilename);

    await fs.writeFile(pngPath, processedImageBuffer);
    console.log('💾 Upscaled PNG saved to:', pngPath);

    // Return the processed image with file URL for preview
    return new NextResponse(new Uint8Array(processedImageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': processedImageBuffer.length.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/workflow/${pngFilename}`,
      },
    });

  } catch (error) {
    console.error('Error upscaling image:', error);
    return NextResponse.json(
      { error: 'Failed to upscale image' },
      { status: 500 }
    );
  }
}

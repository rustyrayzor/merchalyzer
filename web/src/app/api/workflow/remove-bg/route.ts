import { NextRequest, NextResponse } from 'next/server';
import { rembg } from '@remove-background-ai/rembg.js';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed/workflow/removebg directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed', 'workflow', 'removebg');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
};

const REMBG_API_KEY = process.env.REM_BG_API_KEY || process.env.REMBG_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = (searchParams.get('provider') || 'pixelcut').toLowerCase();
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (provider === 'pixelcut') {
      const PIXELCUT_API_KEY = process.env.PIXELCUT_API_KEY || process.env.PIXEL_CUT_API_KEY;
      if (!PIXELCUT_API_KEY) {
        return NextResponse.json({ error: 'Pixelcut API key not configured. Please set PIXELCUT_API_KEY in environment.' }, { status: 500 });
      }

      console.log(`🎨 Processing image with Pixelcut: ${file.name} (${file.size} bytes)`);

      // Convert to PNG and send as base64 to avoid public URL requirement
      const asPng = await sharp(buffer).png().toBuffer();
      const base64NoPrefix = asPng.toString('base64');

      // First attempt: JSON with base64 payload
      let pcRes = await fetch('https://api.developer.pixelcut.ai/v1/remove-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-KEY': PIXELCUT_API_KEY,
        },
        body: JSON.stringify({ image_base64: base64NoPrefix, format: 'png' }),
      });
      if (!pcRes.ok) {
        const errText = await pcRes.text();
        const lowered = errText.toLowerCase();
        // Some accounts require multipart/form-data. Retry using multipart with image_base64.
        if (pcRes.status === 415 || lowered.includes('unsupported_content_type')) {
          try {
            const form = new FormData();
            form.append('format', 'png');
            // Send actual image file part as required by Pixelcut
            const uint8 = new Uint8Array(asPng);
            const blob = new Blob([uint8], { type: 'image/png' });
            form.append('image', blob, 'upload.png');
            pcRes = await fetch('https://api.developer.pixelcut.ai/v1/remove-background', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'X-API-KEY': PIXELCUT_API_KEY,
              },
              body: form,
            });
          } catch (e) {
            console.error('❌ Pixelcut multipart retry failed to send:', e);
          }
        } else {
          console.error('❌ Pixelcut error:', pcRes.status, errText);
          return NextResponse.json({ error: `Pixelcut failed: ${pcRes.status} ${errText}` }, { status: 502 });
        }
        if (!pcRes.ok) {
          const retryText = await pcRes.text();
          console.error('❌ Pixelcut error (multipart retry):', pcRes.status, retryText);
          return NextResponse.json({ error: `Pixelcut failed: ${pcRes.status} ${retryText}` }, { status: 502 });
        }
      }

      // Parse response (JSON with base64 or a raw image)
      const ct = pcRes.headers.get('content-type') || '';
      let outBuffer: Buffer | null = null;
      try {
        if (ct.includes('application/json')) {
          const json = await pcRes.json();
          const base64: string | undefined = json.image_base64 || json.base64 || json.image;
          const outUrl: string | undefined = json.output_url || json.url || json.image_url || json.result_url;
          if (base64) {
            const cleaned = base64.replace(/^data:image\/\w+;base64,/, '');
            outBuffer = Buffer.from(cleaned, 'base64');
          } else if (outUrl) {
            const img = await fetch(outUrl);
            if (!img.ok) throw new Error(`Failed to download Pixelcut image: ${img.status}`);
            const ab = await img.arrayBuffer();
            outBuffer = Buffer.from(ab);
          } else {
            throw new Error('Pixelcut JSON response missing image data');
          }
        } else if (ct.startsWith('image/')) {
          const ab = await pcRes.arrayBuffer();
          outBuffer = Buffer.from(ab);
        } else {
          const ab = await pcRes.arrayBuffer();
          outBuffer = Buffer.from(ab);
        }
      } catch {
        console.error('❌ Error parsing Pixelcut response');
        return NextResponse.json({ error: 'Failed to parse Pixelcut response' }, { status: 502 });
      }

      if (!outBuffer) {
        return NextResponse.json({ error: 'Pixelcut returned no image data' }, { status: 502 });
      }

      // Ensure PNG output and save
      let pngBuffer = outBuffer;
      try { pngBuffer = await sharp(outBuffer).png().toBuffer(); } catch {}

      const processedDir = await ensureProcessedDir();
      const timestamp = Date.now();
      const originalName = path.parse(file.name).name;
      let baseName = originalName;
      const processingSuffixes: string[] = [];
      if (originalName.includes('_upscaled_')) { processingSuffixes.push('upscaled'); baseName = originalName.split('_upscaled_')[0]; }
      if (originalName.includes('_scaled_')) { processingSuffixes.push('scaled'); baseName = originalName.split('_scaled_')[0]; }
      if (originalName.includes('_bg_removed_')) { processingSuffixes.push('bg_removed'); baseName = originalName.split('_bg_removed_')[0]; }
      processingSuffixes.push('bg_removed');
      const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
      const pngPath = path.join(processedDir, pngFilename);
      await fs.writeFile(pngPath, pngBuffer);
      console.log('💾 PNG saved to:', pngPath);

      return new NextResponse(new Uint8Array(pngBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': pngBuffer.length.toString(),
          'X-Processed-File': pngFilename,
          'X-Processed-Url': `/api/images/processed/workflow/removebg/${pngFilename}`,
        },
      });
    }

    // Default to rembg provider
    if (!REMBG_API_KEY) {
      return NextResponse.json({
        error: 'Rembg API key not configured. Please set REMBG_API_KEY environment variable.'
      }, { status: 500 });
    }

    console.log(`🎨 Processing image with rembg.js: ${file.name} (${file.size} bytes)`);

    // Use rembg.js to remove background
    const result = await rembg({
      apiKey: REMBG_API_KEY,
      inputImage: buffer,
      onDownloadProgress: (event) => {
        console.log('📥 Download progress:', {
          loaded: event.loaded,
          total: event.total,
          progress: event.progress ? Math.round(event.progress * 100) + '%' : 'N/A',
          download: event.download
        });
      },
      onUploadProgress: (event) => {
        console.log('📤 Upload progress:', {
          loaded: event.loaded,
          total: event.total,
          progress: event.progress ? Math.round(event.progress * 100) + '%' : 'N/A',
          upload: event.upload
        });
      }
    });

    console.log('✅🎉 Background removed successfully:', result.outputImagePath);

    if (!result.outputImagePath) {
      throw new Error('Output image path not provided by rembg');
    }

    // Read the processed WebP image file
    const processedImageBuffer = await fs.readFile(result.outputImagePath);

    // Convert WebP to PNG using Sharp
    console.log('🔄 Converting WebP to PNG...');
    const pngBuffer = await sharp(processedImageBuffer)
      .png()
      .toBuffer();

    // Create processed directory in web folder if it doesn't exist
    const processedDir = await ensureProcessedDir();

    // Generate unique filename with processing chain
    const timestamp = Date.now();
    const originalName = path.parse(file.name).name;

    // Check if this is already a processed file by looking for existing suffixes
    let baseName = originalName;
    const processingSuffixes = [] as string[];

    if (originalName.includes('_upscaled_')) {
      processingSuffixes.push('upscaled');
      baseName = originalName.split('_upscaled_')[0];
    }
    if (originalName.includes('_scaled_')) {
      processingSuffixes.push('scaled');
      baseName = originalName.split('_scaled_')[0];
    }
    if (originalName.includes('_bg_removed_')) {
      processingSuffixes.push('bg_removed');
      baseName = originalName.split('_bg_removed_')[0];
    }

    // Add bg_removed to the processing chain
    processingSuffixes.push('bg_removed');

    const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
    const pngPath = path.join(processedDir, pngFilename);

    // Save PNG file to web folder
    await fs.writeFile(pngPath, pngBuffer);
    console.log('💾 PNG saved to:', pngPath);

    // Clean up the temporary WebP file
    await result.cleanup();
    console.log('🧹 Temporary files cleaned up');

    // Return the PNG image with file URL for preview
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pngBuffer.length.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/workflow/removebg/${pngFilename}`,
      },
    });

  } catch (error) {
    console.error('❌ Error removing background with rembg.js:', error);
    return NextResponse.json(
      {
        error: `Failed to remove background: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

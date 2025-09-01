import { NextRequest, NextResponse } from 'next/server';
import { rembg } from '@remove-background-ai/rembg.js';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
};

const REMBG_API_KEY = process.env.REM_BG_API_KEY || process.env.REMBG_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!REMBG_API_KEY) {
      return NextResponse.json({
        error: 'Rembg API key not configured. Please set REMBG_API_KEY environment variable.'
      }, { status: 500 });
    }

    // Convert File to Buffer for rembg.js
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
    const processingSuffixes = [];

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
        'X-Processed-Url': `/api/images/processed/${pngFilename}`,
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

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed/workflow/scaled directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed', 'workflow', 'scaled');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) Trim transparent/solid background from edges to the visible content
    const trimmed = await sharp(buffer)
      .png() // ensure alpha channel is preserved
      .trim() // auto-crop surrounding background (transparent/solid)
      .toBuffer();

    // 2) Place on a 4500x5400 canvas, scaling to fit while keeping aspect and
    //    aligning to the top and horizontally centered (ideal for tees)
    const finalBuffer: Buffer = await sharp(trimmed)
      .resize(4500, 5400, {
        fit: 'contain',
        position: 'north', // top-center
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
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

    if (originalName.includes('_bg_removed_')) {
      processingSuffixes.push('bg_removed');
      baseName = originalName.split('_bg_removed_')[0];
    }
    if (originalName.includes('_upscaled_')) {
      processingSuffixes.push('upscaled');
      baseName = originalName.split('_upscaled_')[0];
    }
    if (originalName.includes('_scaled_')) {
      processingSuffixes.push('scaled');
      baseName = originalName.split('_scaled_')[0];
    }

    // Add scale to the processing chain
    processingSuffixes.push('scaled');

    const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
    const pngPath = path.join(processedDir, pngFilename);

    // Save PNG file to web folder
    await fs.writeFile(pngPath, finalBuffer);
    console.log('💾 Scaled PNG saved to:', pngPath);

    // Return the PNG image with file URL for preview
    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': finalBuffer.length.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/workflow/scaled/${pngFilename}`,
      },
    });

  } catch (error) {
    console.error('Error scaling image:', error);
    return NextResponse.json(
      { error: 'Failed to scale image' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed');
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

    // Get original image metadata to calculate proper scaling
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Calculate scaling to fit width to 4500px while maintaining aspect ratio
    const scaleFactor = 4500 / metadata.width;
    const scaledHeight = Math.round(metadata.height * scaleFactor);

    let finalBuffer: Buffer;

    if (scaledHeight >= 5400) {
      // If scaled height is >= 5400, crop from the top
      finalBuffer = await sharp(buffer)
        .resize(4500, 5400, {
          fit: 'cover',
          position: 'top', // Align to top
          withoutEnlargement: false
        })
        .png()
        .toBuffer();
    } else {
      // If scaled height is < 5400, resize to fit width and add transparent padding at bottom
      const resizedBuffer = await sharp(buffer)
        .resize(4500, null, { // null maintains aspect ratio
          withoutEnlargement: false
        })
        .png()
        .toBuffer();

      // Create canvas with transparent background and composite the resized image at the top
      finalBuffer = await sharp({
        create: {
          width: 4500,
          height: 5400,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite([{
          input: resizedBuffer,
          top: 0, // Align to top
          left: 0
        }])
        .png()
        .toBuffer();
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
        'X-Processed-Url': `/api/images/processed/${pngFilename}`,
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

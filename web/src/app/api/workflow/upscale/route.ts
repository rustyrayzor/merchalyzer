import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
};

const UPSCAYL_API_URL = process.env.UPSCAYL_API_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Create a new FormData to send to upscayl service
    const upscaylFormData = new FormData();
    upscaylFormData.append('file', file);
    upscaylFormData.append('scale', '4'); // Default scale factor

    // Proxy the request to the upscayl service
    const response = await fetch(`${UPSCAYL_API_URL}/upscale`, {
      method: 'POST',
      body: upscaylFormData,
    });

    if (!response.ok) {
      throw new Error(`Upscayl service returned ${response.status}: ${response.statusText}`);
    }

    // Get the processed image from upscayl service
    const processedImageBuffer = await response.arrayBuffer();

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

    // Save PNG file to web folder
    await fs.writeFile(pngPath, Buffer.from(processedImageBuffer));
    console.log('💾 Upscaled PNG saved to:', pngPath);

    // Return the processed image with file URL for preview
    return new NextResponse(new Uint8Array(processedImageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': processedImageBuffer.byteLength.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/${pngFilename}`,
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

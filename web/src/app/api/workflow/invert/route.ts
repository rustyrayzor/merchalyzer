import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed/workflow/invert directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed', 'workflow', 'invert');
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

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`🌓 Inverting image: ${file.name} (${file.size} bytes)`);

    // Invert colors using Sharp. Keep alpha channel unchanged.
    const processedImageBuffer = await sharp(buffer)
      .ensureAlpha()
      .negate({ alpha: false })
      .png()
      .toBuffer();

    // Create processed directory
    const processedDir = await ensureProcessedDir();

    // Generate unique filename with processing chain
    const timestamp = Date.now();
    const originalName = path.parse(file.name).name;

    // Preserve previous processing suffixes if present
    let baseName = originalName;
    const processingSuffixes: string[] = [];
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
    if (originalName.includes('_color_changed_')) {
      processingSuffixes.push('color_changed');
      baseName = originalName.split('_color_changed_')[0];
    }
    if (originalName.includes('_inverted_')) {
      processingSuffixes.push('inverted');
      baseName = originalName.split('_inverted_')[0];
    }

    processingSuffixes.push('inverted');

    const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
    const pngPath = path.join(processedDir, pngFilename);

    await fs.writeFile(pngPath, processedImageBuffer);
    console.log('💾 Inverted PNG saved to:', pngPath);

    return new NextResponse(new Uint8Array(processedImageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': processedImageBuffer.length.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/workflow/invert/${pngFilename}`,
      },
    });
  } catch (error) {
    console.error('❌ Error inverting image:', error);
    return NextResponse.json(
      { error: `Failed to invert image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

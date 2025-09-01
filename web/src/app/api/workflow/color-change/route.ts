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
    const targetColor = formData.get('targetColor') as string;
    const replacementColor = formData.get('replacementColor') as string;
    const tolerance = parseInt(formData.get('tolerance') as string) || 30;
    const fullColorReplacement = formData.get('fullColorReplacement') === 'true';

    // Get selection rectangle parameters
    const selectionCount = formData.get('selectionCount') ? parseInt(formData.get('selectionCount') as string) : 0;
    const selectionRects: Array<{x: number, y: number, width: number, height: number}> = [];

    if (selectionCount > 0) {
      for (let i = 0; i < selectionCount; i++) {
        const x = parseFloat(formData.get(`selectionX${i}`) as string);
        const y = parseFloat(formData.get(`selectionY${i}`) as string);
        const width = parseFloat(formData.get(`selectionWidth${i}`) as string);
        const height = parseFloat(formData.get(`selectionHeight${i}`) as string);

        if (!isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)) {
          selectionRects.push({ x, y, width, height });
        }
      }
    }

    // Get polygon (lasso) selections
    const polygonCount = formData.get('polygonCount') ? parseInt(formData.get('polygonCount') as string) : 0;
    const selectionPolygons: Array<{ points: Array<{ x:number; y:number }> }> = [];
    if (polygonCount > 0) {
      for (let p = 0; p < polygonCount; p++) {
        const pointCount = formData.get(`polygon${p}PointCount`) ? parseInt(formData.get(`polygon${p}PointCount`) as string) : 0;
        const points: Array<{ x:number; y:number }> = [];
        for (let i = 0; i < pointCount; i++) {
          const x = parseFloat(formData.get(`polygon${p}x${i}`) as string);
          const y = parseFloat(formData.get(`polygon${p}y${i}`) as string);
          if (!isNaN(x) && !isNaN(y)) points.push({ x, y });
        }
        if (points.length >= 3) selectionPolygons.push({ points });
      }
    }

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!targetColor || !replacementColor) {
      return NextResponse.json({ error: 'Target color and replacement color are required' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`🎨 Processing color change: ${file.name} (${file.size} bytes)`);
    console.log(`🎯 Target color: ${targetColor}, Replacement: ${replacementColor}, Tolerance: ${tolerance}`);

    // Parse target color (hex to RGB)
    const targetRgb = hexToRgb(targetColor);
    if (!targetRgb) {
      return NextResponse.json({ error: 'Invalid target color format. Use hex format like #ff0000' }, { status: 400 });
    }

    // Parse replacement color (hex to RGB)
    const replacementRgb = hexToRgb(replacementColor);
    if (!replacementRgb) {
      return NextResponse.json({ error: 'Invalid replacement color format. Use hex format like #ffffff' }, { status: 400 });
    }

    // Process the image with Sharp
    const processedBuffer = await sharp(buffer)
      .ensureAlpha() // Ensure we have an alpha channel
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = processedBuffer;
    const { width, height, channels } = info;

    console.log(`📐 Image dimensions: ${width}x${height}, Channels: ${channels}`);

    // Start with a copy of the original pixel data (faster when selections are used)
    const newData = Buffer.from(data);

    // Helper: process one pixel index in-place
    const tolSq = tolerance * tolerance;
    const applyAt = (idx: number) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = channels === 4 ? data[idx + 3] : 255;
      if (fullColorReplacement) {
        newData[idx] = replacementRgb.r;
        newData[idx + 1] = replacementRgb.g;
        newData[idx + 2] = replacementRgb.b;
        newData[idx + 3] = a;
      } else {
        // Compare squared distance to avoid costly sqrt
        const dr = r - targetRgb.r;
        const dg = g - targetRgb.g;
        const db = b - targetRgb.b;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq <= tolSq) {
          newData[idx] = replacementRgb.r;
          newData[idx + 1] = replacementRgb.g;
          newData[idx + 2] = replacementRgb.b;
          newData[idx + 3] = a;
        }
      }
    };

    // If there are no selections, scan the entire image
    const hasRects = selectionRects.length > 0;
    const hasPolys = selectionPolygons.length > 0;

    if (!hasRects && !hasPolys) {
      for (let i = 0; i < data.length; i += channels) {
        applyAt(i);
      }
    } else {
      // Process rectangles by iterating only inside each rect
      for (const rect of selectionRects) {
        const startX = Math.max(0, Math.floor(rect.x));
        const startY = Math.max(0, Math.floor(rect.y));
        const endX = Math.min(width, Math.ceil(rect.x + rect.width));
        const endY = Math.min(height, Math.ceil(rect.y + rect.height));
        for (let y = startY; y < endY; y++) {
          let base = (y * width + startX) * channels;
          for (let x = startX; x < endX; x++, base += channels) {
            applyAt(base);
          }
        }
      }

      // Process polygons by iterating over bounding boxes
      for (const poly of selectionPolygons) {
        if (!poly.points || poly.points.length < 3) continue;
        const xs = poly.points.map(p => p.x);
        const ys = poly.points.map(p => p.y);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const maxX = Math.min(width, Math.ceil(Math.max(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxY = Math.min(height, Math.ceil(Math.max(...ys)));
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x < maxX; x++) {
            if (pointInPolygon(x + 0.5, y + 0.5, poly.points)) {
              const idx = (y * width + x) * channels;
              applyAt(idx);
            }
          }
        }
      }
    }

    // Create new Sharp instance with processed data
    const processedImageBuffer = await sharp(newData, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
    .png({ compressionLevel: 6 })
    .toBuffer();

    console.log('✅ Color change processing completed');

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
    if (originalName.includes('_color_changed_')) {
      processingSuffixes.push('color_changed');
      baseName = originalName.split('_color_changed_')[0];
    }

    // Add color_changed to the processing chain
    processingSuffixes.push('color_changed');

    const pngFilename = `${baseName}_${processingSuffixes.join('_')}_${timestamp}.png`;
    const pngPath = path.join(processedDir, pngFilename);

    // Save PNG file to web folder
    await fs.writeFile(pngPath, processedImageBuffer);
    console.log('💾 PNG saved to:', pngPath);

    // Return the PNG image with file URL for preview
    return new NextResponse(new Uint8Array(processedImageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': processedImageBuffer.length.toString(),
        'X-Processed-File': pngFilename,
        'X-Processed-Url': `/api/images/processed/${pngFilename}`,
      },
    });

  } catch (error) {
    console.error('❌ Error changing colors:', error);
    return NextResponse.json(
      {
        error: `Failed to change colors: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Ray casting point-in-polygon test
function pointInPolygon(x: number, y: number, pts: Array<{ x:number; y:number }>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

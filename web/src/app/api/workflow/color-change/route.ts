import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

// Create processed/workflow/color-change directory if it doesn't exist
const ensureProcessedDir = async () => {
  const processedDir = path.join(process.cwd(), 'processed', 'workflow', 'color-change');
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
    const replaceWithTransparent = formData.get('replaceWithTransparent') === 'true';

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

    // Optional paint mask
    const maskFile = formData.get('mask') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!targetColor) {
      return NextResponse.json({ error: 'Target color is required' }, { status: 400 });
    }
    if (!replaceWithTransparent && !replacementColor) {
      return NextResponse.json({ error: 'Replacement color is required unless replacing with transparency' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`🎨 Processing color change: ${file.name} (${file.size} bytes)`);
    console.log(`🎯 Target color: ${targetColor}, Replacement: ${replaceWithTransparent ? 'TRANSPARENT' : replacementColor}, Tolerance: ${tolerance}`);

    // Parse target color (hex to RGB)
    const targetRgb = hexToRgb(targetColor);
    if (!targetRgb) {
      return NextResponse.json({ error: 'Invalid target color format. Use hex format like #ff0000' }, { status: 400 });
    }

    // Parse replacement color (hex to RGB) if not transparent
    const replacementRgb = replaceWithTransparent ? null : hexToRgb(replacementColor);
    if (!replaceWithTransparent && !replacementRgb) {
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
        if (replaceWithTransparent) {
          // Make pixel fully transparent; zero RGB to avoid halos
          newData[idx] = 0; newData[idx + 1] = 0; newData[idx + 2] = 0;
          newData[idx + 3] = 0;
        } else if (replacementRgb) {
          newData[idx] = replacementRgb.r;
          newData[idx + 1] = replacementRgb.g;
          newData[idx + 2] = replacementRgb.b;
          newData[idx + 3] = a;
        }
      } else {
        // Compare squared distance to avoid costly sqrt
        const dr = r - targetRgb.r;
        const dg = g - targetRgb.g;
        const db = b - targetRgb.b;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq <= tolSq) {
            if (replaceWithTransparent) {
              newData[idx] = 0; newData[idx + 1] = 0; newData[idx + 2] = 0;
              newData[idx + 3] = 0;
            } else if (replacementRgb) {
              newData[idx] = replacementRgb.r;
              newData[idx + 1] = replacementRgb.g;
              newData[idx + 2] = replacementRgb.b;
            newData[idx + 3] = a;
          }
        }
      }
    };

    // Load mask if present and resize to image dimensions
    let maskData: Uint8Array | null = null;
    let maskChannels = 0;
    if (maskFile) {
      try {
        const maskArr = await maskFile.arrayBuffer();
        const maskBuf = Buffer.from(maskArr);
        const { data: md, info: mi } = await sharp(maskBuf)
          .ensureAlpha()
          .resize(width, height, { fit: 'fill' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        maskData = md;
        maskChannels = mi.channels;
      } catch (e) {
        console.warn('Mask load failed, ignoring:', e);
        maskData = null;
      }
    }

    const hasMask = !!maskData;

    // If there are no selections/mask, scan the entire image
    const hasRects = selectionRects.length > 0;
    const hasPolys = selectionPolygons.length > 0;

    if (!hasRects && !hasPolys && !hasMask) {
      for (let i = 0; i < data.length; i += channels) {
        applyAt(i);
      }
    } else {
      // Unified scan with gating: pixel must be inside any rect OR any polygon OR mask alpha > 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let inside = false;
          if (!inside && hasRects) {
            for (const rect of selectionRects) {
              if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) { inside = true; break; }
            }
          }
          if (!inside && hasPolys) {
            for (const poly of selectionPolygons) {
              if (poly.points && poly.points.length >= 3 && pointInPolygon(x + 0.5, y + 0.5, poly.points)) { inside = true; break; }
            }
          }
          if (!inside && hasMask && maskData) {
            const midx = (y * width + x) * maskChannels;
            const ma = maskData[midx + (maskChannels - 1)];
            if (ma > 0) inside = true;
          }
          if (inside) {
            const idx = (y * width + x) * channels;
            applyAt(idx);
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
        'X-Processed-Url': `/api/images/processed/workflow/color-change/${pngFilename}`,
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

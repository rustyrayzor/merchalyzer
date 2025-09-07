'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkflowImage } from '@/lib/types';
import { generateUUID } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';


import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Loader2,
  Info,
  ArrowLeft,
  Square,
  Lasso,
  Brush
} from 'lucide-react';

interface ColorChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (
    targetColor: string,
    replacementColor: string,
    tolerance: number,
    selectionRects: Array<{ id: string; x: number; y: number; width: number; height: number }>,
    selectionPolygons: Array<{ id: string; points: Array<{ x: number; y: number }> }>,
    fullColorReplacement: boolean,
    replaceWithTransparent: boolean,
    paintMaskDataUrl?: string | null
  ) => Promise<void> | void;
  originalImage: WorkflowImage;
}

export default function ColorChangeModal({
  isOpen,
  onClose,
  onProceed,
  originalImage,
}: ColorChangeModalProps) {
  const [targetColor, setTargetColor] = useState('#000000'); // Default to black (common text color)
  const [replacementColor, setReplacementColor] = useState('#ffffff'); // Default to white
  const [tolerance, setTolerance] = useState(30);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  type SelectionRect = { id: string; x: number; y: number; width: number; height: number };
  type SelectionPolygon = { id: string; points: Array<{ x: number; y: number }>; };

  const [selectionRects, setSelectionRects] = useState<SelectionRect[]>([]);
  const [selectionPolygons, setSelectionPolygons] = useState<SelectionPolygon[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentRect, setCurrentRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [currentPolygon, setCurrentPolygon] = useState<Array<{x:number;y:number}> | null>(null);
  const [selectionType, setSelectionType] = useState<'rect' | 'lasso' | 'paint'>('rect');
  // Paint-in mask state
  const paintMaskCanvasRef = useRef<HTMLCanvasElement>(null); // offscreen mask at render size
  const paintOverlayCanvasRef = useRef<HTMLCanvasElement>(null); // on-screen overlay scaled to display
  const renderSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const [brushSize, setBrushSize] = useState<number>(22);
  const [isPainting, setIsPainting] = useState(false);
  const lastPaintPointRef = useRef<{ x: number; y: number } | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fullColorReplacement, setFullColorReplacement] = useState(false);
  const [replaceWithTransparent, setReplaceWithTransparent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [originalDisplayUrl, setOriginalDisplayUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const previewImgRef = useRef<HTMLImageElement>(null);


  const handleProceed = async () => {
    try {
      setIsSubmitting(true);
      // Pass both rectangles and polygons to parent
      // Include paint mask as data URL PNG if present
      let maskDataUrl: string | null = null;
      try {
        if (paintMaskCanvasRef.current) {
          // Only include if there is painted content (non-empty alpha)
          const m = paintMaskCanvasRef.current;
          const ctx = m.getContext('2d');
          const d = ctx?.getImageData(0,0,m.width,m.height).data;
          if (d) {
            let any = false; for (let i=3;i<d.length;i+=4){ if (d[i] > 0) { any = true; break; } }
            if (any) maskDataUrl = m.toDataURL('image/png');
          }
        }
      } catch {}
      const maybe = onProceed(
        targetColor,
        replacementColor,
        tolerance,
        selectionRects,
        selectionPolygons,
        fullColorReplacement,
        replaceWithTransparent,
        maskDataUrl
      );
      if (maybe && typeof maybe.then === 'function') {
        await maybe;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset to defaults when closing
    setTargetColor('#000000');
    setReplacementColor('#ffffff');
    setTolerance(30);
    setSelectionMode(false);
    setSelectionRects([]);
    setSelectionPolygons([]);
    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
    setCurrentPolygon(null);
    setZoomLevel(1);
    setFullColorReplacement(false);
    setReplaceWithTransparent(false);
    setPreviewDataUrl(null);
    setOriginalDisplayUrl('');
    // Clear mask
    try {
      const m = paintMaskCanvasRef.current; if (m) { const c = m.getContext('2d'); if (c) { c.clearRect(0,0,m.width,m.height); } }
      const ov = paintOverlayCanvasRef.current; if (ov) { const oc = ov.getContext('2d'); if (oc) { oc.clearRect(0,0,ov.width,ov.height); } }
      setMaskVersion(v => v + 1);
    } catch {}


    onClose();
  };

  // Resolve a stable display URL for the Original image to avoid re-creating object URLs on every render
  useEffect(() => {
    let revokeUrl: string | null = null;
    (async () => {
      try {
        // Use the same priority as the server-side operation: processed image if available, else original file, else thumbnail
        if (originalImage?.processedUrl) {
          setOriginalDisplayUrl(originalImage.processedUrl);
          return;
        }
        if (originalImage?.originalFile) {
          const url = URL.createObjectURL(originalImage.originalFile);
          revokeUrl = url;
          setOriginalDisplayUrl(url);
          return;
        }
        if (originalImage?.thumbnailUrl) {
          setOriginalDisplayUrl(originalImage.thumbnailUrl);
          return;
        }
      } catch {
        // noop
      }
    })();
    return () => {
      try { if (revokeUrl) URL.revokeObjectURL(revokeUrl); } catch {}
    };
  }, [originalImage]);

  // Zoom control functions
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5)); // Max zoom 5x
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5)); // Min zoom 0.5x
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  // Generate live preview of color changes
  const generatePreview = useCallback(async () => {
    if (!canvasRef.current) {
      return;
    }

    setIsGeneratingPreview(true);

    // Declare revokeUrl outside try block so it's accessible in finally
    let revokeUrl: string | null = null;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Resolve an image source to a safe same-origin blob URL to avoid canvas tainting
      let srcUrl: string | null = null;

      const tryFetchToBlobUrl = async (url?: string | null): Promise<string | null> => {
        if (!url) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          const u = URL.createObjectURL(blob);
          return u;
        } catch { return null; }
      };
      const tryFileToUrl = (file?: File | null): string | null => {
        if (!file) return null;
        if (typeof file.size === 'number' && file.size <= 0) return null; // ignore placeholder empty files
        try { return URL.createObjectURL(file); } catch { return null; }
      };

      // Prefer highest quality available for better zoom detail
      // 1) processedUrl (fetch to same-origin blob)
      srcUrl = await tryFetchToBlobUrl(originalImage.processedUrl);
      // 2) originalFile (only if non-empty)
      if (!srcUrl) srcUrl = tryFileToUrl(originalImage.originalFile);
      // 3) thumbnailUrl (fetch to blob)
      if (!srcUrl) srcUrl = await tryFetchToBlobUrl(originalImage.thumbnailUrl);
      // 4) last resort: if originalFile exists but size unknown, try anyway
      if (!srcUrl && originalImage.originalFile) srcUrl = tryFileToUrl(originalImage.originalFile);
      // Track for cleanup
      revokeUrl = srcUrl;

      if (!srcUrl) throw new Error('No source image available for preview');

      // Load image onto canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = reject;
        img.src = srcUrl as string;
      });

      // Store original image dimensions
      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;
      setNaturalSize({ width: originalWidth, height: originalHeight });


      // Render at natural dimensions (or capped) for higher-quality zoom and accurate overlays
      let width = originalWidth;
      let height = originalHeight;
      let scaleX = 1;
      let scaleY = 1;

      // Cap extremely large images to avoid memory spikes (keeps aspect ratio)
      const MAX_DIMENSION = 3000; // generous cap for quality zoom
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height >= width && height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }

      // Compute scale from original to canvas size (may be < 1 when capped)
      scaleX = width / originalWidth;
      scaleY = height / originalHeight;

      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      // Track render size for paint mask
      renderSizeRef.current = { width: canvas.width, height: canvas.height };
      // Ensure mask canvas matches render size
      (function ensureMask() {
        const m = paintMaskCanvasRef.current || (paintMaskCanvasRef.current = document.createElement('canvas'));
        if (m.width !== canvas.width || m.height !== canvas.height) {
          m.width = canvas.width; m.height = canvas.height;
          const mc = m.getContext('2d'); if (mc) mc.clearRect(0,0,m.width,m.height);
        }
      })();

      // Store canvas dimensions for overlay positioning


      // Clear canvas with transparent background
      ctx.clearRect(0, 0, width, height);

      // Enable high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0, width, height);

      // Get image data for pixel manipulation
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Parse colors
      const targetRgb = hexToRgb(targetColor);
      const replacementRgb = replaceWithTransparent ? null : hexToRgb(replacementColor);

      if (!targetRgb) return;

      // Precompute scaled polygons for selection checks
      const scaledPolygons = (selectionPolygons || []).map(poly =>
        poly.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }))
      );

      // Prepare mask snapshot if present
      let maskData: Uint8ClampedArray | null = null;
      let maskNonEmpty = false;
      const maskCanvas = paintMaskCanvasRef.current;
      if (maskCanvas && maskCanvas.width === width && maskCanvas.height === height) {
        const mctx = maskCanvas.getContext('2d');
        if (mctx) {
          const md = mctx.getImageData(0, 0, width, height).data;
          // Determine if any alpha > 0 exists in mask
          for (let i = 3; i < md.length; i += 4) { if (md[i] > 0) { maskNonEmpty = true; break; } }
          maskData = maskNonEmpty ? md : null;
        }
      }

      // Process pixels
      for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const pixelX = pixelIndex % width;
        const pixelY = Math.floor(pixelIndex / width);

        // Check if pixel is within any selection (if selections exist)
        let isInSelection = true;
      const hasMask = !!maskData && maskNonEmpty;
        if ((selectionRects.length > 0) || (scaledPolygons.length > 0) || hasMask) {
          isInSelection = false;
          // Paint mask check
          if (hasMask && maskData) {
            const mi = (pixelY * width + pixelX) * 4;
            if (maskData[mi + 3] > 0) isInSelection = true;
          }
          for (const selectionRect of selectionRects) {
            // Convert selection coordinates from original image space to canvas space
            // Selection rectangles are stored in original image coordinates
            // Canvas may be scaled down from original, so we scale selections accordingly
            const scaledSelectionX = selectionRect.x * scaleX;
            const scaledSelectionY = selectionRect.y * scaleY;
            const scaledSelectionWidth = selectionRect.width * scaleX;
            const scaledSelectionHeight = selectionRect.height * scaleY;

            if (
              pixelX >= scaledSelectionX &&
              pixelX < scaledSelectionX + scaledSelectionWidth &&
              pixelY >= scaledSelectionY &&
              pixelY < scaledSelectionY + scaledSelectionHeight
            ) {
              isInSelection = true;
              break;
            }
          }
          if (!isInSelection && scaledPolygons.length > 0) {
            // Check polygons with ray casting
            for (const pts of scaledPolygons) {
              if (pointInPolygon(pixelX + 0.5, pixelY + 0.5, pts)) { // center of pixel
                isInSelection = true;
                break;
              }
            }
          }
        }

        if (isInSelection) {
          if (fullColorReplacement) {
            // Full color replacement: replace ALL pixels in selection
            if (replaceWithTransparent) {
              // Make fully transparent; also zero RGB to avoid halo artifacts
              data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
              data[i + 3] = 0; // A
            } else if (replacementRgb) {
              data[i] = replacementRgb.r;     // R
              data[i + 1] = replacementRgb.g; // G
              data[i + 2] = replacementRgb.b; // B
            }
          } else {
            // Tolerance-based replacement: only replace pixels that match target color within tolerance
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Calculate color distance
            const distance = Math.sqrt(
              Math.pow(r - targetRgb.r, 2) +
              Math.pow(g - targetRgb.g, 2) +
              Math.pow(b - targetRgb.b, 2)
            );

            // Replace if within tolerance
            if (distance <= tolerance) {
              if (replaceWithTransparent) {
                // Transparent with RGB cleared
                data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
                data[i + 3] = 0; // A
              } else if (replacementRgb) {
                data[i] = replacementRgb.r;     // R
                data[i + 1] = replacementRgb.g; // G
                data[i + 2] = replacementRgb.b; // B
              }
            }
          }
        }
      }

      // Put modified image data back
      ctx.putImageData(imageData, 0, 0);

      // Generate preview data URL with high quality
      const previewUrl = canvas.toDataURL('image/png', 1.0);
      setPreviewDataUrl(previewUrl);

    } catch (error) {
      console.error('❌ Error generating preview:', error);
    } finally {
      // Revoke any temporary blob URL
      try {
        if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      } catch {}
      setIsGeneratingPreview(false);
    }
  }, [targetColor, replacementColor, tolerance, selectionRects, selectionPolygons, fullColorReplacement, originalImage, replaceWithTransparent]);
  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Point in polygon (ray casting). pts in canvas/display coordinate space
  const pointInPolygon = (x: number, y: number, pts: Array<{x:number; y:number}>) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Mouse event handlers for selection
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!selectionMode) return;
    if (selectionType === 'paint') {
      const imgEl = e.currentTarget as HTMLImageElement;
      const rect = imgEl.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width;
      const normY = (e.clientY - rect.top) / rect.height;
      const xOrig = normX * imgEl.naturalWidth;
      const yOrig = normY * imgEl.naturalHeight;
      setIsPainting(true);
      lastPaintPointRef.current = { x: xOrig, y: yOrig };
      paintToMask(xOrig, yOrig, xOrig, yOrig);
      return;
    }
    const imgEl = e.currentTarget as HTMLImageElement;
    const rect = imgEl.getBoundingClientRect();
    // Normalize pointer position within displayed image (accounts for zoom since rect includes transforms)
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    // Convert to original image pixel coordinates using natural dimensions
    const x = normX * imgEl.naturalWidth;
    const y = normY * imgEl.naturalHeight;

    setIsDrawing(true);
    if (selectionType === 'rect') {
      setStartPos({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
      setCurrentPolygon(null);
    } else {
      setStartPos(null);
      setCurrentRect(null);
      setCurrentPolygon([{ x, y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!selectionMode) return;
    if (selectionType === 'paint') {
      if (!isPainting) return;
      const imgEl = e.currentTarget as HTMLImageElement;
      const rect = imgEl.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width;
      const normY = (e.clientY - rect.top) / rect.height;
      const xOrig = normX * imgEl.naturalWidth;
      const yOrig = normY * imgEl.naturalHeight;
      const last = lastPaintPointRef.current || { x: xOrig, y: yOrig };
      paintToMask(last.x, last.y, xOrig, yOrig);
      lastPaintPointRef.current = { x: xOrig, y: yOrig };
      return;
    }
    if (!isDrawing) return;

    const imgEl = e.currentTarget as HTMLImageElement;
    const rect = imgEl.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    const currentX = normX * imgEl.naturalWidth;
    const currentY = normY * imgEl.naturalHeight;

    if (selectionType === 'rect') {
      if (!startPos) return;
      const width = currentX - startPos.x;
      const height = currentY - startPos.y;
      setCurrentRect({
        x: width < 0 ? currentX : startPos.x,
        y: height < 0 ? currentY : startPos.y,
        width: Math.abs(width),
        height: Math.abs(height)
      });
    } else if (selectionType === 'lasso') {
      if (!currentPolygon) return;
      const last = currentPolygon[currentPolygon.length - 1];
      if (!last) { setCurrentPolygon([{ x: currentX, y: currentY }]); return; }
      const dx = currentX - last.x;
      const dy = currentY - last.y;
      if (Math.hypot(dx, dy) > 2) {
        setCurrentPolygon([...currentPolygon, { x: currentX, y: currentY }]);
      }
    }
  };

  const handleMouseUp = () => {
    if (!selectionMode) return;
    if (selectionType === 'paint') {
      setIsDrawing(false);
      setIsPainting(false);
      lastPaintPointRef.current = null;
      setMaskVersion(v => v + 1);
      return;
    }

    if (selectionType === 'rect') {
      if (!currentRect) { setIsDrawing(false); return; }
      if (currentRect.width > 5 && currentRect.height > 5) {
        const newSelection: SelectionRect = { id: generateUUID(), ...currentRect };
        setSelectionRects(prev => [...prev, newSelection]);
      }
      setIsDrawing(false);
      setStartPos(null);
      setCurrentRect(null);
    } else {
      if (!currentPolygon || currentPolygon.length < 3) { setIsDrawing(false); setCurrentPolygon(null); return; }
      const xs = currentPolygon.map(p => p.x);
      const ys = currentPolygon.map(p => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (w > 5 && h > 5) {
        setSelectionPolygons(prev => [...prev, { id: generateUUID(), points: currentPolygon }]);
      }
      setIsDrawing(false);
      setCurrentPolygon(null);
    }
  };

  const clearSelection = () => {
    setSelectionRects([]);
    setSelectionPolygons([]);
    setSelectionMode(false);
  };
  const clearPaint = () => {
    const m = paintMaskCanvasRef.current; if (!m) return; const c = m.getContext('2d'); if (!c) return; c.clearRect(0,0,m.width,m.height);
    // Also clear visible overlay
    const ov = paintOverlayCanvasRef.current; if (ov) { const oc = ov.getContext('2d'); if (oc) oc.clearRect(0,0,ov.width,ov.height); }
    setMaskVersion(v => v + 1);
  };

  // Draw helper: map original coords to render mask and draw stroke
  const paintToMask = (x0Orig: number, y0Orig: number, x1Orig: number, y1Orig: number) => {
    const m = paintMaskCanvasRef.current; if (!m) return;
    const { width: rw, height: rh } = renderSizeRef.current;
    if (!rw || !rh || !naturalSize.width || !naturalSize.height) return;
    const sx = rw / naturalSize.width;
    const sy = rh / naturalSize.height;
    const x0 = x0Orig * sx; const y0 = y0Orig * sy;
    const x1 = x1Orig * sx; const y1 = y1Orig * sy;
    const ctx = m.getContext('2d'); if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,0,0,0.9)';
    ctx.lineWidth = Math.max(1, Math.round(brushSize * sx));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
    // Update on-image overlay
    drawPaintOverlay();
  };
  const drawPaintOverlay = () => {
    const ov = paintOverlayCanvasRef.current; const m = paintMaskCanvasRef.current; const imgEl = imgRef.current; if (!ov || !m || !imgEl) return;
    const bcr = imgEl.getBoundingClientRect();
    ov.width = Math.max(1, Math.round(bcr.width));
    ov.height = Math.max(1, Math.round(bcr.height));
    const ctx = ov.getContext('2d'); if (!ctx) return; ctx.clearRect(0,0,ov.width,ov.height);
    // Draw mask scaled to display size
    ctx.globalAlpha = 0.35;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m, 0, 0, m.width, m.height, 0, 0, ov.width, ov.height);
    ctx.globalAlpha = 1;
  };

  const removeSelection = (id: string) => {
    setSelectionRects(prev => prev.filter(rect => rect.id !== id));
  };
  const removePolygon = (id: string) => {
    setSelectionPolygons(prev => prev.filter(poly => poly.id !== id));
  };

  // Generate preview when colors, tolerance, selection, zoom, or replacement mode change
  useEffect(() => {
    if (isOpen && originalImage) {
      generatePreview();
    }
  }, [targetColor, replacementColor, tolerance, selectionRects, selectionPolygons, zoomLevel, fullColorReplacement, isOpen, originalImage, generatePreview, replaceWithTransparent]);
  useEffect(() => {
    if (isOpen && originalImage) {
      generatePreview();
    }
  }, [maskVersion]);

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="inset-0 w-screen sm:max-w-none max-w-none h-screen overflow-y-auto"
        style={{ width: '100vw', maxWidth: '100vw' }}
      >
        <SheetHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Change Color
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Body wrapper to align with header padding */}
        <div className="px-4 pb-4">

          {/* Controls */}
          <div className="mb-4 space-y-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Zoom:</span>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={zoomOut}
                    variant="outline"
                    size="sm"
                    disabled={zoomLevel <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Badge variant="secondary" className="min-w-[60px] justify-center">
                    {Math.round(zoomLevel * 100)}%
                  </Badge>
                  <Button
                    onClick={zoomIn}
                    variant="outline"
                    size="sm"
                    disabled={zoomLevel >= 5}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={resetZoom}
                    variant="outline"
                    size="sm"
                    className="ml-2"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="selection-mode"
                  checked={selectionMode}
                  onCheckedChange={(checked) => {
                    setSelectionMode(checked as boolean);
                    if (!checked) {
                      setSelectionRects([]);
                      setSelectionPolygons([]);
                    }
                  }}
                />
                <label htmlFor="selection-mode" className="text-sm font-medium">
                  Enable Area Selection
                </label>
                {selectionMode && (
                  <div className="ml-3 flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant={selectionType === 'rect' ? 'default' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => setSelectionType('rect')}
                      title="Rectangle select"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={selectionType === 'lasso' ? 'default' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => setSelectionType('lasso')}
                      title="Free draw (lasso)"
                    >
                      <Lasso className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={selectionType === 'paint' ? 'default' : 'outline'}
                      className="h-8 w-8"
                      onClick={() => setSelectionType('paint')}
                      title="Paint in mask"
                    >
                      <Brush className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {(selectionRects.length > 0 || selectionPolygons.length > 0) && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectionRects.length + selectionPolygons.length} area{(selectionRects.length + selectionPolygons.length) > 1 ? 's' : ''} selected
                  </Badge>
                  <Button
                    onClick={clearSelection}
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                  <Button
                    onClick={clearPaint}
                    variant="outline"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Clear Paint
                  </Button>
                </div>
              )}

              {selectionMode && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-800">Click and drag on the image to select an area</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Image Preview */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Image */}
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Original</h3>
                <div className="relative">
                  <div
                    className="relative overflow-auto border rounded bg-white"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '75vh',
                      backgroundImage: `
                        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                    }}
                  >
                    <div className="relative inline-block">
                      <img // eslint-disable-line @next/next/no-img-element
                        ref={imgRef}
                        src={originalDisplayUrl}
                        alt={originalImage.originalFile.name}
                        className={`rounded ${selectionMode ? 'cursor-crosshair' : ''}`}
                        style={{
                          transform: `scale(${zoomLevel})`,
                          transformOrigin: 'top left',
                          imageRendering: 'auto',
                          WebkitBackfaceVisibility: 'hidden',
                          backfaceVisibility: 'hidden',
                          WebkitTransform: `scale(${zoomLevel})`,
                          WebkitTransformOrigin: 'top left'
                        } as React.CSSProperties}
                        onLoad={(e) => {
                          const imgEl = e.currentTarget as HTMLImageElement;
                          setNaturalSize({ width: imgEl.naturalWidth, height: imgEl.naturalHeight });
                          generatePreview();
                        }}
                        onMouseDown={selectionMode ? handleMouseDown : undefined}
                        onMouseMove={selectionMode ? handleMouseMove : undefined}
                        onMouseUp={selectionMode ? handleMouseUp : undefined}
                        onMouseLeave={selectionMode ? handleMouseUp : undefined}
                        draggable={false}
                      />
                      {/* Paint overlay canvas (scaled to displayed size) */}
                      <canvas
                        ref={paintOverlayCanvasRef}
                        className="absolute left-0 top-0 pointer-events-none"
                      />

                      {/* Selection Rectangles Overlay */}
                      {selectionRects.map((selectionRect) => {
                        // Map original image coords to displayed coords using current img bounding box
                        const bcr = imgRef.current?.getBoundingClientRect();
                        const dispW = bcr?.width ?? 0;
                        const dispH = bcr?.height ?? 0;
                        const natW = naturalSize.width || 1;
                        const natH = naturalSize.height || 1;
                        const left = (selectionRect.x / natW) * dispW;
                        const top = (selectionRect.y / natH) * dispH;
                        const width = (selectionRect.width / natW) * dispW;
                        const height = (selectionRect.height / natH) * dispH;
                        return (
                          <div key={selectionRect.id}>
                            <div
                              className="absolute border-2 border-blue-500 border-dashed pointer-events-none"
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${width}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-md flex items-center gap-1 pointer-events-auto select-none">
                                <span>{Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeSelection(selectionRect.id); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="h-4 w-4 p-0 text-primary-foreground hover:text-destructive-foreground hover:bg-destructive rounded pointer-events-auto"
                                  title="Remove this selection"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Polygon selections overlay (original) */}
                      {selectionPolygons.length > 0 && (() => {
                        const bcr = imgRef.current?.getBoundingClientRect();
                        const dispW = bcr?.width ?? 0;
                        const dispH = bcr?.height ?? 0;
                        const natW = naturalSize.width || 1;
                        const natH = naturalSize.height || 1;
                        return (
                          <>
                            <svg className="absolute left-0 top-0 pointer-events-none" width={dispW} height={dispH} viewBox={`0 0 ${dispW} ${dispH}`}>
                              {selectionPolygons.map((poly) => {
                                const pts = poly.points.map(p => `${(p.x / natW) * dispW},${(p.y / natH) * dispH}`).join(' ');
                                return (
                                  <polyline key={poly.id} points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4" />
                                );
                              })}
                              {currentPolygon && (
                                <polyline points={currentPolygon.map(p => `${(p.x / natW) * dispW},${(p.y / natH) * dispH}`).join(' ')} fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="6 4" />
                              )}
                            </svg>
                            {selectionPolygons.map((poly) => {
                              const minX = Math.min(...poly.points.map(p => p.x));
                              const minY = Math.min(...poly.points.map(p => p.y));
                              const left = (minX / natW) * dispW;
                              const top = (minY / natH) * dispH - 24;
                              return (
                                <div key={poly.id} className="absolute" style={{ left, top }}>
                                  <div className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-md flex items-center gap-1 pointer-events-auto select-none">
                                    <span>Area</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removePolygon(poly.id); }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className="h-4 w-4 p-0 text-primary-foreground hover:text-destructive-foreground hover:bg-destructive rounded pointer-events-auto"
                                      title="Remove this selection"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}

                      {/* Current drawing rectangle */}
                      {currentRect && (() => {
                        const bcr = imgRef.current?.getBoundingClientRect();
                        const dispW = bcr?.width ?? 0;
                        const dispH = bcr?.height ?? 0;
                        const natW = naturalSize.width || 1;
                        const natH = naturalSize.height || 1;
                        const left = (currentRect.x / natW) * dispW;
                        const top = (currentRect.y / natH) * dispH;
                        const width = (currentRect.width / natW) * dispW;
                        const height = (currentRect.height / natH) * dispH;
                        return (
                          <div
                            className="absolute border-2 border-orange-500 border-dashed pointer-events-none"
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                            }}
                          >
                          <div className="absolute -top-6 left-0 bg-orange-600 text-white text-xs px-2 py-1 rounded shadow-md flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Drawing...
                          </div>
                          </div>
                        );
                      })()}
                      {currentPolygon && (() => {
                        const bcr = imgRef.current?.getBoundingClientRect();
                        const dispW = bcr?.width ?? 0;
                        const dispH = bcr?.height ?? 0;
                        const natW = naturalSize.width || 1;
                        const natH = naturalSize.height || 1;
                        const pts = currentPolygon.map(p => `${(p.x / natW) * dispW},${(p.y / natH) * dispH}`).join(' ');
                        return (
                          <svg className="absolute left-0 top-0 pointer-events-none" width={dispW} height={dispH} viewBox={`0 0 ${dispW} ${dispH}`}>
                            <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="6 4" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Image */}
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Preview {isGeneratingPreview && <span className="text-blue-500">(Updating...)</span>}
                </h3>
                <div className="relative">
                  {previewDataUrl ? (
                                      <div
                    className="relative overflow-auto border rounded bg-white mx-auto"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '75vh',
                      backgroundImage: `
                        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                    }}
                  >
                    <div className="relative inline-block">
                      <img // eslint-disable-line @next/next/no-img-element
                        ref={previewImgRef}
                        src={previewDataUrl}
                        alt="Color change preview"
                        className="rounded"
                        style={{
                          transform: `scale(${zoomLevel})`,
                          transformOrigin: 'top left',
                          imageRendering: 'auto',
                          WebkitBackfaceVisibility: 'hidden',
                          backfaceVisibility: 'hidden',
                          WebkitTransform: `scale(${zoomLevel})`,
                          WebkitTransformOrigin: 'top left'
                        } as React.CSSProperties}
                      />

                        {/* Selection Rectangles Overlay on Preview */}
                        {selectionRects.map((selectionRect, index) => {
                          const bcr = previewImgRef.current?.getBoundingClientRect();
                          const dispW = bcr?.width ?? ((canvasRef.current?.width ?? 0) * zoomLevel);
                          const dispH = bcr?.height ?? ((canvasRef.current?.height ?? 0) * zoomLevel);
                          const natW = naturalSize.width || 1;
                          const natH = naturalSize.height || 1;
                          const left = (selectionRect.x / natW) * dispW;
                          const top = (selectionRect.y / natH) * dispH;
                          const width = (selectionRect.width / natW) * dispW;
                          const height = (selectionRect.height / natH) * dispH;
                          return (
                            <div key={selectionRect.id}>
                              <div
                                className="absolute border-2 border-blue-500 border-dashed pointer-events-none"
                                style={{
                                  left: `${left}px`,
                                  top: `${top}px`,
                                  width: `${width}px`,
                                  height: `${height}px`,
                                }}
                              >
                                <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-md">
                                  Area {index + 1}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Polygon overlay on preview */}
                        {selectionPolygons.length > 0 && (() => {
                          const bcr = previewImgRef.current?.getBoundingClientRect();
                          const dispW = bcr?.width ?? ((canvasRef.current?.width ?? 0) * zoomLevel);
                          const dispH = bcr?.height ?? ((canvasRef.current?.height ?? 0) * zoomLevel);
                          const natW = naturalSize.width || 1;
                          const natH = naturalSize.height || 1;
                          return (
                            <svg className="absolute left-0 top-0 pointer-events-none" width={dispW} height={dispH} viewBox={`0 0 ${dispW} ${dispH}`}>
                              {selectionPolygons.map((poly) => {
                                const pts = poly.points.map(p => `${(p.x / natW) * dispW},${(p.y / natH) * dispH}`).join(' ');
                                return (
                                  <polyline key={poly.id} points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4" />
                                );
                              })}
                            </svg>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 rounded border flex items-center justify-center mx-auto">
                      <span className="text-xs text-gray-500">
                        {isGeneratingPreview ? 'Generating...' : 'No preview'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Canvas for processing (hidden) */}
            <canvas ref={canvasRef} className="hidden" />

            <p className="text-center text-sm text-gray-600 mt-2">
              {originalImage.originalFile.name}
            </p>
          </div>

          <div className="space-y-6">
            {/* Color Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Color */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Target Color (Color to Change)
              </label>
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: targetColor }}
                />
                <input
                  type="color"
                  value={targetColor}
                  onChange={(e) => setTargetColor(e.target.value)}
                  className="h-12 w-16 rounded border border-gray-300 cursor-pointer"
                />
                <div className="text-sm text-gray-600">
                  <div>Hex: {targetColor.toUpperCase()}</div>
                  <div className="text-xs text-gray-500">Click to pick color</div>
                </div>
              </div>

                {/* Quick Select Colors */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 mr-2">Quick select:</span>
                  {[
                    { name: 'Black', color: '#000000' },
                    { name: 'White', color: '#ffffff' },
                    { name: 'Gray', color: '#808080' },
                    { name: 'Red', color: '#ff0000' },
                    { name: 'Green', color: '#00ff00' },
                    { name: 'Blue', color: '#0000ff' }
                  ].map(({ name, color }) => (
                    <button
                      key={color}
                      onClick={() => setTargetColor(color)}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        targetColor === color
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Select ${name}`}
                    />
                  ))}
                </div>

                <p className="text-xs text-gray-600">
                  Select the color in your image that you want to change (e.g., black text)
                </p>
              </div>

              {/* Replacement Color */
              }
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Replacement Color (New Color)
                </label>
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 overflow-hidden"
                    style={
                      replaceWithTransparent
                        ? {
                            backgroundImage:
                              'linear-gradient(45deg, #e5e7eb 25%, transparent 25%),\n                              linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),\n                              linear-gradient(45deg, transparent 75%, #e5e7eb 75%),\n                              linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                          }
                        : { backgroundColor: replacementColor }
                    }
                    title={replaceWithTransparent ? 'Transparent' : undefined}
                  />
                  <input
                    type="color"
                    value={replacementColor}
                    onChange={(e) => {
                      if (replaceWithTransparent) setReplaceWithTransparent(false);
                      setReplacementColor(e.target.value);
                    }}
                    className="h-12 w-16 rounded border border-gray-300 cursor-pointer disabled:opacity-50"
                    disabled={replaceWithTransparent}
                  />
                  <div className="text-sm text-gray-600">
                    <div>
                      {replaceWithTransparent ? 'Transparent' : `Hex: ${replacementColor.toUpperCase()}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {replaceWithTransparent ? 'Selected pixels will be erased' : 'Click to pick color'}
                    </div>
                  </div>
                </div>

                {/* Quick Select Colors */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 mr-2">Quick select:</span>
                  {/* Transparent swatch */}
                  <button
                    onClick={() => setReplaceWithTransparent(true)}
                    className={`w-8 h-8 rounded border-2 transition-all flex items-center justify-center text-[10px] font-medium ${
                      replaceWithTransparent
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #e5e7eb 25%, transparent 25%),\n                        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),\n                        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),\n                        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                    title="Transparent"
                  >
                    T
                  </button>
                  {[
                    { name: 'White', color: '#ffffff' },
                    { name: 'Black', color: '#000000' },
                    { name: 'Gray', color: '#808080' },
                    { name: 'Red', color: '#ff0000' },
                    { name: 'Green', color: '#00ff00' },
                    { name: 'Blue', color: '#0000ff' }
                  ].map(({ name, color }) => (
                    <button
                      key={color}
                      onClick={() => {
                        if (replaceWithTransparent) setReplaceWithTransparent(false);
                        setReplacementColor(color);
                      }}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        !replaceWithTransparent && replacementColor === color
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Select ${name}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="replace-with-transparent"
                    checked={replaceWithTransparent}
                    onCheckedChange={(checked) => setReplaceWithTransparent(!!checked)}
                  />
                  <label htmlFor="replace-with-transparent" className="text-xs text-gray-700">
                    Replace with transparency (delete color)
                  </label>
                </div>

                <p className="text-xs text-gray-600">
                  {replaceWithTransparent
                    ? 'Selected pixels become fully transparent.'
                    : 'Select the new color to replace the target color with (e.g., white text)'}
                </p>
              </div>
            </div>

            {/* Full Color Replacement Toggle */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="full-color-replacement"
                      checked={fullColorReplacement}
                      onCheckedChange={(checked) => setFullColorReplacement(checked as boolean)}
                    />
                    <label htmlFor="full-color-replacement" className="text-sm font-medium">
                      Full Color Replacement
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fullColorReplacement
                      ? "Replace ALL pixels in selected areas with the replacement color, regardless of their original color."
                      : "Replace only pixels that match the target color within the specified tolerance."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tolerance Slider */}
            {!fullColorReplacement && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Color Tolerance
                      </label>
                      <Badge variant="outline">{tolerance}</Badge>
                    </div>
                    <Slider
                      value={[tolerance]}
                      onValueChange={(value) => setTolerance(value[0])}
                      max={100}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Exact Match</span>
                      <span>High Tolerance</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Higher tolerance will match colors that are similar to your target color.
                      Lower tolerance only matches exact color matches.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview Info */}
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">How it works:</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• <strong>Live Preview:</strong> See changes instantly as you adjust colors and tolerance</li>
                      <li>• The system finds all pixels matching the target color (within tolerance range)</li>
                      <li>• Those pixels get replaced with your replacement color</li>
                      <li>• Other colors in the image stay unchanged</li>
                      <li>• Perfect for changing text colors or specific elements in transparent images</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                onClick={handleClose}
                variant="outline"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                className="bg-pink-600 hover:bg-pink-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Palette className="h-4 w-4 mr-2" />
                    Change Color
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

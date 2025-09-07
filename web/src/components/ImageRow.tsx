'use client';

import { useState, useEffect, useRef } from 'react';
import { WorkflowImage } from '@/lib/types';
import ImagePreviewModal from './ImagePreviewModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Wand2,
  Edit,
  Scissors,
  ZoomIn,
  Scale as ScaleIcon,
  Palette,
  Download,
  Trash2,
  Copy,
  Clipboard,
  Check,
  RotateCcw,
  Clock,
  Cog,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Contrast,
  GitMerge
} from 'lucide-react';








interface ImageRowProps {
  image: WorkflowImage;
  isSelected: boolean;
  onSelect: (imageId: string) => void;
  onProcess: (imageId: string, operation: string) => void;
  onUndo?: (imageId: string) => void;
  onRevert?: (imageId: string) => void;
  onFullProcess?: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onMetadataChange: (imageId: string, field: string, value: string) => void;
  onBroadcastMetadata?: (field: 'brand' | 'keywords', value: string, scope: 'all' | 'selected') => void;
}

export default function ImageRow({
  image,
  isSelected,
  onSelect,
  onProcess,
  onUndo,
  onRevert,
  onFullProcess,
  onDelete,
  onMetadataChange,
  onBroadcastMetadata,
}: ImageRowProps) {
  const [showProcessed, setShowProcessed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [selectedBgColor, setSelectedBgColor] = useState<string>('transparent');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [processedDimensions, setProcessedDimensions] = useState<{width: number, height: number} | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const hasAutoSwitchedRef = useRef(false);
  const [brandPasteOpen, setBrandPasteOpen] = useState(false);
  const [keywordsPasteOpen, setKeywordsPasteOpen] = useState(false);

  // Reset auto-switch state when image changes
  useEffect(() => {
    hasAutoSwitchedRef.current = false;
    setShowProcessed(false);
  }, [image.id]);

  // Calculate original image dimensions
  useEffect(() => {
    if (image.originalFile) {
      const url = URL.createObjectURL(image.originalFile);
      setOriginalUrl(url);
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = url;
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setOriginalUrl("");
      setImageDimensions(null);
    }
  }, [image.originalFile]);

  // Calculate processed image dimensions when available/updated
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!image.processedUrl) { setProcessedDimensions(null); return; }
        const i = new Image();
        await new Promise<void>((resolve, reject) => {
          i.onload = () => resolve();
          i.onerror = () => reject(new Error('failed to load processed image'));
          i.src = image.processedUrl!;
        });
        if (!cancelled) setProcessedDimensions({ width: i.naturalWidth, height: i.naturalHeight });
      } catch {
        if (!cancelled) setProcessedDimensions(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [image.processedUrl]);







  // Clear copied state after delay
  useEffect(() => {
    if (copiedField) {
      const timer = setTimeout(() => setCopiedField(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedField]);

  // Handle color picker modal
  const handleOpenColorPicker = () => {
    setShowColorPickerModal(true);
  };

  const handleCloseColorPicker = () => {
    setShowColorPickerModal(false);
  };

  const handleAddColor = () => {
    setCustomColors(prev => [...prev, selectedColor]);
    setShowColorPickerModal(false);
  };

  const handleCopy = async (field: string, value: string) => {
    if (value.trim()) {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    }
  };

  const handlePasteMenu = async (
    field: 'brand' | 'keywords',
    scope: 'single' | 'all' | 'selected'
  ) => {
    try {
      const text = await navigator.clipboard.readText();
      if (scope === 'single') {
        onMetadataChange(image.id, field, text);
      } else {
        onBroadcastMetadata?.(field, text, scope === 'all' ? 'all' : 'selected');
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    } finally {
      setBrandPasteOpen(false);
      setKeywordsPasteOpen(false);
    }
  };

  // Automatically show processed image when it becomes available for the first time
  useEffect(() => {
    if (image.processedUrl && image.thumbnailUrl && !showProcessed && !hasAutoSwitchedRef.current) {
      setShowProcessed(true);
      hasAutoSwitchedRef.current = true;
    }
  }, [image.processedUrl, image.thumbnailUrl, showProcessed]);



  const getStatusIcon = (status: WorkflowImage['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'processing':
        return <Cog className="h-3 w-3 animate-spin" />;
      case 'done':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'error':
        return <XCircle className="h-3 w-3" />;
      default:
        return <HelpCircle className="h-3 w-3" />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start space-x-4">
        {/* Checkbox */}
        <div className="mt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(image.id)}
            className="h-4 w-4"
          />
        </div>

        {/* Image Display */}
        <div className="flex-shrink-0">
          <div className="relative">
            {(image.thumbnailUrl || image.processedUrl) && (
              <div
                className="relative cursor-pointer group overflow-hidden w-24 h-24 rounded"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => setIsModalOpen(true)}
                style={{
                  backgroundColor: selectedBgColor === 'transparent' ? 'transparent' : selectedBgColor,
                  backgroundImage: selectedBgColor === 'transparent'
                    ? `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`
                    : 'none',
                  backgroundSize: selectedBgColor === 'transparent' ? '8px 8px' : 'auto',
                  backgroundPosition: selectedBgColor === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : 'auto',
                }}
              >
                <img // eslint-disable-line @next/next/no-img-element
                  src={
                    showProcessed && image.processedUrl
                      ? image.processedUrl
                      : image.thumbnailUrl || originalUrl || ''
                  }
                  alt={image.originalFile.name}
                  className="w-full h-full object-contain object-center rounded border border-gray-300 transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                />
                {isHovered && (
                  <div className="absolute inset-0 rounded flex items-center justify-center bg-gray-100/80 backdrop-blur-[2px]">
                    <div className="text-gray-800 text-xs font-medium">
                      <div>Click to preview</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!image.thumbnailUrl && !image.processedUrl && (
              <div className="w-24 h-24 bg-gray-200 rounded border flex items-center justify-center">
                <span className="text-xs text-gray-500">No image</span>
              </div>
            )}

            {/* Image Dimensions */}
            <div className="mt-1 text-xs text-gray-500 text-center min-h-4">
              {(() => {
                const dims = (showProcessed && processedDimensions) ? processedDimensions : imageDimensions;
                if (!dims) return null;
                return (<span>{dims.width}×{dims.height}</span>);
              })()}
            </div>

            {/* Status Badge */}
            <div className="absolute -top-1 -right-1">
              <Badge
                variant={
                  image.status === 'error' ? 'destructive' :
                  image.status === 'done' ? 'default' :
                  image.status === 'processing' ? 'secondary' :
                  'outline'
                }
                className="h-7 w-7 p-0 flex items-center justify-center border-2 border-background shadow-sm"
                title={`${image.status.charAt(0).toUpperCase() + image.status.slice(1)} - ${image.status === 'pending' ? 'Waiting to process' : image.status === 'processing' ? 'Currently processing' : image.status === 'done' ? 'Successfully processed' : image.status === 'error' ? 'Processing failed' : 'Unknown status'}`}
              >
                {getStatusIcon(image.status)}
              </Badge>
            </div>
          </div>

                      {/* Image Toggle and Background Control */}
            <div className="mt-2 flex flex-col space-y-2">
              {image.processedUrl && image.thumbnailUrl && (
                <div className="flex space-x-1">
                  <Button
                    onClick={() => setShowProcessed(false)}
                    variant={!showProcessed ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                  >
                    Original
                  </Button>
                  <Button
                    onClick={() => setShowProcessed(true)}
                    variant={showProcessed ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                  >
                    Processed
                  </Button>
                </div>
              )}

            {/* Color Background Options */}
            <div className="flex justify-center space-x-1">
              {/* Transparent */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBgColor('transparent');
                }}
                className={`w-6 h-6 rounded border-2 transition-all relative ${
                  selectedBgColor === 'transparent'
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ background: 'transparent' }}
                title="Transparent background"
              >
                {/* Diagonal red lines to indicate transparency */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-0.5 bg-red-500 rotate-45 opacity-70"></div>
                  <div className="w-4 h-0.5 bg-red-500 -rotate-45 opacity-70 absolute"></div>
                </div>
              </button>

              {/* Black */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBgColor('#000000');
                }}
                className={`w-6 h-6 rounded border-2 transition-all ${
                  selectedBgColor === '#000000'
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ background: '#000000' }}
                title="Black background"
              />

              {/* White */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBgColor('#ffffff');
                }}
                className={`w-6 h-6 rounded border-2 transition-all ${
                  selectedBgColor === '#ffffff'
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ background: '#ffffff' }}
                title="White background"
              />

              {/* Custom Colors */}
              {customColors.map((color, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBgColor(color);
                  }}
                  className={`w-6 h-6 rounded border-2 transition-all ${
                    selectedBgColor === color
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ background: color }}
                  title={`Custom color ${index + 1}`}
                />
              ))}

              {/* Add Color Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenColorPicker();
                }}
                className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center text-gray-600 hover:text-gray-800"
                title="Add custom color"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Fields */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1 relative">
              <label className="block text-sm font-medium text-gray-700">
                Brand
              </label>
              <div className="flex gap-1">
                <Button
                  onClick={() => handleCopy('brand', image.metadata.brand)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Copy brand"
                >
                  {copiedField === 'brand' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <div className="relative">
                  <Button
                    onClick={() => setBrandPasteOpen((v) => !v)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="Paste options"
                  >
                    <Clipboard className="h-3 w-3" />
                  </Button>
                  {brandPasteOpen && (
                    <div
                      className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded shadow z-20"
                      onMouseLeave={() => setBrandPasteOpen(false)}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('brand', 'single')}
                      >
                        Paste
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('brand', 'selected')}
                      >
                        Paste to Selected
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('brand', 'all')}
                      >
                        Paste to All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Input
              type="text"
              value={image.metadata.brand}
              onChange={(e) => onMetadataChange(image.id, 'brand', e.target.value)}
              placeholder="Enter brand name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 relative">
              <label className="block text-sm font-medium text-gray-700">
                Keywords
              </label>
              <div className="flex gap-1">
                <Button
                  onClick={() => handleCopy('keywords', image.metadata.keywords || '')}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Copy keywords"
                >
                  {copiedField === 'keywords' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <div className="relative">
                  <Button
                    onClick={() => setKeywordsPasteOpen((v) => !v)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="Paste options"
                  >
                    <Clipboard className="h-3 w-3" />
                  </Button>
                  {keywordsPasteOpen && (
                    <div
                      className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded shadow z-20"
                      onMouseLeave={() => setKeywordsPasteOpen(false)}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('keywords', 'single')}
                      >
                        Paste
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('keywords', 'selected')}
                      >
                        Paste to Selected
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => handlePasteMenu('keywords', 'all')}
                      >
                        Paste to All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Input
              type="text"
              value={image.metadata.keywords || ''}
              onChange={(e) => onMetadataChange(image.id, 'keywords', e.target.value)}
              placeholder="Enter keywords (optional)"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Title <span className="text-xs text-gray-500 font-normal">(optional - manually specify design text)</span>
              </label>
              <div className="flex gap-1">
                <Button
                  onClick={() => handleCopy('title', image.metadata.title || '')}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Copy title"
                >
                  {copiedField === 'title' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const camelCaseText = text
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                      onMetadataChange(image.id, 'title', camelCaseText);
                    } catch (err) {
                      console.error('Failed to paste:', err);
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Paste title"
                >
                  <Clipboard className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="text"
                value={image.metadata.title || ''}
                onChange={(e) => {
                  const camelCaseValue = e.target.value
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                  onMetadataChange(image.id, 'title', camelCaseValue);
                }}
                className={`pr-12 ${
                  image.metadata.title
                    ? ''
                    : 'border-primary/50 bg-primary/5'
                }`}
                placeholder="Enter design text from t-shirt or leave empty for AI to read image"
                maxLength={60}
              />
              <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-medium ${
                (image.metadata.title?.length || 0) > 50
                  ? (image.metadata.title?.length || 0) > 60
                    ? 'text-destructive'
                    : 'text-yellow-600'
                  : 'text-muted-foreground'
              }`}>
                {(image.metadata.title?.length || 0)}/60
              </div>
            </div>
            {!image.metadata.title && (
              <p className="text-xs text-blue-600 mt-1">
                💡 Leave empty and AI will read the design text from your image
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bullet 1
            </label>
            <div className="relative">
              <Textarea
                value={image.metadata.bullet1 || ''}
                onChange={(e) => onMetadataChange(image.id, 'bullet1', e.target.value)}
                rows={2}
                className="resize-none min-h-[60px]"
                placeholder="Enter bullet point 1"
                maxLength={250}
              />
              <div className={`absolute right-2 bottom-2 text-xs font-medium ${
                (image.metadata.bullet1 || '').length > 200
                  ? (image.metadata.bullet1 || '').length > 250
                    ? 'text-destructive'
                    : 'text-yellow-600'
                  : 'text-muted-foreground'
              }`}>
                {(image.metadata.bullet1 || '').length}/250
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bullet 2
            </label>
            <div className="relative">
              <Textarea
                value={image.metadata.bullet2 || ''}
                onChange={(e) => onMetadataChange(image.id, 'bullet2', e.target.value)}
                rows={2}
                className="resize-none min-h-[60px]"
                placeholder="Enter bullet point 2"
                maxLength={250}
              />
              <div className={`absolute right-2 bottom-2 text-xs font-medium ${
                (image.metadata.bullet2 || '').length > 200
                  ? (image.metadata.bullet2 || '').length > 250
                    ? 'text-destructive'
                    : 'text-yellow-600'
                  : 'text-muted-foreground'
              }`}>
                {(image.metadata.bullet2 || '').length}/250
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <div className="relative">
              <Textarea
                value={image.metadata.description || ''}
                onChange={(e) => onMetadataChange(image.id, 'description', e.target.value)}
                rows={3}
                placeholder="Enter product description"
                maxLength={512}
              />
              <div className={`absolute right-2 bottom-2 text-xs font-medium ${
                (image.metadata.description || '').length > 400
                  ? (image.metadata.description || '').length > 512
                    ? 'text-destructive'
                    : 'text-yellow-600'
                  : 'text-muted-foreground'
              }`}>
                {(image.metadata.description || '').length}/512
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0">
          <div className="flex flex-col space-y-2">
            <Button
              onClick={() => onProcess(image.id, 'generate')}
              disabled={image.status === 'processing'}
              className="w-full"
              size="sm"
            >
              {image.status === 'processing' ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'edit-ai')}
              disabled={image.status === 'processing'}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit AI
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'remove-bg')}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Scissors className="h-4 w-4 mr-2" />
              Remove BG
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'upscale')}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <ZoomIn className="h-4 w-4 mr-2" />
              Upscale
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'scale')}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <ScaleIcon className="h-4 w-4 mr-2" />
              Scale
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'color-change')}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Palette className="h-4 w-4 mr-2" />
              Change Color
            </Button>

            <Button
              onClick={() => onProcess(image.id, 'invert')}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Contrast className="h-4 w-4 mr-2" />
              Quick Invert
            </Button>

            <Button
              onClick={() => onFullProcess?.(image.id)}
              disabled={image.status === 'processing'}
              variant="outline"
              className="w-full"
              size="sm"
              title="Full process: Upscale → Remove BG → Scale"
            >
              <GitMerge className="h-4 w-4 mr-2" />
              Full Process
            </Button>

            {image.processedUrl && (
              <Button
                onClick={() => {
                  if (!image.processedUrl) return;
                  const link = document.createElement('a');
                  link.href = image.processedUrl;
                  const originalName = image.originalFile.name.replace(/\.[^/.]+$/, '');
                  const extension = image.processedUrl.includes('png') ? 'png' : 'webp';
                  link.download = `${originalName}_processed.${extension}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="w-full"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}

            {(image.history && image.history.length > 0) && (
              <Button
                onClick={() => onUndo?.(image.id)}
                variant="outline"
                className="w-full"
                size="sm"
                title="Undo last processing step"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Undo Last
              </Button>
            )}

            {(image.history && image.history.length > 0) && (
              <Button
                onClick={() => onRevert?.(image.id)}
                variant="secondary"
                className="w-full"
                size="sm"
                title="Revert to original image"
              >
                Revert to Original
              </Button>
            )}

            <Button
              onClick={() => onDelete(image.id)}
              variant="destructive"
              className="w-full"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {image.error && (
        <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded text-destructive text-sm">
          {image.error}
        </div>
      )}

      {/* Processing Steps Indicator */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          image.processingSteps.generated && 'Generated',
          image.processingSteps.aiEdited && 'AI Edited',
          image.processingSteps.backgroundRemoved && 'Background Removed',
          image.processingSteps.upscaled && 'Upscaled',
          image.processingSteps.scaled && 'Scaled',
          image.processingSteps.colorChanged && 'Color Changed',
          image.processingSteps.inverted && 'Inverted'
        ].filter((step): step is string => Boolean(step)).map((step) => (
          <Badge key={step} variant="secondary" className="text-xs">
            {step}
          </Badge>
        ))}
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        image={image}
        showProcessed={showProcessed}

        selectedBgColor={selectedBgColor}
        onBgColorChange={setSelectedBgColor}

      />

      {/* Color Picker Modal */}
      {showColorPickerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseColorPicker}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Choose Custom Color</h3>
              <button
                onClick={handleCloseColorPicker}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Color Preview */}
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: selectedColor }}
                />
                <div>
                  <div className="text-sm text-gray-600">Selected Color</div>
                  <div className="text-xs text-gray-500 font-mono">{selectedColor.toUpperCase()}</div>
                </div>
              </div>

              {/* Color Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pick a color:
                </label>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full h-12 rounded border border-gray-300 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleCloseColorPicker}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddColor}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Color
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

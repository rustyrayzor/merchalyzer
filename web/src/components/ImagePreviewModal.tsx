'use client';

import { useState, useEffect } from 'react';
import { WorkflowImage } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

import { X, Eye, Palette } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: WorkflowImage;
  showProcessed: boolean;
  selectedBgColor: string;
  onBgColorChange: (color: string) => void;
}

const ImagePreviewModal = ({
  isOpen,
  onClose,
  image,
  showProcessed,
  selectedBgColor,
  onBgColorChange
}: ImagePreviewModalProps) => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');

  // Create high-quality data URL from original file for modal preview
  useEffect(() => {
    if (isOpen && image.originalFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImageUrl(e.target?.result as string);
      };
      reader.readAsDataURL(image.originalFile);
    }
  }, [isOpen, image.originalFile]);



  const imageUrl = showProcessed && image.processedUrl
    ? image.processedUrl
    : originalImageUrl || image.thumbnailUrl || '';

  // Determine image type for display
  const getImageType = () => {
    if (!showProcessed || !image.processedUrl) {
      return 'Original';
    }

    // Check processing steps to determine the most recent/final processing type
    if (image.processingSteps.scaled) {
      return 'Scaled';
    }
    if (image.processingSteps.upscaled) {
      return 'Upscaled';
    }
    if (image.processingSteps.backgroundRemoved) {
      return 'Background Removed';
    }
    if (image.processingSteps.aiEdited) {
      return 'AI Edited';
    }
    if (image.processingSteps.generated) {
      return 'Generated';
    }

    return 'Processed';
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-none h-full overflow-y-auto" style={{ width: '90vw' }}>
        <SheetHeader className="flex flex-row items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Back
            </Button>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {getImageType()} Preview
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="px-4 pb-4">
          {imageUrl && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Main Image */}
              <div
                className="flex-1 relative overflow-hidden rounded"
                style={{
                  backgroundColor: selectedBgColor === 'transparent' ? 'transparent' : selectedBgColor,
                  backgroundImage: selectedBgColor === 'transparent'
                    ? `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`
                    : 'none',
                  backgroundSize: selectedBgColor === 'transparent' ? '12px 12px' : 'auto',
                  backgroundPosition: selectedBgColor === 'transparent' ? '0 0, 0 6px, 6px -6px, -6px 0px' : 'auto',
                }}
              >
                <img // eslint-disable-line @next/next/no-img-element
                  src={imageUrl}
                  alt={`${getImageType()} image preview`}
                  className="w-full h-full object-contain rounded border-0"
                  style={{
                    backgroundColor: 'transparent',
                    imageRendering: 'auto',
                  }}
                />
              </div>

              {/* Color Selection Options in Modal */}
              <div className="flex justify-center space-x-2 mt-3">
                {/* Transparent */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBgColorChange('transparent');
                  }}
                  variant={selectedBgColor === 'transparent' ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0 relative"
                  title="Transparent background"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-0.5 bg-red-500 rotate-45 opacity-70"></div>
                    <div className="w-4 h-0.5 bg-red-500 -rotate-45 opacity-70 absolute"></div>
                  </div>
                </Button>

                {/* Black */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBgColorChange('#000000');
                  }}
                  variant={selectedBgColor === '#000000' ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  style={{ background: '#000000' }}
                  title="Black background"
                />

                {/* White */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBgColorChange('#ffffff');
                  }}
                  variant={selectedBgColor === '#ffffff' ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  style={{ background: '#ffffff' }}
                  title="White background"
                />

                {/* Add Color Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Find and click the hidden color input
                    const colorInput = e.currentTarget.nextElementSibling as HTMLInputElement;
                    colorInput?.click();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-8 h-8 p-0"
                  title="Add custom color"
                >
                  <Palette className="h-4 w-4" />
                </Button>

                {/* Hidden color input */}
                <input
                  type="color"
                  className="hidden"
                  onInput={(e) => {
                    const newColor = (e.target as HTMLInputElement).value;
                    onBgColorChange(newColor);
                  }}
                />
              </div>
            </div>
          )}
          {!imageUrl && (
            <div className="w-96 h-96 bg-muted rounded flex items-center justify-center">
              <span className="text-muted-foreground">No image available</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImagePreviewModal;

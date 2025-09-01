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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wand2, X, CheckCircle } from 'lucide-react';

interface EditAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (imageUrl: string) => void;
  originalImage: WorkflowImage;
}

export default function EditAIModal({
  isOpen,
  onClose,
  onProceed,
  originalImage,
}: EditAIModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setIsProcessing(false);
      setEditedImageUrl(null);
      setError(null);
    }
  }, [isOpen]);

  // Use a high‑quality object URL for the original image preview
  useEffect(() => {
    if (!isOpen) return;
    let revoke: string | null = null;
    try {
      if (originalImage?.originalFile) {
        const url = URL.createObjectURL(originalImage.originalFile);
        revoke = url;
        setOriginalPreviewUrl(url);
      } else if (originalImage?.processedUrl) {
        setOriginalPreviewUrl(originalImage.processedUrl);
      } else if (originalImage?.thumbnailUrl) {
        setOriginalPreviewUrl(originalImage.thumbnailUrl);
      }
    } catch {}
    return () => {
      try { if (revoke) URL.revokeObjectURL(revoke); } catch {}
    };
  }, [isOpen, originalImage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', originalImage.originalFile);
      formData.append('prompt', prompt.trim());

      const response = await fetch('/api/workflow/edit-ai', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setEditedImageUrl(data.imageUrl);
      } else {
        throw new Error('No image generated');
      }
    } catch (err) {
      console.error('Error editing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to edit image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceed = () => {
    if (editedImageUrl) {
      onProceed(editedImageUrl);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleCancel}>
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
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Back
            </Button>
            <SheetTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Edit Image with AI
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Original Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Original Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border border-border rounded-lg overflow-auto"
                  style={{
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
                  {originalPreviewUrl ? (
                    <img // eslint-disable-line @next/next/no-img-element
                      src={originalPreviewUrl}
                      alt="Original"
                      className="w-full max-h-[75vh] object-contain"
                      style={{ imageRendering: 'auto', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
                    />
                  ) : (
                    <div className="w-full h-[300px] bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">No image available</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edited Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Edited Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border border-border rounded-lg overflow-auto"
                  style={{
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
                  {editedImageUrl ? (
                    <img // eslint-disable-line @next/next/no-img-element
                      src={editedImageUrl}
                      alt="Edited"
                      className="w-full max-h-[75vh] object-contain"
                      style={{ imageRendering: 'auto', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
                    />
                  ) : (
                    <div className="w-full h-[300px] bg-muted flex items-center justify-center">
                      {isProcessing ? (
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <span className="text-muted-foreground">Processing...</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Edited image will appear here</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prompt Input */}
          {!editedImageUrl && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  Describe the Edit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Remove background, change colors, add effects..."
                      rows={4}
                      disabled={isProcessing}
                      className="resize-none"
                    />
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={isProcessing || !prompt.trim()}
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate Edited Image
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCancel}
                      variant="outline"
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {editedImageUrl && (
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleCancel}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Use This Image
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

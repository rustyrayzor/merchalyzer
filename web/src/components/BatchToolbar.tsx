'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Download, CheckSquare, Square, Wand2, Edit, Scale, Scissors, ZoomIn, Contrast } from "lucide-react";

interface BatchToolbarProps {
  selectedCount: number;
  totalCount: number;
  onBatchProcess: (operation: string) => void;
  onDownloadCsv: () => void;
  onToggleSelectAll: () => void;
}

export default function BatchToolbar({
  selectedCount,
  totalCount,
  onBatchProcess,
  onDownloadCsv,
  onToggleSelectAll,
}: BatchToolbarProps) {
  const [processingOperation, setProcessingOperation] = useState<string | null>(null);

  const handleBatchProcess = async (operation: string) => {
    if (selectedCount === 0) return;

    setProcessingOperation(operation);
    try {
      await onBatchProcess(operation);
    } finally {
      setProcessingOperation(null);
    }
  };

  const operations = [
    { key: 'generate', label: 'Generate All', icon: Wand2, variant: 'default' as const },
    { key: 'edit-ai', label: 'Edit AI All', icon: Edit, variant: 'secondary' as const },
    { key: 'scale', label: 'Scale All', icon: Scale, variant: 'outline' as const },
    { key: 'remove-bg', label: 'Remove BG All', icon: Scissors, variant: 'outline' as const },
    { key: 'upscale', label: 'Upscale All', icon: ZoomIn, variant: 'outline' as const },
    { key: 'invert', label: 'Quick Invert All', icon: Contrast, variant: 'outline' as const },
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Selection Info */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">
              {selectedCount} of {totalCount} images selected
            </span>
            {selectedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({Math.round((selectedCount / totalCount) * 100)}% of total)
              </span>
            )}
            {totalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleSelectAll}
                className="h-7 px-2 text-xs"
              >
                {selectedCount === totalCount ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Batch Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownloadCsv}
              disabled={totalCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download ZIP
            </Button>
            {operations.map((op) => {
              const Icon = op.icon;
              return (
                <Button
                  key={op.key}
                  variant={op.variant}
                  size="sm"
                  onClick={() => handleBatchProcess(op.key)}
                  disabled={selectedCount === 0 || processingOperation === op.key}
                >
                  {processingOperation === op.key ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Icon className="h-4 w-4 mr-2" />
                      {op.label}
                    </>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Progress Info */}
        {processingOperation && selectedCount > 1 && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-md">
            <div className="flex items-center space-x-2 text-primary text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Processing {selectedCount} images with {processingOperation.replace('-', ' ')}...
                This may take a few minutes.
              </span>
            </div>
          </div>
        )}

        {/* No Selection Warning */}
        {selectedCount === 0 && (
          <div className="mt-4 p-3 bg-muted border border-border rounded-md text-sm text-muted-foreground">
            Select one or more images to enable batch processing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

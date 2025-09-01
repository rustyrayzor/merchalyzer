"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileImage } from "lucide-react";

interface UploaderProps {
  onFiles: (files: File[]) => void;
}

export default function Uploader({ onFiles }: UploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).filter((f) =>
        ["image/jpeg", "image/png"].includes(f.type)
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <Card className={`transition-all duration-200 ${isDragging ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className="text-center space-y-4"
        >
          <div className="flex justify-center">
            <div className={`p-4 rounded-full ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
              <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium">Upload Images</h3>
            <p className="text-sm text-muted-foreground">
              Drag & drop JPG/PNG files here, or click to browse
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileImage className="h-4 w-4" />
            <span>Supports JPG and PNG files</span>
          </div>

          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="hidden"
            id="file-upload"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label htmlFor="file-upload">
            <Button variant="outline" className="cursor-pointer" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}



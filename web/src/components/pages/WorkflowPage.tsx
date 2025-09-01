import { useEffect, useState } from 'react';
import ImageManager from '@/components/ImageManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function WorkflowPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className={cn(
      "space-y-6 transition-all duration-500 ease-out",
      isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
    )}>
      <Card className={cn(
        "transition-all duration-500 ease-out delay-100",
        isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
      )}>
        <CardHeader>
          <CardTitle className="text-xl">
            Amazon Merch Workflow
          </CardTitle>
          <p className="text-muted-foreground">
            Upload and process your product images for Amazon merchandise listings.
            Generate, edit with AI, remove backgrounds, upscale, then scale to Amazon dimensions.
          </p>
        </CardHeader>
        <CardContent className={cn(
          "transition-all duration-500 ease-out delay-200",
          isVisible ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
        )}>
          <ImageManager />
        </CardContent>
      </Card>
    </main>
  );
}

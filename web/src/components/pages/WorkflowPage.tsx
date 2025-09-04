import { useEffect, useState } from 'react';
import ImageManager from '@/components/ImageManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import InputsPanel from '@/components/InputsPanel';
import { Cog } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkflowPage() {
  const [isVisible, setIsVisible] = useState(false);
  // Local state for settings panel (model only for now)
  const [model, setModel] = useState('');
  const [instructions, setInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [keywords, setKeywords] = useState('');

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
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">Amazon Merch Workflow</CardTitle>
              <p className="text-muted-foreground">
                Upload and process your product images for Amazon merchandise listings.
                Generate, edit with AI, remove backgrounds, upscale, then scale to Amazon dimensions.
              </p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Workflow settings" className="shrink-0">
                  <Cog className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Workflow Settings</SheetTitle>
                  <SheetDescription>Choose your AI model and defaults.</SheetDescription>
                </SheetHeader>
                <div className="p-4 pt-0">
                  <InputsPanel
                    model={model}
                    instructions={instructions}
                    brand={brand}
                    keywords={keywords}
                    onChange={(next) => {
                      if (next.model !== undefined) setModel(next.model);
                      if (next.instructions !== undefined) setInstructions(next.instructions);
                      if (next.brand !== undefined) setBrand(next.brand);
                      if (next.keywords !== undefined) setKeywords(next.keywords);
                    }}
                    showModelSection={true}
                    showInstructionsSection={false}
                    showBrandKeywords={false}
                    showInstructionTemplates={false}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
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

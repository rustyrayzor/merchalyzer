'use client';

import ImageManager from '@/components/ImageManager';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Workflow, Cog } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadBgRemovalProvider, saveBgRemovalProvider, type BgRemovalProvider } from '@/lib/storage';
import InputsPanel from '@/components/InputsPanel';
import { useEffect, useState } from 'react';

export default function WorkflowPage() {
  const [model, setModel] = useState('');
  const [instructions, setInstructions] = useState('');
  const [brand, setBrand] = useState('');
  const [keywords, setKeywords] = useState('');
  const [bgProvider, setBgProvider] = useState<BgRemovalProvider>('pixelcut');

  // Initialize background removal provider from storage
  useEffect(() => {
    try {
      const stored = loadBgRemovalProvider();
      setBgProvider(stored || 'pixelcut');
    } catch {}
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Workflow</h1>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside className="md:sticky md:top-4 h-fit">
          <div className="space-y-2">
            <Link href="/">
              <Button variant="ghost" className="w-full justify-start">
                <Workflow className="h-4 w-4 mr-2" />
                Workflow
              </Button>
            </Link>
            <Link href="/edit">
              <Button variant="ghost" className="w-full justify-start">
                <Edit className="h-4 w-4 mr-2" />
                Image Edit
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" className="w-full justify-start">
                <Cog className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </aside>
        <main className="space-y-6">
          <Card>
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
                      <div className="mt-4 space-y-2">
                        <span className="text-sm text-gray-600">Background removal</span>
                        <Select
                          value={bgProvider}
                          onValueChange={(v: BgRemovalProvider) => {
                            setBgProvider(v);
                            saveBgRemovalProvider(v);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose remover" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pixelcut">Pixel Cut (default)</SelectItem>
                            <SelectItem value="rembg">rembg.js</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Pixel Cut requires PIXELCUT_API_KEY in your environment.</p>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </CardHeader>
            <CardContent>
              <ImageManager />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

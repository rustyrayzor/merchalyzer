'use client';

import ImageManager from '@/components/ImageManager';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Settings, Workflow, Cog } from 'lucide-react';

export default function WorkflowPage() {
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
            <Link href="/model">
              <Button variant="ghost" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Model
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
              <CardTitle className="text-xl">
                Amazon Merch Workflow
              </CardTitle>
              <p className="text-muted-foreground">
                Upload and process your product images for Amazon merchandise listings.
                Generate, edit with AI, remove backgrounds, upscale, then scale to Amazon dimensions.
              </p>
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

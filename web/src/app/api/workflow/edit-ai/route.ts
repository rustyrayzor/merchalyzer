import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouterForImages } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const prompt = formData.get('prompt') as string;
    const model = formData.get('model') as string || 'google/gemini-2.5-flash-image-preview:free'; // Default vision model for image editing

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    // Convert file to base64 for OpenRouter
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;

    // System prompt for image editing
    const systemPrompt = `You are an image editing assistant. Perform the requested edit on the provided image. Reply with an assistant message that includes images containing the edited image as a base64 data URL. Do not include unrelated content.`;

    // Create user content with image and prompt
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: `Edit the attached image. Edit Instruction: ${prompt}` },
      { type: 'image_url', image_url: { url: base64Image } },
    ];

    // Call OpenRouter to generate edited image
    const referer = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const imageUrls = await callOpenRouterForImages(
      model,
      systemPrompt,
      userContent,
      referer
    );

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Return the first generated image URL
    return NextResponse.json({
      success: true,
      imageUrl: imageUrls[0]
    }, {
      headers: {
        'X-Model-Used': model,
        'X-User-Prompt-Preview': prompt
      }
    });

  } catch (error) {
    console.error('Error editing image with AI:', error);
    return NextResponse.json(
      { error: 'Failed to edit image with AI' },
      { status: 500 }
    );
  }
}

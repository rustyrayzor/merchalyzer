import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import mime from 'mime-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'processed', 'workflow', 'invert', filename);
    try { await fs.access(filePath); } catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }); }
    const buf = await fs.readFile(filePath);
    const type = mime.lookup(filename) || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': type, 'Content-Length': buf.length.toString(), 'Cache-Control': 'public, max-age=31536000' } });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}


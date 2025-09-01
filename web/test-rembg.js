// Test script for rembg.js integration
import { rembg } from '@remove-background-ai/rembg.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.REM_BG_API_KEY || process.env.REMBG_API_KEY;

console.log('🔧 Testing rembg.js integration...');
console.log('API Key configured:', API_KEY ? '✅ Yes' : '❌ No');

if (!API_KEY) {
  console.error('❌ No API key found. Please set REM_BG_API_KEY or REMBG_API_KEY in .env.local');
  process.exit(1);
}

// Create a simple test image (1x1 pixel PNG)
const testImageBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0x60, 0x00, 0x00, 0x00,
  0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

try {
  console.log('🚀 Testing rembg.js with API key...');

  const result = await rembg({
    apiKey: API_KEY,
    inputImage: testImageBuffer,
    onDownloadProgress: (event) => {
      console.log('📥 Download progress:', Math.round(event.progress * 100) + '%');
    },
    onUploadProgress: (event) => {
      console.log('📤 Upload progress:', Math.round(event.progress * 100) + '%');
    }
  });

  console.log('✅🎉 Test successful!');
  console.log('Output path:', result.outputImagePath);

  // Clean up
  await result.cleanup();
  console.log('🧹 Cleanup completed');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', error.response.data);
  }
}

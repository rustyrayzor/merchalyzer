import { NextResponse } from 'next/server';
import { createPrintifyClient } from '@/lib/printify';
import { PrintifyStore } from '@/lib/types';

/**
 * GET /api/printify/stores
 * Fetches all Printify stores for the authenticated user
 */
export async function GET() {
  try {
    // Create Printify client
    const printifyClient = createPrintifyClient();

    // Fetch stores
    const stores: PrintifyStore[] = await printifyClient.getStores();

    // Ensure stores is an array
    if (!stores || !Array.isArray(stores)) {
      console.error('Printify stores response is not an array:', stores);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response from Printify API',
          details: 'Stores data is not in expected format'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: stores,
      count: stores.length,
    });

  } catch (error) {
    console.error('Error fetching Printify stores:', error);

    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes('PRINTIFY_API_KEY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API key not configured',
            details: 'Please set PRINTIFY_API_KEY in your environment variables'
          },
          { status: 500 }
        );
      }

      if (error.message.includes('Printify API error')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printify API error',
            details: error.message
          },
          { status: 400 }
        );
      }

      if (error.message.includes('fetch')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Network error',
            details: 'Unable to connect to Printify API. Please check your internet connection.'
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: 'Failed to fetch Printify stores'
      },
      { status: 500 }
    );
  }
}


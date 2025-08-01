// app/api/eplan/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EplanClient } from '@/lib/services/eplan-client';

export async function POST(request: NextRequest) {
  try {
    const { partNumber, pat } = await request.json();

    // Validate inputs
    const partValidation = EplanClient.validatePartNumber(partNumber);
    if (!partValidation.isValid) {
      return NextResponse.json(
        { error: partValidation.error },
        { status: 400 }
      );
    }

    const patValidation = EplanClient.validatePAT(pat);
    if (!patValidation.isValid) {
      return NextResponse.json(
        { error: patValidation.error },
        { status: 400 }
      );
    }

    // Create client and search
    const client = new EplanClient(pat);
    const partInfo = await client.searchPart(partNumber);

    if (!partInfo) {
      return NextResponse.json(
        { error: 'Part not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(partInfo);

  } catch (error) {
    console.error('Search error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

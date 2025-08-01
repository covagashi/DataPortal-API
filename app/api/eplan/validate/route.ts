// app/api/eplan/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EplanClient } from '@/lib/services/eplan-client';

export async function POST(request: NextRequest) {
  try {
    const { pat } = await request.json();

    const validation = EplanClient.validatePAT(pat);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const client = new EplanClient(pat);
    const isValid = await client.validatePAT();

    return NextResponse.json({ valid: isValid });

  } catch (error) {
    console.error('PAT validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
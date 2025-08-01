// app/api/eplan/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EplanClient, EplanApiError } from '@/lib/services/eplan-client';
import { E3DParser } from '@/lib/parsers/e3d-parser';
import { STLConverter } from '@/lib/parsers/stl-converter';
import { FileValidator } from '@/lib/services/file-validator';

export async function POST(request: NextRequest) {
  try {
    const { partNumber } = await request.json();
    const finalPat = process.env.EPLAN_DEFAULT_PAT;

    // Validate inputs
    const partValidation = EplanClient.validatePartNumber(partNumber);
    if (!partValidation.isValid) {
      return NextResponse.json(
        { error: partValidation.error },
        { status: 400 }
      );
    }

    if (!finalPat) {
      return NextResponse.json(
        { error: 'EPLAN PAT not configured in environment variables' },
        { status: 500 }
      );
    }

    const patValidation = EplanClient.validatePAT(finalPat);
    if (!patValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid EPLAN PAT configuration' },
        { status: 500 }
      );
    }

    // Create client and download
    const client = new EplanClient(finalPat);
    const { buffer, partInfo, macroInfo } = await client.downloadPartAs3D(partNumber);

    // Validate downloaded E3D buffer
    const bufferValidation = await FileValidator.validateE3DBuffer(buffer);
    if (!bufferValidation.isValid) {
      return NextResponse.json(
        { error: `Invalid E3D data: ${bufferValidation.error}` },
        { status: 400 }
      );
    }

    // Parse and convert
    const parser = new E3DParser(buffer);
    const sceneData = parser.loadSceneData();

    // Generate binary STL output
    const stlData = STLConverter.convertToSTLData(sceneData);
    const content = STLConverter.generateBinarySTL(stlData);
    const filename = FileValidator.sanitizeFilename(`${partNumber}.stl`);

    // Validate STL data
    const validation = STLConverter.validateSTLData(stlData);
    if (!validation.isValid) {
      console.warn('STL validation warnings:', validation.errors);
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Part-Number': partNumber,
        'X-Part-Description': partInfo.description,
        'X-Macro-Name': macroInfo.name,
        'X-Triangle-Count': stlData.triangleCount.toString(),
        'X-Format': 'binary',
        'X-Bounding-Box': JSON.stringify(stlData.boundingBox)
      }
    });

  } catch (error) {
    console.error('Download error:', error);

    if (error instanceof EplanApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode || 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
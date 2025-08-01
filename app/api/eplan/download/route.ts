// app/api/eplan/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EplanClient, EplanApiError } from '@/lib/services/eplan-client';
import { E3DParser } from '@/lib/parsers/e3d-parser';
import { STLConverter } from '@/lib/parsers/stl-converter';
import { FileValidator } from '@/lib/services/eplan-client';

export async function POST(request: NextRequest) {
  try {
    const { partNumber, pat, format = 'ascii' } = await request.json();
    const finalPat = pat || process.env.EPLAN_DEFAULT_PAT;

    // Validate inputs
    const partValidation = EplanClient.validatePartNumber(partNumber);
    if (!partValidation.isValid) {
      return NextResponse.json(
        { error: partValidation.error },
        { status: 400 }
      );
    }

    const patValidation = EplanClient.validatePAT(finalPat);
    if (!patValidation.isValid) {
      return NextResponse.json(
        { error: patValidation.error },
        { status: 400 }
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

    // Generate output based on format
    const filename = FileValidator.sanitizeFilename(`${partNumber}.stl`);
    let content: string | Buffer;
    let contentType: string;

    if (format === 'binary') {
      const stlData = STLConverter.convertToSTLData(sceneData);
      content = STLConverter.generateBinarySTL(stlData);
      contentType = 'application/octet-stream';
    } else {
      content = STLConverter.convertE3DtoSTL(sceneData);
      contentType = 'text/plain';
    }

    // Get STL statistics for headers
    const stlData = STLConverter.convertToSTLData(sceneData);
    const validation = STLConverter.validateSTLData(stlData);

    if (!validation.isValid) {
      console.warn('STL validation warnings:', validation.errors);
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Part-Number': partNumber,
        'X-Part-Description': partInfo.description,
        'X-Macro-Name': macroInfo.name,
        'X-Triangle-Count': stlData.triangleCount.toString(),
        'X-Format': format,
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
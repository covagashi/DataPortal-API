// app/api/convert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import { E3DParser } from '@/lib/parsers/e3d-parser';
import { STLConverter } from '@/lib/parsers/stl-converter';
import { FileValidator } from '@/lib/services/eplan-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('e3dFile') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = FileValidator.validateFile(file);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate E3D buffer
    const bufferValidation = await FileValidator.validateE3DBuffer(buffer);
    if (!bufferValidation.isValid) {
      return NextResponse.json(
        { error: bufferValidation.error },
        { status: 400 }
      );
    }

    // Parse E3D file
    const parser = new E3DParser(buffer);
    const sceneData = parser.loadSceneData();

    // Convert to STL
    const stlContent = STLConverter.convertE3DtoSTL(sceneData);

    // Validate STL data
    const stlData = STLConverter.convertToSTLData(sceneData);
    const stlValidation = STLConverter.validateSTLData(stlData);
    
    if (!stlValidation.isValid) {
      console.warn('STL validation warnings:', stlValidation.errors);
    }

    // Generate filename
    const originalName = file.name.replace('.e3d', '');
    const filename = FileValidator.sanitizeFilename(`${originalName}.stl`);

    // Return STL file
    return new NextResponse(stlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Triangle-Count': stlData.triangleCount.toString(),
        'X-Bounding-Box': JSON.stringify(stlData.boundingBox)
      }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Conversion failed', details: errorMessage },
      { status: 500 }
    );
  }
}
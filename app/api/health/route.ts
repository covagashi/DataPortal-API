// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      e3dParser: 'operational',
      stlConverter: 'operational',
      eplanClient: 'operational'
    }
  });
}
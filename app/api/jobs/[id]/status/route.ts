// app/api/jobs/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/services/job-manager';
import { JobStatusResponse } from '@/types/jobs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = JobManager.getJob(params.id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const response: JobStatusResponse = { job };
    return NextResponse.json(response);

  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
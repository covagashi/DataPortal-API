// app/api/jobs/bulk-convert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/services/job-manager';
import { BulkConversionWorker } from '@/lib/services/bulk-worker';
import { JobResponse } from '@/types/jobs';

export async function POST(request: NextRequest) {
  try {
    const { partNumbers } = await request.json();

    if (!Array.isArray(partNumbers) || partNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid part numbers array' },
        { status: 400 }
      );
    }

    if (partNumbers.length > 10000) {
      return NextResponse.json(
        { error: 'Maximum 10,000 parts per job' },
        { status: 400 }
      );
    }

    // Create job
    const job = JobManager.createJob(partNumbers);

    // Start background processing
    BulkConversionWorker.startProcessing(job.id);

    const response: JobResponse = {
      jobId: job.id,
      status: job.status,
      message: `Job created for ${partNumbers.length} parts`
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}


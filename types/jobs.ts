// types/jobs.ts
export interface BulkConversionJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  partNumbers: string[];
  results: {
    successful: number;
    failed: number;
    details: Array<{
      partNumber: string;
      status: 'success' | 'error';
      error?: string;
      triangleCount?: number;
      fileSize?: number;
    }>;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}

export interface JobResponse {
  jobId: string;
  status: BulkConversionJob['status'];
  message: string;
}

export interface JobStatusResponse {
  job: BulkConversionJob;
}
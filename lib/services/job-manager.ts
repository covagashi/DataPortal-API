// lib/services/job-manager.ts
import { BulkConversionJob } from '@/types/jobs';
import { randomUUID } from 'crypto';

// In-memory storage (replace with Redis/database in production)
const jobs = new Map<string, BulkConversionJob>();

export class JobManager {
  static createJob(partNumbers: string[]): BulkConversionJob {
    const job: BulkConversionJob = {
      id: randomUUID(),
      status: 'pending',
      progress: {
        current: 0,
        total: partNumbers.length,
        percentage: 0
      },
      partNumbers,
      results: {
        successful: 0,
        failed: 0,
        details: []
      },
      createdAt: new Date()
    };

    jobs.set(job.id, job);
    return job;
  }

  static getJob(id: string): BulkConversionJob | null {
    return jobs.get(id) || null;
  }

  static updateJob(id: string, updates: Partial<BulkConversionJob>): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    Object.assign(job, updates);
    jobs.set(id, job);
    return true;
  }

  static updateProgress(id: string, current: number): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    job.progress.current = current;
    job.progress.percentage = Math.round((current / job.progress.total) * 100);
    jobs.set(id, job);
    return true;
  }

  static addResult(id: string, result: BulkConversionJob['results']['details'][0]): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    job.results.details.push(result);
    if (result.status === 'success') {
      job.results.successful++;
    } else {
      job.results.failed++;
    }
    
    jobs.set(id, job);
    return true;
  }

  static completeJob(id: string, downloadUrl?: string): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    job.status = 'completed';
    job.completedAt = new Date();
    if (downloadUrl) job.downloadUrl = downloadUrl;
    
    jobs.set(id, job);
    return true;
  }

  static failJob(id: string, error: string): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
    
    jobs.set(id, job);
    return true;
  }

  static startJob(id: string): boolean {
    const job = jobs.get(id);
    if (!job) return false;

    job.status = 'running';
    job.startedAt = new Date();
    
    jobs.set(id, job);
    return true;
  }

  static cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [id, job] of jobs.entries()) {
      if (job.createdAt < cutoff) {
        jobs.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  static getAllJobs(): BulkConversionJob[] {
    return Array.from(jobs.values());
  }
}
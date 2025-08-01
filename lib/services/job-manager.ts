// lib/services/job-manager.ts
import { BulkConversionJob } from '@/types/jobs';
import { randomUUID } from 'crypto';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const JOBS_DIR = join(process.cwd(), 'jobs');

export class JobManager {
  private static async ensureJobsDir(): Promise<void> {
    if (!existsSync(JOBS_DIR)) {
      await mkdir(JOBS_DIR, { recursive: true });
    }
  }

  private static getJobPath(id: string): string {
    return join(JOBS_DIR, `${id}.json`);
  }

  static async createJob(partNumbers: string[]): Promise<BulkConversionJob> {
    await this.ensureJobsDir();
    
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

    await writeFile(this.getJobPath(job.id), JSON.stringify(job, null, 2));
    return job;
  }

  static async getJob(id: string): Promise<BulkConversionJob | null> {
    try {
      const jobPath = this.getJobPath(id);
      if (!existsSync(jobPath)) return null;
      
      const data = await readFile(jobPath, 'utf-8');
      const job = JSON.parse(data);
      
      // Convert date strings back to Date objects
      job.createdAt = new Date(job.createdAt);
      if (job.startedAt) job.startedAt = new Date(job.startedAt);
      if (job.completedAt) job.completedAt = new Date(job.completedAt);
      
      return job;
    } catch (error) {
      console.error(`Failed to get job ${id}:`, error);
      return null;
    }
  }

  static async updateJob(id: string, updates: Partial<BulkConversionJob>): Promise<boolean> {
    try {
      const job = await this.getJob(id);
      if (!job) return false;

      Object.assign(job, updates);
      await writeFile(this.getJobPath(id), JSON.stringify(job, null, 2));
      return true;
    } catch (error) {
      console.error(`Failed to update job ${id}:`, error);
      return false;
    }
  }

  static async updateProgress(id: string, current: number): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) return false;

    job.progress.current = current;
    job.progress.percentage = Math.round((current / job.progress.total) * 100);
    
    await writeFile(this.getJobPath(id), JSON.stringify(job, null, 2));
    return true;
  }

  static async addResult(id: string, result: BulkConversionJob['results']['details'][0]): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) return false;

    job.results.details.push(result);
    if (result.status === 'success') {
      job.results.successful++;
    } else {
      job.results.failed++;
    }
    
    await writeFile(this.getJobPath(id), JSON.stringify(job, null, 2));
    return true;
  }

  static async completeJob(id: string, downloadUrl?: string): Promise<boolean> {
    return this.updateJob(id, {
      status: 'completed',
      completedAt: new Date(),
      downloadUrl
    });
  }

  static async failJob(id: string, error: string): Promise<boolean> {
    return this.updateJob(id, {
      status: 'failed',
      error,
      completedAt: new Date()
    });
  }

  static async startJob(id: string): Promise<boolean> {
    return this.updateJob(id, {
      status: 'running',
      startedAt: new Date()
    });
  }

  static async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    // Implementation for file cleanup if needed
    return 0;
  }

  static async getAllJobs(): Promise<BulkConversionJob[]> {
    // Implementation to read all job files if needed
    return [];
  }
}
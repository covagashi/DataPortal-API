// lib/services/bulk-worker.ts
import { EplanClient, EplanApiError } from './eplan-client';
import { E3DParser } from '../parsers/e3d-parser';
import { STLConverter } from '../parsers/stl-converter';
import { FileValidator } from './file-validator';
import { JobManager } from './job-manager';
import JSZip from 'jszip';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class BulkConversionWorker {
  private static async ensureDownloadDir(): Promise<string> {
    const downloadDir = join(process.cwd(), 'downloads');
    await mkdir(downloadDir, { recursive: true });
    return downloadDir;
  }

  static async processJob(jobId: string): Promise<void> {
    const job = await JobManager.getJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      throw new Error('Job not found');
    }

    try {
      await JobManager.startJob(jobId);

      const finalPat = process.env.EPLAN_DEFAULT_PAT;
      if (!finalPat) {
        throw new Error('EPLAN PAT not configured');
      }

      const client = new EplanClient(finalPat);
      const zip = new JSZip();

      // Process parts one by one to avoid overwhelming the API
      for (let i = 0; i < job.partNumbers.length; i++) {
        const partNumber = job.partNumbers[i];
        
        try {
          console.log(`Processing part ${i + 1}/${job.partNumbers.length}: ${partNumber}`);
          
          const { buffer, partInfo } = await client.downloadPartAs3D(partNumber);
          
          const bufferValidation = await FileValidator.validateE3DBuffer(buffer);
          if (!bufferValidation.isValid) {
            throw new Error(`Invalid E3D data: ${bufferValidation.error}`);
          }

          const parser = new E3DParser(buffer);
          const sceneData = parser.loadSceneData();
          const stlData = STLConverter.convertToSTLData(sceneData);
          const stlBuffer = STLConverter.generateBinarySTL(stlData);

          const filename = FileValidator.sanitizeFilename(`${partNumber}.stl`);
          zip.file(filename, stlBuffer);

          await JobManager.addResult(jobId, {
            partNumber,
            status: 'success',
            triangleCount: stlData.triangleCount,
            fileSize: stlBuffer.length
          });

          console.log(`✓ Successfully processed ${partNumber}`);

        } catch (error) {
          let errorMessage = 'Conversion failed';
          
          if (error instanceof EplanApiError) {
            errorMessage = error.message;
            if (error.statusCode === 404) {
              errorMessage = 'Part not found or no 3D data available';
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          console.log(`✗ Failed to process ${partNumber}: ${errorMessage}`);

          await JobManager.addResult(jobId, {
            partNumber,
            status: 'error',
            error: errorMessage
          });
        }

        await JobManager.updateProgress(jobId, i + 1);

        // Small delay to prevent API rate limiting
        if (i < job.partNumbers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Generate and save ZIP file only if we have some successful conversions
      const updatedJob = await JobManager.getJob(jobId);
      if (updatedJob && updatedJob.results.successful > 0) {
        const zipBuffer = await zip.generateAsync({ 
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        const downloadDir = await this.ensureDownloadDir();
        const filename = `bulk_conversion_${jobId}.zip`;
        const filepath = join(downloadDir, filename);
        
        await writeFile(filepath, zipBuffer);

        const downloadUrl = `/api/jobs/${jobId}/download`;
        await JobManager.completeJob(jobId, downloadUrl);
        
        console.log(`✓ Job ${jobId} completed: ${updatedJob.results.successful} successful, ${updatedJob.results.failed} failed`);
      } else {
        await JobManager.failJob(jobId, 'No parts could be converted successfully');
        console.log(`✗ Job ${jobId} failed: No successful conversions`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Job processing failed';
      await JobManager.failJob(jobId, errorMessage);
      console.error(`Job ${jobId} failed:`, error);
      throw error;
    }
  }

  static async startProcessing(jobId: string): Promise<void> {
    console.log(`Starting background processing for job ${jobId}`);
    
    // Start processing in background (don't await)
    this.processJob(jobId).catch(error => {
      console.error(`Job ${jobId} processing failed:`, error);
    });
  }
}
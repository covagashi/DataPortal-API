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
    const job = JobManager.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    try {
      JobManager.startJob(jobId);

      const finalPat = process.env.EPLAN_DEFAULT_PAT;
      if (!finalPat) {
        throw new Error('EPLAN PAT not configured');
      }

      const client = new EplanClient(finalPat);
      const zip = new JSZip();

      // Process parts in chunks to avoid memory issues
      const chunkSize = 10;
      const chunks = this.chunkArray(job.partNumbers, chunkSize);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        await Promise.allSettled(
          chunk.map(async (partNumber, chunkIndex) => {
            const currentIndex = i * chunkSize + chunkIndex;
            
            try {
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

              JobManager.addResult(jobId, {
                partNumber,
                status: 'success',
                triangleCount: stlData.triangleCount,
                fileSize: stlBuffer.length
              });

            } catch (error) {
              const errorMessage = error instanceof EplanApiError 
                ? error.message 
                : error instanceof Error 
                  ? error.message 
                  : 'Conversion failed';

              JobManager.addResult(jobId, {
                partNumber,
                status: 'error',
                error: errorMessage
              });
            }

            JobManager.updateProgress(jobId, currentIndex + 1);
          })
        );

        // Small delay between chunks to prevent API rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Generate and save ZIP file
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
      JobManager.completeJob(jobId, downloadUrl);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Job processing failed';
      JobManager.failJob(jobId, errorMessage);
      throw error;
    }
  }

  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  static async startProcessing(jobId: string): Promise<void> {
    // Start processing in background (don't await)
    this.processJob(jobId).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
    });
  }
}
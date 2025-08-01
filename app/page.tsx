// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import FileUploader from '@/components/FileUploader';
import EplanForm from '@/components/EplanForm';
import ConversionStatus from '@/components/ConversionStatus';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';

type ConversionMode = 'file' | 'eplan' | 'bulk';
type ConversionStatus = 'idle' | 'uploading' | 'parsing' | 'converting' | 'success' | 'error';
type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ConversionResult {
  triangleCount?: number;
  fileSize?: number;
  boundingBox?: any;
  filename?: string;
}

interface BulkJob {
  id: string;
  status: JobStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: {
    successful: number;
    failed: number;
    details: Array<{
      partNumber: string;
      status: 'success' | 'error';
      triangleCount?: number;
      fileSize?: number;
      error?: string;
    }>;
  };
  downloadUrl?: string;
  error?: string;
}

export default function HomePage() {
  const [mode, setMode] = useState<ConversionMode>('file');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Bulk conversion state
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [bulkPartNumbers, setBulkPartNumbers] = useState<string>('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetState = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setResult(null);
    setSelectedFile(null);
    setBulkJob(null);
    setBulkPartNumbers('');
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const downloadFromUrl = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Download error:', error);
      setMessage('Download failed');
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/status`);
      if (!response.ok) throw new Error('Failed to get job status');
      
      const data = await response.json();
      const job: BulkJob = data.job;
      setBulkJob(job);

      if (job.status === 'completed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setStatus('success');
        setMessage(`Conversion completed! ${job.results.successful} successful, ${job.results.failed} failed`);
        
        // Auto-download
        if (job.downloadUrl) {
          await downloadFromUrl(job.downloadUrl, `bulk_conversion_${jobId}.zip`);
        }
      } else if (job.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setStatus('error');
        setMessage(job.error || 'Job failed');
      } else if (job.status === 'running') {
        setStatus('converting');
        setMessage(`Processing ${job.progress.current}/${job.progress.total} parts (${job.progress.percentage}%)`);
        setProgress(job.progress.percentage);
      }
    } catch (error) {
      console.error('Polling error:', error);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setStatus('error');
      setMessage('Failed to get job status');
    }
  };

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setStatus('uploading');
    setMessage(`Processing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('e3dFile', file);

      setStatus('parsing');
      setMessage('Parsing E3D file structure...');

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Conversion failed');
      }

      setStatus('converting');
      setMessage('Converting to STL format...');

      const triangleCount = parseInt(response.headers.get('X-Triangle-Count') || '0');
      const boundingBoxStr = response.headers.get('X-Bounding-Box');
      const boundingBox = boundingBoxStr ? JSON.parse(boundingBoxStr) : null;

      const blob = await response.blob();
      const filename = file.name.replace('.e3d', '.stl');

      setResult({
        triangleCount,
        fileSize: blob.size,
        boundingBox,
        filename
      });

      setStatus('success');
      setMessage('Conversion completed successfully!');
      downloadBlob(blob, filename);

    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      console.error('File conversion error:', error);
    }
  };

  const handleEplanDownload = async (data: { partNumber: string }) => {
    setStatus('uploading');
    setMessage(`Searching for part: ${data.partNumber}...`);

    try {
      setStatus('parsing');
      setMessage('Downloading 3D data from EPLAN...');

      const downloadResponse = await fetch('/api/eplan/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber: data.partNumber }),
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Download failed');
      }

      setStatus('converting');
      setMessage('Converting to STL format...');

      const triangleCount = parseInt(downloadResponse.headers.get('X-Triangle-Count') || '0');
      const boundingBoxStr = downloadResponse.headers.get('X-Bounding-Box');
      const boundingBox = boundingBoxStr ? JSON.parse(boundingBoxStr) : null;
      const partDescription = downloadResponse.headers.get('X-Part-Description') || '';

      const blob = await downloadResponse.blob();
      const filename = `${data.partNumber}.stl`;

      setResult({
        triangleCount,
        fileSize: blob.size,
        boundingBox,
        filename
      });

      setStatus('success');
      setMessage(`Successfully converted ${partDescription}`);
      downloadBlob(blob, filename);

    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      console.error('EPLAN conversion error:', error);
    }
  };

  const handleBulkConversion = async () => {
    const partNumbers = bulkPartNumbers
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (partNumbers.length === 0) {
      setMessage('Please enter at least one part number');
      return;
    }

    if (partNumbers.length > 10000) {
      setMessage('Maximum 10,000 parts per job');
      return;
    }

    setStatus('uploading');
    setMessage(`Starting bulk conversion for ${partNumbers.length} parts...`);

    try {
      const response = await fetch('/api/jobs/bulk-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumbers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start bulk conversion');
      }

      const data = await response.json();
      console.log('Job response:', data); // Debug log
      
      // Try both possible response formats
      const jobId = data.jobId || data.id;

      if (!jobId) {
        console.error('Server response:', data);
        throw new Error('No job ID received from server');
      }

      setStatus('parsing');
      setMessage('Job created, starting processing...');

      // Start polling for job status
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000); // Poll every 2 seconds

      // Initial poll
      await pollJobStatus(jobId);

    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to start bulk conversion');
      console.error('Bulk conversion error:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              E3D to STL Converter
            </h1>
            <p className="text-lg text-gray-600">
              Data portal API browser
            </p>
          </div>

          {/* Mode Selection */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
              <button
                onClick={() => { setMode('file'); resetState(); }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📁 Upload E3D File
              </button>
              <button
                onClick={() => { setMode('eplan'); resetState(); }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'eplan' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🌐 Download from EPLAN
              </button>
              <button
                onClick={() => { setMode('bulk'); resetState(); }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📦 Bulk Conversion
              </button>
            </div>

            {/* File Upload Mode */}
            {mode === 'file' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">Upload E3D File</h2>
                  <p className="text-gray-600 mb-4">
                    Select an E3D file from your computer to convert to STL format.
                  </p>
                </div>
                <FileUploader onFileSelect={handleFileUpload} disabled={status !== 'idle'} />
                {selectedFile && status === 'idle' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center space-x-3">
                      <div className="text-blue-600">📄</div>
                      <div>
                        <p className="font-medium text-blue-900">{selectedFile.name}</p>
                        <p className="text-sm text-blue-600">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Ready to convert
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EPLAN Download Mode */}
            {mode === 'eplan' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    Download from EPLAN Data Portal
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Enter a part number to download and convert 3D data.
                  </p>
                </div>
                <EplanForm onSubmit={handleEplanDownload} loading={status !== 'idle'} />
              </div>
            )}

            {/* Bulk Conversion Mode */}
            {mode === 'bulk' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    Bulk Conversion from EPLAN
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Enter multiple part numbers (one per line) for batch conversion.
                  </p>
                </div>

                <div>
                  <label htmlFor="partNumbers" className="block text-sm font-medium text-gray-700 mb-1">
                    Part Numbers
                  </label>
                  <textarea
                    id="partNumbers"
                    value={bulkPartNumbers}
                    onChange={(e) => setBulkPartNumbers(e.target.value)}
                    placeholder="MAC_PILZ5CPNOZ5C787&#10;MAC_ABB1SBL281001R1313&#10;MAC_SIEMENS3RV2011-1JA10"
                    disabled={status !== 'idle'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    rows={8}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-yellow-600 mt-0.5">⚠️</div>
                    <div>
                      <p className="font-medium text-yellow-900">Bulk Processing</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Large batches may take several minutes. You'll receive a ZIP file with all converted STL files.
                        Maximum 10,000 parts per job.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleBulkConversion}
                  disabled={status !== 'idle' || bulkPartNumbers.trim().length === 0}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    status === 'idle' && bulkPartNumbers.trim().length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {status !== 'idle' ? 'Processing...' : 'Start Bulk Conversion'}
                </button>
              </div>
            )}
          </div>

          {/* Status Display */}
          <ConversionStatus
            status={status}
            progress={progress}
            message={message}
            details={result}
          />

          {/* Bulk Job Progress */}
          {bulkJob && mode === 'bulk' && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Conversion Progress</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {bulkJob.progress?.current || 0}/{bulkJob.progress?.total || 0}
                    </div>
                    <div className="text-sm text-blue-700">Parts Processed</div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {bulkJob.results?.successful || 0}
                    </div>
                    <div className="text-sm text-green-700">Successful</div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {bulkJob.results?.failed || 0}
                    </div>
                    <div className="text-sm text-red-700">Failed</div>
                  </div>
                </div>

                {bulkJob.status === 'running' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${bulkJob.progress?.percentage || 0}%` }}
                    />
                  </div>
                )}

                {bulkJob.status === 'completed' && bulkJob.downloadUrl && (
                  <button
                    onClick={() => downloadFromUrl(bulkJob.downloadUrl!, `bulk_conversion_${bulkJob.id}.zip`)}
                    className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Download ZIP File
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {status === 'success' && result && mode !== 'bulk' && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {result.triangleCount?.toLocaleString() || 'N/A'}
                  </div>
                  <div className="text-sm text-green-700">Triangles</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.fileSize ? `${(result.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
                  </div>
                  <div className="text-sm text-blue-700">File Size</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">STL</div>
                  <div className="text-sm text-purple-700">Format</div>
                </div>
              </div>
              <button
                onClick={resetState}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Convert Another File
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-12 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              E3D to STL conversion made by Covaga
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
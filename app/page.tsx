// app/page.tsx
'use client';

import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import EplanForm from '@/components/EplanForm';
import ConversionStatus from '@/components/ConversionStatus';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';

type ConversionMode = 'file' | 'eplan';
type ConversionStatus = 'idle' | 'uploading' | 'parsing' | 'converting' | 'success' | 'error';

interface ConversionResult {
  triangleCount?: number;
  fileSize?: number;
  boundingBox?: any;
  filename?: string;
}

export default function HomePage() {
  const [mode, setMode] = useState<ConversionMode>('file');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetState = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setResult(null);
    setSelectedFile(null);
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

      // Get metadata from headers
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

      // Auto-download
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
      // Download and convert directly
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

      // Get metadata from headers
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

      // Auto-download
      downloadBlob(blob, filename);

    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      console.error('EPLAN conversion error:', error);
    }
  };

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
                onClick={() => {
                  setMode('file');
                  resetState();
                }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${mode === 'file'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                📁 Upload E3D File
              </button>
              <button
                onClick={() => {
                  setMode('eplan');
                  resetState();
                }}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${mode === 'eplan'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                🌐 Download from EPLAN
              </button>
            </div>

            {/* File Upload Mode */}
            {mode === 'file' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">
                    Upload E3D File
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Select an E3D file from your computer to convert to STL format.
                  </p>
                </div>

                <FileUploader
                  onFileSelect={handleFileUpload}
                  disabled={status !== 'idle'}
                />

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
                    Enter a part number and your EPLAN PAT token to download and convert 3D data.
                  </p>
                </div>

                <EplanForm
                  onSubmit={handleEplanDownload}
                  loading={status !== 'idle'}
                />

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-yellow-600 mt-0.5">⚠️</div>
                    <div>
                      <p className="font-medium text-yellow-900">PAT Token</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        You need a valid EPLAN Data Portal Personal Access Token (PAT) to download 3D data.
                        Get yours from the EPLAN Data Portal settings.
                      </p>
                    </div>
                  </div>
                </div>
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

          {/* Results */}
          {status === 'success' && result && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Conversion Results
              </h3>

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

              {result.boundingBox && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Bounding Box</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-700">Size</div>
                      <div className="text-gray-600">
                        {result.boundingBox.size.x.toFixed(2)} × {result.boundingBox.size.y.toFixed(2)} × {result.boundingBox.size.z.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Center</div>
                      <div className="text-gray-600">
                        ({result.boundingBox.center.x.toFixed(2)}, {result.boundingBox.center.y.toFixed(2)}, {result.boundingBox.center.z.toFixed(2)})
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Volume</div>
                      <div className="text-gray-600">
                        {(result.boundingBox.size.x * result.boundingBox.size.y * result.boundingBox.size.z).toFixed(2)} units³
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
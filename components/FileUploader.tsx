// components/FileUploader.tsx
'use client';

import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

export default function FileUploader({
  onFileSelect,
  accept = '.e3d',
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    if (accept && !file.name.toLowerCase().endsWith(accept)) {
      return `Invalid file type. Expected ${accept}`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(file);
  }, [onFileSelect, maxSize, accept]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  return (
    <div className="w-full">
      <div
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          {
            'border-blue-400 bg-blue-50': isDragOver && !disabled,
            'border-gray-300 hover:border-gray-400': !isDragOver && !disabled,
            'border-gray-200 bg-gray-50 cursor-not-allowed': disabled,
            'border-red-300 bg-red-50': error
          }
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          <div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragOver ? 'Drop your E3D file here' : 'Upload E3D File'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop your file here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supported: {accept} (Max: {Math.round(maxSize / 1024 / 1024)}MB)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

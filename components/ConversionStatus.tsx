// components/ConversionStatus.tsx
'use client';

import { clsx } from 'clsx';

interface ConversionStatusProps {
  status: 'idle' | 'uploading' | 'parsing' | 'converting' | 'success' | 'error';
  progress?: number;
  message?: string;
  details?: {
    triangleCount?: number;
    fileSize?: number;
    boundingBox?: any;
  };
}

export default function ConversionStatus({ 
  status, 
  progress = 0, 
  message, 
  details 
}: ConversionStatusProps) {
  if (status === 'idle') return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'uploading':
        return {
          color: 'blue',
          icon: '⬆️',
          title: 'Uploading file...',
          showProgress: true
        };
      case 'parsing':
        return {
          color: 'yellow',
          icon: '🔍',
          title: 'Parsing E3D file...',
          showProgress: false
        };
      case 'converting':
        return {
          color: 'blue',
          icon: '🔄',
          title: 'Converting to STL...',
          showProgress: false
        };
      case 'success':
        return {
          color: 'green',
          icon: '✅',
          title: 'Conversion completed!',
          showProgress: false
        };
      case 'error':
        return {
          color: 'red',
          icon: '❌',
          title: 'Conversion failed',
          showProgress: false
        };
      default:
        return {
          color: 'gray',
          icon: '⏳',
          title: 'Processing...',
          showProgress: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={clsx(
      'p-4 rounded-lg border-l-4 transition-all duration-300',
      {
        'bg-blue-50 border-blue-400': config.color === 'blue',
        'bg-yellow-50 border-yellow-400': config.color === 'yellow',
        'bg-green-50 border-green-400': config.color === 'green',
        'bg-red-50 border-red-400': config.color === 'red',
        'bg-gray-50 border-gray-400': config.color === 'gray'
      }
    )}>
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <h3 className={clsx(
            'font-medium',
            {
              'text-blue-800': config.color === 'blue',
              'text-yellow-800': config.color === 'yellow',
              'text-green-800': config.color === 'green',
              'text-red-800': config.color === 'red',
              'text-gray-800': config.color === 'gray'
            }
          )}>
            {config.title}
          </h3>
          
          {message && (
            <p className={clsx(
              'text-sm mt-1',
              {
                'text-blue-600': config.color === 'blue',
                'text-yellow-600': config.color === 'yellow',
                'text-green-600': config.color === 'green',
                'text-red-600': config.color === 'red',
                'text-gray-600': config.color === 'gray'
              }
            )}>
              {message}
            </p>
          )}

          {config.showProgress && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={clsx(
                    'h-2 rounded-full transition-all duration-300',
                    {
                      'bg-blue-600': config.color === 'blue',
                      'bg-yellow-600': config.color === 'yellow',
                      'bg-green-600': config.color === 'green'
                    }
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}

          {details && status === 'success' && (
            <div className="mt-3 space-y-1">
              {details.triangleCount && (
                <p className="text-sm text-green-600">
                  Triangles: {details.triangleCount.toLocaleString()}
                </p>
              )}
              {details.fileSize && (
                <p className="text-sm text-green-600">
                  File size: {(details.fileSize / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
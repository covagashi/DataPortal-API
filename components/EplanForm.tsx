// components/EplanForm.tsx
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

interface EplanFormProps {
  onSubmit: (data: { partNumber: string }) => void;
  loading?: boolean;
}

export default function EplanForm({ onSubmit, loading = false }: EplanFormProps) {
  const [partNumber, setPartNumber] = useState('');
  const [errors, setErrors] = useState<{ partNumber?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { partNumber?: string } = {};

    if (!partNumber.trim()) {
      newErrors.partNumber = 'Part number is required';
    } else if (partNumber.length > 100) {
      newErrors.partNumber = 'Part number too long (max 100 characters)';
    } else if (!/^[A-Za-z0-9_\-\.]+$/.test(partNumber)) {
      newErrors.partNumber = 'Part number contains invalid characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({ partNumber: partNumber.trim() });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Part Number
        </label>
        <input
          type="text"
          id="partNumber"
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          placeholder="e.g., MAC_PILZ5CPNOZ5C787"
          disabled={loading}
          className={clsx(
            'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            {
              'border-red-300': errors.partNumber,
              'border-gray-300': !errors.partNumber,
              'bg-gray-50 cursor-not-allowed': loading
            }
          )}
        />
        {errors.partNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.partNumber}</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 mt-0.5">ℹ️</div>
          <div>
            <p className="font-medium text-blue-900">Output Format</p>
            <p className="text-sm text-blue-700 mt-1">
              Files will be downloaded as binary STL format for optimal file size and loading performance.
            </p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !partNumber.trim()}
        className={clsx(
          'w-full py-2 px-4 rounded-md font-medium transition-colors',
          {
            'bg-blue-600 text-white hover:bg-blue-700': !loading && partNumber.trim(),
            'bg-gray-300 text-gray-500 cursor-not-allowed': loading || !partNumber.trim()
          }
        )}
      >
        {loading ? 'Downloading & Converting...' : 'Download & Convert'}
      </button>
    </form>
  );
}
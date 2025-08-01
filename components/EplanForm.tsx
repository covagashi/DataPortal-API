// components/EplanForm.tsx
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

interface EplanFormProps {
  onSubmit: (data: { partNumber: string; pat: string; format: 'ascii' | 'binary' }) => void;
  loading?: boolean;
}

export default function EplanForm({ onSubmit, loading = false }: EplanFormProps) {
  const [partNumber, setPartNumber] = useState('');
  const [pat, setPat] = useState('');
  const [format, setFormat] = useState<'ascii' | 'binary'>('ascii');
  const [errors, setErrors] = useState<{ partNumber?: string; pat?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { partNumber?: string; pat?: string } = {};

    if (!partNumber.trim()) {
      newErrors.partNumber = 'Part number is required';
    } else if (partNumber.length > 100) {
      newErrors.partNumber = 'Part number too long (max 100 characters)';
    } else if (!/^[A-Za-z0-9_\-\.]+$/.test(partNumber)) {
      newErrors.partNumber = 'Part number contains invalid characters';
    }

    if (!pat.trim()) {
      newErrors.pat = 'PAT token is required';
    } else if (pat.length < 10) {
      newErrors.pat = 'PAT token too short';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({ partNumber: partNumber.trim(), pat: pat.trim(), format });
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

      <div>
        <label htmlFor="pat" className="block text-sm font-medium text-gray-700 mb-1">
          EPLAN PAT Token
        </label>
        <input
          type="password"
          id="pat"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="Your EPLAN Data Portal access token"
          disabled={loading}
          className={clsx(
            'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            {
              'border-red-300': errors.pat,
              'border-gray-300': !errors.pat,
              'bg-gray-50 cursor-not-allowed': loading
            }
          )}
        />
        {errors.pat && (
          <p className="mt-1 text-sm text-red-600">{errors.pat}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Output Format
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="ascii"
              checked={format === 'ascii'}
              onChange={(e) => setFormat(e.target.value as 'ascii' | 'binary')}
              disabled={loading}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">ASCII STL</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="binary"
              checked={format === 'binary'}
              onChange={(e) => setFormat(e.target.value as 'ascii' | 'binary')}
              disabled={loading}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Binary STL</span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !partNumber.trim() || !pat.trim()}
        className={clsx(
          'w-full py-2 px-4 rounded-md font-medium transition-colors',
          {
            'bg-blue-600 text-white hover:bg-blue-700': !loading && partNumber.trim() && pat.trim(),
            'bg-gray-300 text-gray-500 cursor-not-allowed': loading || !partNumber.trim() || !pat.trim()
          }
        )}
      >
        {loading ? 'Downloading & Converting...' : 'Download & Convert'}
      </button>
    </form>
  );
}

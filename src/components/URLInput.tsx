import React, { FC, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  selectSources,
  addSource,
} from '../store/designSystemSlice';

export const URLInput: FC = () => {
  const dispatch = useAppDispatch();
  const sources = useAppSelector(selectSources);
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSourceByUrl = (url: string) => {
    return sources.find(s => s.url === url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;

    const existingSource = getSourceByUrl(inputUrl);
    if (existingSource) {
      setError('This URL has already been added');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Just add to Redux store
      dispatch(addSource({
        url: inputUrl,
        name: inputName || new URL(inputUrl).hostname
      }));

      // Reset form
      setInputUrl('');
      setInputName('');
      setError(null);
    } catch (error) {
      console.error('Error adding source:', error);
      setError('Failed to add source');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex flex-col space-y-2">
        <label htmlFor="url" className="text-sm font-medium text-gray-700 dark:text-gray-200">URL</label>
        <input
          type="url"
          id="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://design-system-docs.com"
          className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
      </div>
      <div className="flex flex-col space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-200">Name (optional)</label>
        <input
          type="text"
          id="name"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="My Design System"
          className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={isProcessing}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isProcessing ? 'Adding...' : 'Add Design System'}
      </button>
    </form>
  );
};

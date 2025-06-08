/**
 * Enhanced URL Input with Data Extraction
 * 
 * Provides a form to add URLs and extract data directly into the data management system
 */

import React, { FC, useState } from 'react';
import { ExtractedPageContent } from '../types/types';
import { CrawlerButton } from './CrawlerButton';

interface EnhancedURLInputProps {
  onPagesExtracted?: (pages: ExtractedPageContent[]) => void;
  onNewUrl?: (url: string, name: string) => void;
}

export const EnhancedURLInput: FC<EnhancedURLInputProps> = ({
  onPagesExtracted,
  onNewUrl
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recentlyExtracted, setRecentlyExtracted] = useState<number>(0);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleUrlChange = (value: string) => {
    setInputUrl(value);
    setError(null);
    
    // Auto-generate name from URL if empty
    if (value && !inputName) {
      try {
        const url = new URL(value);
        setInputName(url.hostname);
      } catch {
        // Invalid URL, ignore
      }
    }
  };

  const handlePagesExtracted = (pages: ExtractedPageContent[]) => {
    setRecentlyExtracted(pages.length);
    
    // Also add to sources if callback provided
    if (onNewUrl && inputUrl && inputName) {
      onNewUrl(inputUrl, inputName);
    }
    
    // Pass pages to parent
    if (onPagesExtracted) {
      onPagesExtracted(pages);
    }

    // Clear form after successful extraction
    setTimeout(() => {
      setInputUrl('');
      setInputName('');
      setRecentlyExtracted(0);
    }, 3000);
  };

  const handleCrawlError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="flex flex-col space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-b pb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Add Design System
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Enter a URL to crawl and extract component data
        </p>
      </div>

      <div className="flex flex-col space-y-2">
        <label htmlFor="url" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          URL
        </label>
        <input
          type="url"
          id="url"
          value={inputUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://design-system-docs.com"
          className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="flex flex-col space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="My Design System"
          className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {recentlyExtracted > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-700 text-sm">
            ✅ Successfully extracted {recentlyExtracted} pages!
          </p>
        </div>
      )}

      <CrawlerButton
        url={inputUrl}
        onPagesExtracted={handlePagesExtracted}
        onError={handleCrawlError}
        disabled={!isValidUrl(inputUrl)}
      />

      <div className="text-xs text-gray-500 space-y-1">
        <p>• This will crawl the provided URL and extract component documentation</p>
        <p>• Extracted data will be available in the Data Management and Export tabs</p>
        <p>• Large sites may take a few minutes to process completely</p>
      </div>
    </div>
  );
};

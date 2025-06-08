'use client';

import React, { useState } from 'react';
import { ExtractedPageContent } from '../types/types';
import { exportPages, downloadExport, saveToLocalStorage, loadFromLocalStorage, ExportOptions } from '../lib/export';

interface ExportManagerProps {
  pages: ExtractedPageContent[];
  onLoadPages?: (pages: ExtractedPageContent[]) => void;
}

export default function ExportManager({ pages, onLoadPages }: ExportManagerProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeCodeSamples: true,
    includeMetadata: true,
    includeSemanticContent: true,
    minifyJson: false,
    separateCodeFiles: false,
    filename: ''
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  // Load saved keys on mount
  React.useEffect(() => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('crawl-data-'));
    setSavedKeys(keys);
  }, []);

  const handleExport = async () => {
    if (pages.length === 0) {
      setExportStatus('No pages to export');
      return;
    }

    setIsExporting(true);
    setExportStatus('Preparing export...');

    try {
      const result = exportPages(pages, exportOptions);
      downloadExport(result);
      
      setExportStatus(
        `Exported ${pages.length} pages (${(result.size / 1024).toFixed(1)} KB)` +
        (result.additionalFiles ? ` + ${result.additionalFiles.length} code files` : '')
      );
    } catch (error) {
      setExportStatus(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = () => {
    if (pages.length === 0) {
      setExportStatus('No pages to save');
      return;
    }

    const key = `crawl-data-${Date.now()}`;
    const success = saveToLocalStorage(key, pages);
    
    if (success) {
      setExportStatus(`Saved ${pages.length} pages to local storage`);
      setSavedKeys(prev => [...prev, key]);
    } else {
      setExportStatus('Failed to save to local storage');
    }
  };

  const handleLoad = (key: string) => {
    const loadedPages = loadFromLocalStorage(key);
    
    if (loadedPages && onLoadPages) {
      onLoadPages(loadedPages);
      setExportStatus(`Loaded ${loadedPages.length} pages from local storage`);
    } else {
      setExportStatus('Failed to load from local storage');
    }
  };

  const handleDelete = (key: string) => {
    localStorage.removeItem(key);
    setSavedKeys(prev => prev.filter(k => k !== key));
    setExportStatus('Deleted saved data');
  };

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleString();
  };

  const totalCodeSamples = pages.reduce((sum, page) => sum + page.codeSamples.length, 0);
  const totalTextLength = pages.reduce((sum, page) => sum + page.textContent.length, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-semibold text-gray-900">Export & Persistence</h2>
        <p className="text-sm text-gray-600 mt-1">
          Export crawled data or save/load from local storage
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{pages.length}</div>
          <div className="text-sm text-gray-600">Pages</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{totalCodeSamples}</div>
          <div className="text-sm text-gray-600">Code Samples</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {(totalTextLength / 1024).toFixed(0)}KB
          </div>
          <div className="text-sm text-gray-600">Text Content</div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Export Options</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <select
              value={exportOptions.format}
              onChange={(e) => setExportOptions(prev => ({ 
                ...prev, 
                format: e.target.value as ExportOptions['format']
              }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename (optional)
            </label>
            <input
              type="text"
              value={exportOptions.filename}
              onChange={(e) => setExportOptions(prev => ({ ...prev, filename: e.target.value }))}
              placeholder="custom-filename"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeCodeSamples}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  includeCodeSamples: e.target.checked 
                }))}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Code Samples</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeMetadata}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  includeMetadata: e.target.checked 
                }))}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Metadata</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exportOptions.includeSemanticContent}
                onChange={(e) => setExportOptions(prev => ({ 
                  ...prev, 
                  includeSemanticContent: e.target.checked 
                }))}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Semantic Content</span>
            </label>
          </div>

          <div className="space-y-2">
            {exportOptions.format === 'json' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.minifyJson}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    minifyJson: e.target.checked 
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Minify JSON</span>
              </label>
            )}

            {exportOptions.includeCodeSamples && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.separateCodeFiles}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    separateCodeFiles: e.target.checked 
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Separate Code Files</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting || pages.length === 0}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? 'Exporting...' : 'Export & Download'}
        </button>

        <button
          onClick={handleSave}
          disabled={pages.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Save to Local Storage
        </button>
      </div>

      {/* Status */}
      {exportStatus && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">{exportStatus}</p>
        </div>
      )}

      {/* Saved Data Management */}
      {savedKeys.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Saved Data</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {savedKeys.map(key => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {key.replace('crawl-data-', 'Export ')}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatDate(key.replace('crawl-data-', ''))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoad(key)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(key)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

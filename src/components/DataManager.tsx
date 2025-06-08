'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ExtractedPageContent } from '../types/types';
import {
  validatePageContent,
  sanitizePageContent,
  filterPages,
  sortPages,
  generateDataInsights,
  searchPages,
  exportInsights,
  FilterOptions,
  SearchOptions,
  DataInsights,
  ValidationResult
} from '../lib/dataUtils';
import { downloadExport } from '../lib/export';

interface DataManagerProps {
  pages: ExtractedPageContent[];
  onPagesUpdate: (pages: ExtractedPageContent[]) => void;
}

export default function DataManager({ pages, onPagesUpdate }: DataManagerProps) {
  const [activeTab, setActiveTab] = useState<'filter' | 'search' | 'merge' | 'insights' | 'validation'>('filter');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  
  // Filter state
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    minTextLength: undefined,
    maxTextLength: undefined,
    includeWithErrors: true,
    requireCodeSamples: false,
    urlPatterns: [],
    excludeUrlPatterns: [],
    languages: [],
    dateRange: undefined
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    regex: false,
    searchIn: ['textContent', 'headings', 'codeSamples', 'metadata'],
    limit: undefined
  });
  const [searchResults, setSearchResults] = useState<ExtractedPageContent[]>([]);
  
  // Sort state
  const [sortBy, setSortBy] = useState<'timestamp' | 'url' | 'textLength' | 'codeSamplesCount' | 'renderTime'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Insights and validation
  const [insights, setInsights] = useState<DataInsights | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  // Available languages from pages
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>();
    pages.forEach(page => {
      page.codeSamples?.forEach(sample => {
        if (sample.language) languages.add(sample.language);
        if (sample.detectedLanguage) languages.add(sample.detectedLanguage);
      });
    });
    return Array.from(languages).sort();
  }, [pages]);

  // Handle filtering
  const handleApplyFilter = useCallback(() => {
    setIsProcessing(true);
    setStatus('Applying filters...');
    
    try {
      const filtered = filterPages(pages, filterOptions);
      onPagesUpdate(filtered);
      setStatus(`Filtered to ${filtered.length} pages from ${pages.length} total`);
    } catch (error) {
      setStatus(`Filter error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pages, filterOptions, onPagesUpdate]);

  // Handle sorting
  const handleApplySort = useCallback(() => {
    setIsProcessing(true);
    setStatus('Sorting pages...');
    
    try {
      const sorted = sortPages(pages, sortBy, sortOrder);
      onPagesUpdate(sorted);
      setStatus(`Sorted ${sorted.length} pages by ${sortBy}`);
    } catch (error) {
      setStatus(`Sort error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pages, sortBy, sortOrder, onPagesUpdate]);

  // Handle search
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsProcessing(true);
    setStatus('Searching...');
    
    try {
      const results = searchPages(pages, searchQuery, searchOptions);
      setSearchResults(results);
      setStatus(`Found ${results.length} matching pages`);
    } catch (error) {
      setStatus(`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSearchResults([]);
    } finally {
      setIsProcessing(false);
    }
  }, [pages, searchQuery, searchOptions]);

  // Handle data cleaning
  const handleCleanData = useCallback(() => {
    setIsProcessing(true);
    setStatus('Cleaning data...');
    
    try {
      const cleaned = pages.map(page => sanitizePageContent(page));
      onPagesUpdate(cleaned);
      setStatus(`Cleaned ${cleaned.length} pages`);
    } catch (error) {
      setStatus(`Cleaning error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pages, onPagesUpdate]);

  // Generate insights
  const handleGenerateInsights = useCallback(() => {
    setIsProcessing(true);
    setStatus('Generating insights...');
    
    try {
      const dataInsights = generateDataInsights(pages);
      setInsights(dataInsights);
      setStatus('Insights generated successfully');
    } catch (error) {
      setStatus(`Insights error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pages]);

  // Validate data
  const handleValidateData = useCallback(() => {
    setIsProcessing(true);
    setStatus('Validating data...');
    
    try {
      const validationResult = validatePageContent(pages);
      setValidation(validationResult);
      setStatus(`Validation complete: ${validationResult.isValid ? 'Valid' : 'Issues found'}`);
    } catch (error) {
      setStatus(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pages]);

  // Export insights
  const handleExportInsights = useCallback(() => {
    if (!insights) return;
    
    try {
      const result = exportInsights(insights);
      downloadExport(result);
      setStatus('Insights exported successfully');
    } catch (error) {
      setStatus(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [insights]);

  const renderFilterPanel = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Filter Options</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Text Length
          </label>
          <input
            type="number"
            value={filterOptions.minTextLength || ''}
            onChange={(e) => setFilterOptions(prev => ({
              ...prev,
              minTextLength: e.target.value ? parseInt(e.target.value) : undefined
            }))}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Minimum characters"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Text Length
          </label>
          <input
            type="number"
            value={filterOptions.maxTextLength || ''}
            onChange={(e) => setFilterOptions(prev => ({
              ...prev,
              maxTextLength: e.target.value ? parseInt(e.target.value) : undefined
            }))}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Maximum characters"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filterOptions.includeWithErrors}
            onChange={(e) => setFilterOptions(prev => ({
              ...prev,
              includeWithErrors: e.target.checked
            }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">Include pages with errors</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filterOptions.requireCodeSamples}
            onChange={(e) => setFilterOptions(prev => ({
              ...prev,
              requireCodeSamples: e.target.checked
            }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">Require code samples</span>
        </label>
      </div>
      
      {availableLanguages.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Programming Languages
          </label>
          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
            {availableLanguages.map(lang => (
              <label key={lang} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filterOptions.languages?.includes(lang) || false}
                  onChange={(e) => {
                    setFilterOptions(prev => {
                      const languages = prev.languages || [];
                      if (e.target.checked) {
                        return { ...prev, languages: [...languages, lang] };
                      } else {
                        return { ...prev, languages: languages.filter(l => l !== lang) };
                      }
                    });
                  }}
                  className="mr-1"
                />
                <span className="text-xs text-gray-600">{lang}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={handleApplyFilter}
          disabled={isProcessing}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          Apply Filters
        </button>
        
        <button
          onClick={handleApplySort}
          disabled={isProcessing}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          Sort Pages
        </button>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'url' | 'textLength' | 'codeSamplesCount' | 'renderTime')}
          className="p-2 border border-gray-300 rounded-md"
        >
          <option value="timestamp">Timestamp</option>
          <option value="url">URL</option>
          <option value="textLength">Text Length</option>
          <option value="codeSamplesCount">Code Samples</option>
          <option value="renderTime">Render Time</option>
        </select>
        
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          className="p-2 border border-gray-300 rounded-md"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
    </div>
  );

  const renderSearchPanel = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Search & Query</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Query
        </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Enter search terms or regex pattern"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={searchOptions.caseSensitive}
              onChange={(e) => setSearchOptions(prev => ({
                ...prev,
                caseSensitive: e.target.checked
              }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Case sensitive</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={searchOptions.regex}
              onChange={(e) => setSearchOptions(prev => ({
                ...prev,
                regex: e.target.checked
              }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Regular expression</span>
          </label>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search In:
          </label>
          <div className="space-y-1">
            {['textContent', 'headings', 'codeSamples', 'metadata'].map(field => (
              <label key={field} className="flex items-center">
                <input
                  type="checkbox"
                  checked={searchOptions.searchIn?.includes(field as 'textContent' | 'headings' | 'codeSamples' | 'metadata') || false}
                  onChange={(e) => {
                    setSearchOptions(prev => {
                      const searchIn = prev.searchIn || [];
                      if (e.target.checked) {
                        return { ...prev, searchIn: [...searchIn, field as 'textContent' | 'headings' | 'codeSamples' | 'metadata'] };
                      } else {
                        return { ...prev, searchIn: searchIn.filter(f => f !== field) };
                      }
                    });
                  }}
                  className="mr-2"
                />
                <span className="text-xs text-gray-600">{field}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      
      <button
        onClick={handleSearch}
        disabled={isProcessing || !searchQuery.trim()}
        className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
      >
        Search
      </button>
      
      {searchResults.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Search Results ({searchResults.length})</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {searchResults.slice(0, 10).map(page => (
              <div key={page.id} className="p-3 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {page.metadata?.title || page.url}
                </div>
                <div className="text-xs text-gray-600 truncate">{page.url}</div>
                <div className="text-xs text-gray-500">
                  {page.textContent.length} chars, {page.codeSamples?.length || 0} code samples
                </div>
              </div>
            ))}
            {searchResults.length > 10 && (
              <div className="text-sm text-gray-500 text-center">
                ... and {searchResults.length - 10} more results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderInsightsPanel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Data Insights</h3>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateInsights}
            disabled={isProcessing || pages.length === 0}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
          >
            Generate Insights
          </button>
          {insights && (
            <button
              onClick={handleExportInsights}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Export Report
            </button>
          )}
        </div>
      </div>
      
      {insights && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Overview</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Pages:</span>
                <span className="font-medium">{insights.overview.totalPages}</span>
              </div>
              <div className="flex justify-between">
                <span>Text Content:</span>
                <span className="font-medium">{(insights.overview.totalTextLength / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between">
                <span>Code Samples:</span>
                <span className="font-medium">{insights.overview.totalCodeSamples}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Render Time:</span>
                <span className="font-medium">{insights.overview.averageRenderTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Domains:</span>
                <span className="font-medium">{insights.overview.uniqueDomains}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">Content Analysis</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Avg Content Length:</span>
                <span className="font-medium">{insights.contentAnalysis.averageContentLength.toFixed(0)} chars</span>
              </div>
              <div className="flex justify-between">
                <span>Pages with Errors:</span>
                <span className="font-medium">{insights.contentAnalysis.pagesWithErrors}</span>
              </div>
              <div className="flex justify-between">
                <span>Languages Detected:</span>
                <span className="font-medium">{insights.contentAnalysis.languageDistribution.length}</span>
              </div>
            </div>
            
            {insights.contentAnalysis.languageDistribution.length > 0 && (
              <div className="mt-3">
                <h5 className="text-sm font-medium mb-2">Top Languages:</h5>
                <div className="space-y-1">
                  {insights.contentAnalysis.languageDistribution.slice(0, 5).map(({ language, count }) => (
                    <div key={language} className="flex justify-between text-xs">
                      <span>{language}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recommendations</h4>
          <ul className="space-y-1 text-sm">
            {insights.recommendations.map((rec, index) => (
              <li key={index} className="text-gray-700">• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderValidationPanel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Data Validation</h3>
        <div className="flex gap-2">
          <button
            onClick={handleValidateData}
            disabled={isProcessing || pages.length === 0}
            className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:bg-gray-400"
          >
            Validate Data
          </button>
          <button
            onClick={handleCleanData}
            disabled={isProcessing || pages.length === 0}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400"
          >
            Clean Data
          </button>
        </div>
      </div>
      
      {validation && (
        <div className="space-y-4">
          <div className={`p-4 rounded-md ${validation.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${validation.isValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {validation.isValid ? 'Data is valid' : 'Validation issues found'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Metrics</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Pages:</span>
                  <span>{validation.metrics.totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valid Pages:</span>
                  <span className="text-green-600">{validation.metrics.validPages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Pages:</span>
                  <span className="text-red-600">{validation.metrics.errorPages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Empty Pages:</span>
                  <span className="text-yellow-600">{validation.metrics.emptyPages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duplicate URLs:</span>
                  <span className="text-orange-600">{validation.metrics.duplicateUrls}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Issues</h4>
              {validation.errors.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-red-600 mb-1">Errors:</h5>
                  <div className="max-h-32 overflow-y-auto">
                    {validation.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs text-red-700 mb-1">{error}</div>
                    ))}
                    {validation.errors.length > 5 && (
                      <div className="text-xs text-gray-500">... and {validation.errors.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}
              
              {validation.warnings.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-yellow-600 mb-1">Warnings:</h5>
                  <div className="max-h-32 overflow-y-auto">
                    {validation.warnings.slice(0, 5).map((warning, index) => (
                      <div key={index} className="text-xs text-yellow-700 mb-1">{warning}</div>
                    ))}
                    {validation.warnings.length > 5 && (
                      <div className="text-xs text-gray-500">... and {validation.warnings.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-semibold text-gray-900">Data Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Advanced tools for filtering, searching, and analyzing crawled data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'filter', label: 'Filter & Sort' },
          { id: 'search', label: 'Search' },
          { id: 'insights', label: 'Insights' },
          { id: 'validation', label: 'Validation' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'filter' | 'search' | 'merge' | 'insights' | 'validation')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'filter' && renderFilterPanel()}
        {activeTab === 'search' && renderSearchPanel()}
        {activeTab === 'insights' && renderInsightsPanel()}
        {activeTab === 'validation' && renderValidationPanel()}
      </div>

      {/* Status */}
      {status && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">{status}</p>
        </div>
      )}
    </div>
  );
}

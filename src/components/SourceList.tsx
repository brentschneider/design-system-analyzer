import { FC, memo, useRef, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { 
  TrashIcon, 
  ArrowPathIcon as RefreshIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  selectSources, 
  selectSelectedSourceId, 
  selectCrawlProgress,
  removeSource,
  setSelectedSource,
  updateSourceStatus,
  updateCrawlProgress, 
  importSources
} from '../store/designSystemSlice';
import { processDesignSystem } from '../lib/api';
import { CrawlProgress, Component, DesignSystemSource } from '../types/types';

const SourceListComponent: FC = () => {
  const dispatch = useAppDispatch();
  const sources = useAppSelector(selectSources);
  const selectedSourceId = useAppSelector(selectSelectedSourceId);
  const crawlProgress = useAppSelector(selectCrawlProgress);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(sources, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'design-system-sources.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [sources]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sources = JSON.parse(e.target?.result as string);
        dispatch(importSources(sources));
      } catch (error) {
        console.error('Error importing sources:', error);
        alert('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [dispatch]);

  const handleRefresh = useCallback(async (sourceId: string) => {
    // Get the source by id
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    // Update the status to idle first
    dispatch(updateSourceStatus({ id: sourceId, status: 'idle' }));
    
    try {
      // Process the design system again
      await processDesignSystem(
        source,
        (progress: CrawlProgress) => {
          dispatch(updateSourceStatus({ id: sourceId, status: 'crawling' }));
          dispatch(updateCrawlProgress({ sourceId, progress }));
        },
        (status: DesignSystemSource['status'], error?: string) => {
          dispatch(updateSourceStatus({ id: sourceId, status, error }));
        },
        (component: Component) => {
          // TODO: Implement component handling if needed
          console.log('Component found:', component);
        }
      );
    } catch (error) {
      console.error('Error refreshing design system:', error);
      dispatch(updateSourceStatus({ 
        id: sourceId, 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during refresh'
      }));
    }
  }, [dispatch, sources]);
  
  const handleRemoveSource = useCallback((id: string) => {
    dispatch(removeSource(id));
  }, [dispatch]);

  const handleSelectSource = useCallback((id: string) => {
    dispatch(setSelectedSource(id));
  }, [dispatch]);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'crawling':
      case 'analyzing':
        return <RefreshIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  }, []);
  
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const source = sources[index];
    const progress = crawlProgress[source.id];
    
    return (
      <div
        key={source.id}
        style={style}
        className={`flex items-center p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer ${
          selectedSourceId === source.id ? 'bg-indigo-50 dark:bg-indigo-900' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        onClick={() => handleSelectSource(source.id)}
      >
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {source.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {source.url}
          </p>
          {source.status === 'crawling' && progress && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-800">
                    {Math.round(progress.pagesProcessed / progress.totalPages * 100)}%
                  </span>
                </span>
              </div>
              <div className="flex w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  style={{ width: `${progress.pagesProcessed / progress.totalPages * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"
                ></div>
              </div>
            </div>
          )}
        </div>
        
        <div className="ml-4 flex space-x-2">
          {getStatusIcon(source.status)}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh(source.id);
            }}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveSource(source.id);
            }}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <TrashIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>
    );
  }, [sources, selectedSourceId, crawlProgress, handleSelectSource, handleRemoveSource, handleRefresh, getStatusIcon]);

  // Type for the data passed to each row
  interface SourceListRowData {
    sources: DesignSystemSource[];
    selectedSourceId: string | null;
    crawlProgress: any;
    handleSelectSource: (id: string) => void;
    handleRemoveSource: (id: string) => void;
    handleRefresh: (id: string) => void;
    getStatusIcon: (status: string) => JSX.Element;
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          accept=".json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
          Import
        </button>
        <button
          onClick={handleExport}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>
      <div className="h-[calc(100%-60px)]">
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => (
            <List
              height={height}
              width={width}
              itemCount={sources.length}
              itemSize={100}
              itemData={{
                sources,
                selectedSourceId,
                crawlProgress,
                handleSelectSource,
                handleRemoveSource,
                handleRefresh,
                getStatusIcon
              }}
            >
              {({ index, style, data }: ListChildComponentProps<SourceListRowData>) => {
                const { sources, selectedSourceId, crawlProgress, handleSelectSource, handleRemoveSource, handleRefresh, getStatusIcon } = data;
                const source = sources[index];
                const progress = crawlProgress[source.id];
                return (
                  <div
                    key={source.id}
                    style={style}
                    className={`flex items-center p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer ${
                      selectedSourceId === source.id ? 'bg-indigo-50 dark:bg-indigo-900' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => handleSelectSource(source.id)}
                  >
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {source.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {source.url}
                      </p>
                      {source.status === 'crawling' && progress && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span>
                              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-800">
                                {Math.round(progress.pagesProcessed / progress.totalPages * 100)}%
                              </span>
                            </span>
                          </div>
                          <div className="flex w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div
                              style={{ width: `${progress.pagesProcessed / progress.totalPages * 100}%` }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex space-x-2">
                      {getStatusIcon(source.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefresh(source.id);
                        }}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <RefreshIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSource(source.id);
                        }}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <TrashIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              }}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
};

export const SourceList = memo(SourceListComponent);

import { FC } from 'react';
import { CrawlProgress } from '../types/types';

interface ProgressIndicatorProps {
  progress: CrawlProgress;
}

export const ProgressIndicator: FC<ProgressIndicatorProps> = ({ progress }) => {
  const percentage = Math.round((progress.pagesProcessed / progress.totalPages) * 100);
  
  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Processing {progress.currentPage}
        </span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {percentage}%
        </span>
      </div>
      
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
        <div
          className="h-2 bg-indigo-500 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{progress.pagesProcessed} pages processed</span>
        <span>{progress.componentsFound} components found</span>
      </div>
    </div>
  );
};

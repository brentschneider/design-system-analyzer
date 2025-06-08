import { FC, memo } from 'react';
import {
  TableCellsIcon,
  CodeBracketIcon,
  LinkIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { Component, ComponentProp, CodeSnippet, ComponentRelationship } from '../types/types';
import { useAppSelector } from '../store/hooks';
import { selectSelectedComponent, selectComponents } from '../store/designSystemSlice';

const ComponentViewerComponent: FC = () => {
  const selectedComponent = useAppSelector(selectSelectedComponent);
  const components = useAppSelector(selectComponents);
  
  console.log('ComponentViewer state:', { 
    hasSelectedComponent: !!selectedComponent,
    totalComponents: components.length 
  });

  if (!selectedComponent) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-500 dark:text-gray-400">Select a component to view details</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto">
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {selectedComponent.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {selectedComponent.description}
          </p>
        </div>
        
        {/* Props Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <TableCellsIcon className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Props</h3>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {selectedComponent.props.map((prop: ComponentProp) => (
                  <tr key={prop.name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {prop.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {prop.type}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {prop.required ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {prop.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Code Snippets Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <CodeBracketIcon className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Code Examples</h3>
          </div>
          <div className="space-y-4">
            {selectedComponent.codeSnippets.map((snippet: CodeSnippet, index: number) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{snippet.description}</p>
                <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto">
                  <code>{snippet.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
        
        {/* Relationships Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <LinkIcon className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Related Components</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedComponent.relationships.map((rel: ComponentRelationship) => {
              const relatedComponent = components.find((c: Component) => c.id === rel.targetComponentId);
              if (!relatedComponent) return null;
              
              return (
                <div
                  key={rel.targetComponentId}
                  className="flex items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {relatedComponent.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {rel.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Metadata Section */}
        <div>
          <div className="flex items-center mb-4">
            <InformationCircleIcon className="w-5 h-5 text-indigo-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Information</h3>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(selectedComponent.metadata).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComponentViewer = memo(ComponentViewerComponent);

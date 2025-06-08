"use client";

import { EnhancedURLInput } from "../components/EnhancedURLInput";
import { SourceList } from "../components/SourceList";
import { ComponentViewer } from "../components/ComponentViewer";
import DataManager from "../components/DataManager";
import ExportManager from "../components/ExportManager";
import { useState, useEffect } from "react";
import { ExtractedPageContent } from "../types/types";
import { autoSaveManager, convertPagesToComponents } from "../lib/dataIntegration";
import { useAppDispatch } from "../store/hooks";
import { addSource, addComponent } from "../store/designSystemSlice";

export default function Home() {
  const dispatch = useAppDispatch();
  
  // State for managing extracted page content for export/analysis
  const [extractedPages, setExtractedPages] = useState<ExtractedPageContent[]>([]);
  const [activeTab, setActiveTab] = useState<'components' | 'data' | 'export'>('components');

  // Load auto-saved data on mount
  useEffect(() => {
    const autoSavedPages = autoSaveManager.loadAutoSaved();
    if (autoSavedPages && autoSavedPages.length > 0) {
      setExtractedPages(autoSavedPages);
    }
  }, []);

  // Auto-save when pages change
  useEffect(() => {
    if (extractedPages.length > 0) {
      autoSaveManager.autoSave(extractedPages);
    }
  }, [extractedPages]);

  // Handle new URL addition to Redux store
  const handleNewUrl = (url: string, name: string) => {
    dispatch(addSource({ url, name }));
  };

  // Handle pages extracted from crawling
  const handlePagesExtracted = (pages: ExtractedPageContent[]) => {
    console.log('📄 Pages extracted:', pages.length);
    setExtractedPages(pages);
    
    // Convert pages to components and add to Redux store
    const components = convertPagesToComponents(pages);
    console.log(`🔧 Converted ${pages.length} pages to ${components.length} components:`, components);
    
    // Log component details for debugging
    components.forEach((component, index) => {
      console.log(`Component ${index + 1}:`, {
        id: component.id,
        name: component.name,
        source: component.sourceId,
        props: component.props.length,
        codeSnippets: component.codeSnippets.length
      });
    });
    
    // Add each component to the store
    components.forEach(component => {
      console.log('➕ Adding component to store:', component.name);
      dispatch(addComponent(component));
    });
    
    if (components.length > 0) {
      console.log('✅ Component extraction and storage complete!');
    } else {
      console.log('⚠️ No components were extracted from the pages');
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar */}
          <div className="col-span-12 md:col-span-4 space-y-8">
            <EnhancedURLInput 
              onPagesExtracted={handlePagesExtracted}
              onNewUrl={handleNewUrl}
            />
            <div className="h-[600px]">
              <SourceList />
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8 space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { id: 'components', label: 'Components' },
                  { id: 'data', label: 'Data Management' },
                  { id: 'export', label: 'Export & Persistence' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'components' | 'data' | 'export')}
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
            </div>

            {/* Tab Content */}
            {activeTab === 'components' && <ComponentViewer />}
            
            {activeTab === 'data' && (
              <DataManager 
                pages={extractedPages} 
                onPagesUpdate={setExtractedPages}
              />
            )}
            
            {activeTab === 'export' && (
              <ExportManager 
                pages={extractedPages} 
                onLoadPages={setExtractedPages}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { Component, DesignSystemSource, CrawlProgress } from '../types/types';
import type { RootState } from './store';

interface DesignSystemState {
  sources: DesignSystemSource[];
  components: Component[];
  crawlProgress: Record<string, CrawlProgress>;
  selectedSourceId: string | null;
  selectedComponentId: string | null;
  isDarkMode: boolean;
  isProcessing: boolean;
  error: string | null;
}

const initialState: DesignSystemState = {
  sources: [],
  components: [],
  crawlProgress: {},
  selectedSourceId: null,
  selectedComponentId: null,
  isDarkMode: false,
  isProcessing: false,
  error: null,
};

export const designSystemSlice = createSlice({
  name: 'designSystem',
  initialState,
  reducers: {
    addSource: (state, action: PayloadAction<{ url: string; name?: string }>) => {
      const id = `source-${action.payload.url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      if (!state.sources.find(s => s.id === id)) {
        state.sources.push({
          id,
          url: action.payload.url,
          name: action.payload.name || new URL(action.payload.url).hostname,
          status: 'idle'
        });
      }
    },
    removeSource: (state, action: PayloadAction<string>) => {
      state.sources = state.sources.filter(s => s.id !== action.payload);
      state.components = state.components.filter(c => c.sourceId !== action.payload);
      if (state.selectedSourceId === action.payload) {
        state.selectedSourceId = null;
      }
    },
    updateSourceStatus: (state, action: PayloadAction<{ id: string; status: DesignSystemSource['status']; error?: string }>) => {
      const source = state.sources.find(s => s.id === action.payload.id);
      if (source) {
        source.status = action.payload.status;
        source.error = action.payload.error;
        if (action.payload.status === 'complete') {
          source.lastCrawled = new Date().toISOString();
        }
      }
    },
    updateCrawlProgress: (state, action: PayloadAction<{ sourceId: string; progress: CrawlProgress }>) => {
      state.crawlProgress[action.payload.sourceId] = action.payload.progress;
    },
    addComponent: (state, action: PayloadAction<Component>) => {
      state.components.push(action.payload);
    },
    updateComponent: (state, action: PayloadAction<{ id: string; updates: Partial<Component> }>) => {
      const component = state.components.find(c => c.id === action.payload.id);
      if (component) {
        Object.assign(component, action.payload.updates);
      }
    },
    removeComponent: (state, action: PayloadAction<string>) => {
      state.components = state.components.filter(c => c.id !== action.payload);
      if (state.selectedComponentId === action.payload) {
        state.selectedComponentId = null;
      }
    },
    setSelectedSource: (state, action: PayloadAction<string | null>) => {
      state.selectedSourceId = action.payload;
    },
    setSelectedComponent: (state, action: PayloadAction<string | null>) => {
      state.selectedComponentId = action.payload;
    },
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    importSources: (state, action: PayloadAction<DesignSystemSource[]>) => {
      // Merge new sources with existing ones, avoiding duplicates by URL
      const existingSources = new Set(state.sources.map(s => s.url));
      action.payload.forEach(source => {
        if (!existingSources.has(source.url)) {
          state.sources.push({
            ...source,
            status: 'idle' // Reset status on import
          });
          existingSources.add(source.url);
        }
      });
    },
  }
});

// Base selectors
export const selectSources = (state: RootState) => state.designSystem.sources;
export const selectComponents = (state: RootState) => state.designSystem.components;
export const selectSelectedSourceId = (state: RootState) => state.designSystem.selectedSourceId;
export const selectSelectedComponentId = (state: RootState) => state.designSystem.selectedComponentId;
export const selectCrawlProgress = (state: RootState) => state.designSystem.crawlProgress;
export const selectIsDarkMode = (state: RootState) => state.designSystem.isDarkMode;
export const selectError = (state: RootState) => state.designSystem.error;

// Memoized selectors
export const selectSelectedComponent = createSelector(
  [selectComponents, selectSelectedComponentId],
  (components, selectedId) => selectedId ? components.find(c => c.id === selectedId) : null
);

export const selectSelectedSource = createSelector(
  [selectSources, selectSelectedSourceId],
  (sources, selectedId) => selectedId ? sources.find(s => s.id === selectedId) : null
);

export const selectSourceComponents = createSelector(
  [selectComponents, selectSelectedSourceId],
  (components, sourceId) => sourceId ? components.filter(c => c.sourceId === sourceId) : []
);

export const { 
  addSource, removeSource, updateSourceStatus, updateCrawlProgress,
  addComponent, updateComponent, removeComponent,
  setSelectedSource, setSelectedComponent,
  toggleDarkMode, setError,
  importSources
} = designSystemSlice.actions;

export default designSystemSlice.reducer;

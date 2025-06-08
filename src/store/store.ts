import { configureStore } from '@reduxjs/toolkit';
import designSystemReducer from './designSystemSlice';
import { loadState, saveState } from '../lib/storage';

// Only load persisted state on the client side
const persistedState = typeof window !== 'undefined' ? loadState() : undefined;

export const store = configureStore({
  reducer: {
    designSystem: designSystemReducer,
  },
  preloadedState: persistedState ? {
    designSystem: {
      ...designSystemReducer(undefined, { type: '@@INIT' }),
      ...persistedState,
      // Reset stateful fields
      crawlProgress: {},
      selectedSourceId: null,
      selectedComponentId: null,
      isProcessing: false,
      error: null,
    }
  } : undefined,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['designSystem/updateSourceStatus'],
        // Ignore these paths in the state
        ignoredPaths: ['designSystem.sources.lastCrawled'],
      },
    }),
});

// Save state on changes
store.subscribe(() => {
  const state = store.getState();
  saveState({
    sources: state.designSystem.sources,
    isDarkMode: state.designSystem.isDarkMode
  });
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

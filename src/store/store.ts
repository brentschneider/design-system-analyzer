import { configureStore } from '@reduxjs/toolkit';
import designSystemReducer from './designSystemSlice';

export const store = configureStore({
  reducer: {
    designSystem: designSystemReducer,
  },
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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

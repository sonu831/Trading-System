import { configureStore } from '@reduxjs/toolkit';
import marketReducer from './slices/marketSlice';
import signalsReducer from './slices/signalsSlice';
import systemReducer from './slices/systemSlice';

export const store = configureStore({
  reducer: {
    market: marketReducer,
    signals: signalsReducer,
    system: systemReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

import { configureStore } from '@reduxjs/toolkit';
import marketReducer from './slices/marketSlice';
import signalsReducer from './slices/signalsSlice';
import systemReducer from './slices/systemSlice';
import brokerReducer from './slices/brokerSlice';
import executionReducer from './slices/executionSlice';
import regimeReducer from './slices/regimeSlice';

export const store = configureStore({
  reducer: {
    market: marketReducer,
    signals: signalsReducer,
    system: systemReducer,
    brokers: brokerReducer,
    execution: executionReducer,
    regime: regimeReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

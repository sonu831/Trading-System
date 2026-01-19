import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  feed: [],
  lastSignalTime: null,
};

const signalsSlice = createSlice({
  name: 'signals',
  initialState,
  reducers: {
    setSignals: (state, action) => {
      state.feed = action.payload || [];
      if (state.feed.length > 0) {
        state.lastSignalTime = state.feed[0].timestamp;
      }
    },
    addSignal: (state, action) => {
      state.feed.unshift(action.payload);
      state.lastSignalTime = action.payload.timestamp;
      // Optional: Limit feed size logic could go here
    },
  },
});

export const { setSignals, addSignal } = signalsSlice.actions;

export const selectSignals = (state) => state.signals.feed;

export default signalsSlice.reducer;

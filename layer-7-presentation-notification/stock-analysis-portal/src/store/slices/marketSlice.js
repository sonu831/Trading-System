import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  indices: {},
  all_stocks: [],
  marketStatus: 'CLOSED',
  marketSentiment: 'Neutral', // Bullish | Bearish | Neutral
  advanceDecline: { advances: 0, declines: 0 },
  lastUpdated: null,
  loading: false,
  error: null,
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    setMarketData: (state, action) => {
      const { indices, all_stocks, marketStatus, timestamp, marketSentiment, advanceDecline } =
        action.payload;
      state.indices = indices || state.indices;
      state.all_stocks = all_stocks || state.all_stocks;
      state.marketStatus = marketStatus || state.marketStatus;
      state.marketSentiment = marketSentiment || state.marketSentiment;
      state.advanceDecline = advanceDecline || state.advanceDecline;
      state.lastUpdated = timestamp || new Date().toISOString();
      state.loading = false;
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setMarketData, setLoading, setError } = marketSlice.actions;

const selectMarketState = (state) => state.market;

export const selectMarketView = createSelector([selectMarketState], (market) => ({
  indices: market.indices,
  all_stocks: market.all_stocks,
  marketStatus: market.marketStatus,
  marketSentiment: market.marketSentiment,
  advanceDecline: market.advanceDecline,
  lastUpdated: market.lastUpdated,
}));
export const selectMarketLoading = (state) => state.market.loading;

export default marketSlice.reducer;

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Market regime (L5/L6) + breadth (L5).
 *
 *   GET /api/v1/regime/latest   -> RegimeState
 *   GET /api/v1/breadth/latest  -> { breadth, sectors }
 *
 * RegimeState decides which trade tiers are even permitted, so it is the single
 * most important thing on the overview. If it is stale, positional trades in
 * particular must not be trusted.
 */

const json = async (res, fallbackMsg) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || fallbackMsg);
  return data.data ?? data;
};

export const fetchRegime = createAsyncThunk('regime/fetchLatest', async () => {
  const res = await fetch('/api/v1/regime/latest');
  return json(res, 'Failed to fetch market regime');
});

export const fetchBreadth = createAsyncThunk('regime/fetchBreadth', async () => {
  const res = await fetch('/api/v1/breadth/latest');
  return json(res, 'Failed to fetch market breadth');
});

const initialState = {
  regime: null, // { trend, strength, volatility, phase, tfAlignment, tradeableTiers, confidence, timestamp }
  breadth: null, // BreadthMetrics
  sectors: null, // { [name]: SectorMetrics }
  lastUpdatedAt: null,
  loading: false,
  error: null,
  reachable: null,
};

const regimeSlice = createSlice({
  name: 'regime',
  initialState,
  reducers: {
    regimePushed: (state, action) => {
      state.regime = action.payload;
      state.lastUpdatedAt = action.payload?.timestamp || new Date().toISOString();
      state.reachable = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRegime.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRegime.fulfilled, (state, action) => {
        state.loading = false;
        state.regime = action.payload;
        state.lastUpdatedAt = action.payload?.timestamp || new Date().toISOString();
        state.reachable = true;
      })
      .addCase(fetchRegime.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.reachable = false;
      })
      .addCase(fetchBreadth.fulfilled, (state, action) => {
        state.breadth = action.payload?.breadth ?? action.payload ?? null;
        state.sectors = action.payload?.sectors ?? action.payload?.sector_performance ?? null;
      });
  },
});

export const { regimePushed } = regimeSlice.actions;

export const selectRegime = (state) => state.regime.regime;
export const selectBreadth = (state) => state.regime.breadth;
export const selectSectors = (state) => state.regime.sectors;
export const selectRegimeUpdatedAt = (state) => state.regime.lastUpdatedAt;
export const selectRegimeReachable = (state) => state.regime.reachable;

/** Which tiers the regime currently permits, e.g. ['T1','T2']. */
export const selectTradeableTiers = (state) => state.regime.regime?.tradeableTiers ?? null;

export default regimeSlice.reducer;

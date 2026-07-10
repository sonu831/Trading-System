import { createSlice } from '@reduxjs/toolkit';

const cockpitSlice = createSlice({
  name: 'cockpit',
  initialState: {
    tick: {},           // { [underlying]: { ltp, time } }
    chain: {},          // { underlying, rows, atm, spot, updatedAt }
    regime: {},         // { trend, strength, volatility, phase, timestamp }
    positions: [],      // open positions array
    staleness: {        // per-stream freshness
      tick: null, chain: null, regime: null, positions: null,
    },
  },
  reducers: {
    cockpitTickPushed: (state, action) => {
      const { underlying, ltp, time } = action.payload;
      state.tick[underlying] = { ltp, time };
      state.staleness.tick = Date.now();
    },
    cockpitChainPushed: (state, action) => {
      state.chain = { ...action.payload, updatedAt: Date.now() };
      state.staleness.chain = Date.now();
    },
    cockpitRegimePushed: (state, action) => {
      state.regime = { ...action.payload, timestamp: Date.now() };
      state.staleness.regime = Date.now();
    },
    cockpitPositionPushed: (state, action) => {
      state.positions = action.payload || [];
      state.staleness.positions = Date.now();
    },
    setStaleness: (state, action) => {
      const { stream, timestamp } = action.payload;
      state.staleness[stream] = timestamp;
    },
  },
});

export const {
  cockpitTickPushed, cockpitChainPushed, cockpitRegimePushed,
  cockpitPositionPushed, setStaleness,
} = cockpitSlice.actions;

export const selectCockpitTick = (s) => s.cockpit?.tick || {};
export const selectCockpitChain = (s) => s.cockpit?.chain || {};
export const selectCockpitRegime = (s) => s.cockpit?.regime || {};
export const selectCockpitPositions = (s) => s.cockpit?.positions || [];
export const selectStaleness = (s) => s.cockpit?.staleness || {};

export default cockpitSlice.reducer;

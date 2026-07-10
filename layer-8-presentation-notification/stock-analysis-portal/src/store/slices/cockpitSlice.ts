import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface TickData {
  ltp: number;
  time: string;
}

interface ChainData {
  underlying?: string;
  rows?: unknown[];
  atm?: number;
  spot?: number;
  updatedAt?: number;
}

interface RegimeData {
  trend?: string;
  strength?: string;
  volatility?: string;
  phase?: string;
  timestamp?: number;
}

interface CockpitState {
  tick: Record<string, TickData>;
  chain: ChainData;
  regime: RegimeData;
  positions: unknown[];
  staleness: {
    tick: number | null;
    chain: number | null;
    regime: number | null;
    positions: number | null;
  };
}

const initialState: CockpitState = {
  tick: {},
  chain: {},
  regime: {},
  positions: [],
  staleness: {
    tick: null,
    chain: null,
    regime: null,
    positions: null,
  },
};

const cockpitSlice = createSlice({
  name: 'cockpit',
  initialState,
  reducers: {
    cockpitTickPushed: (state, action: PayloadAction<{ underlying: string; ltp: number; time: string }>) => {
      const { underlying, ltp, time } = action.payload;
      state.tick[underlying] = { ltp, time };
      state.staleness.tick = Date.now();
    },
    cockpitChainPushed: (state, action: PayloadAction<ChainData>) => {
      state.chain = { ...action.payload, updatedAt: Date.now() };
      state.staleness.chain = Date.now();
    },
    cockpitRegimePushed: (state, action: PayloadAction<RegimeData>) => {
      state.regime = { ...action.payload, timestamp: Date.now() };
      state.staleness.regime = Date.now();
    },
    cockpitPositionPushed: (state, action: PayloadAction<unknown[]>) => {
      state.positions = action.payload || [];
      state.staleness.positions = Date.now();
    },
    setStaleness: (state, action: PayloadAction<{ stream: keyof CockpitState['staleness']; timestamp: number }>) => {
      const { stream, timestamp } = action.payload;
      state.staleness[stream] = timestamp;
    },
  },
});

export const {
  cockpitTickPushed, cockpitChainPushed, cockpitRegimePushed,
  cockpitPositionPushed, setStaleness,
} = cockpitSlice.actions;

interface RootState {
  cockpit?: CockpitState;
}

export const selectCockpitTick = (s: RootState) => s.cockpit?.tick || {};
export const selectCockpitChain = (s: RootState) => s.cockpit?.chain || {};
export const selectCockpitRegime = (s: RootState) => s.cockpit?.regime || {};
export const selectCockpitPositions = (s: RootState) => s.cockpit?.positions || [];
export const selectStaleness = (s: RootState) => s.cockpit?.staleness || {};

export default cockpitSlice.reducer;

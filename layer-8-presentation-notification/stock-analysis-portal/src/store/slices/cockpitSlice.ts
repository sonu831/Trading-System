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
  execution: { mode?: string; killSwitch?: boolean; lastOrder?: unknown };
  alerts: Array<{ severity: string; message: string; timestamp: string }>;
  breadth: Record<string, unknown>;
  staleness: {
    tick: number | null;
    chain: number | null;
    regime: number | null;
    positions: number | null;
    execution: number | null;
    alerts: number | null;
    breadth: number | null;
  };
}

const initialState: CockpitState = {
  tick: {},
  chain: {},
  regime: {},
  positions: [],
  execution: {},
  alerts: [],
  breadth: {},
  staleness: {
    tick: null, chain: null, regime: null, positions: null,
    execution: null, alerts: null, breadth: null,
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
    cockpitExecutionPushed: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.execution = action.payload;
      state.staleness.execution = Date.now();
    },
    cockpitAlertPushed: (state, action: PayloadAction<{ severity: string; message: string; timestamp: string }>) => {
      state.alerts = [action.payload, ...state.alerts].slice(0, 100);
      state.staleness.alerts = Date.now();
    },
    cockpitBreadthPushed: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.breadth = action.payload;
      state.staleness.breadth = Date.now();
    },
    setStaleness: (state, action: PayloadAction<{ stream: keyof CockpitState['staleness']; timestamp: number }>) => {
      const { stream, timestamp } = action.payload;
      state.staleness[stream] = timestamp;
    },
  },
});

export const {
  cockpitTickPushed, cockpitChainPushed, cockpitRegimePushed,
  cockpitPositionPushed, cockpitExecutionPushed, cockpitAlertPushed,
  cockpitBreadthPushed, setStaleness,
} = cockpitSlice.actions;

interface RootState {
  cockpit?: CockpitState;
}

export const selectCockpitTick = (s: RootState) => s.cockpit?.tick || {};
export const selectCockpitChain = (s: RootState) => s.cockpit?.chain || {};
export const selectCockpitRegime = (s: RootState) => s.cockpit?.regime || {};
export const selectCockpitPositions = (s: RootState) => s.cockpit?.positions || [];
export const selectCockpitExecution = (s: RootState) => s.cockpit?.execution || {};
export const selectCockpitAlerts = (s: RootState) => s.cockpit?.alerts || [];
export const selectCockpitBreadth = (s: RootState) => s.cockpit?.breadth || {};
export const selectStaleness = (s: RootState) => s.cockpit?.staleness || {};

export default cockpitSlice.reducer;

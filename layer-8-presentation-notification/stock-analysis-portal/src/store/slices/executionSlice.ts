import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Execution (Layer 10) state — positions, risk, trade mode, kill switch.
 *
 * Backed by L7 proxy endpoints onto the execution engine (L10, port 8095):
 *   GET  /api/v1/execution/state      -> { mode, killSwitch, positions[], risk{} }
 *   POST /api/v1/execution/kill
 *   POST /api/v1/execution/resume
 *   POST /api/v1/execution/square-off
 *
 * SAFETY: mutations never optimistically update. A UI that claims trading is
 * halted when the server never received the command is worse than no UI.
 */

const json = async (res, fallbackMsg) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || fallbackMsg);
  }
  return data.data ?? data;
};

export const fetchExecutionState = createAsyncThunk('execution/fetchState', async () => {
  const res = await fetch('/api/v1/execution/state');
  return json(res, 'Failed to fetch execution state');
});

export const activateKillSwitch = createAsyncThunk('execution/kill', async () => {
  const res = await fetch('/api/v1/execution/kill', { method: 'POST' });
  return json(res, 'Failed to activate kill switch');
});

export const resumeTrading = createAsyncThunk('execution/resume', async () => {
  const res = await fetch('/api/v1/execution/resume', { method: 'POST' });
  return json(res, 'Failed to resume trading');
});

export const squareOffAll = createAsyncThunk('execution/squareOff', async () => {
  const res = await fetch('/api/v1/execution/square-off', { method: 'POST' });
  return json(res, 'Failed to square off positions');
});

const initialState = {
  // `null` (not 0/false) until the server tells us. The UI renders "—" for null.
  mode: null, // 'paper' | 'shadow' | 'live'
  killSwitch: null, // boolean
  positions: [],
  risk: null, // { dailyState:{tradesToday,dailyLoss,totalPnl}, maxTradesPerDay, maxDailyLoss, ... }
  lastUpdatedAt: null,
  loading: false,
  mutating: false, // a kill/resume/square-off is in flight
  error: null,
  reachable: null, // null = unknown, false = engine unreachable
};

const applyState = (state, payload) => {
  state.mode = payload?.mode ?? null;
  state.killSwitch = typeof payload?.killSwitch === 'boolean' ? payload.killSwitch : null;
  state.positions = Array.isArray(payload?.positions) ? payload.positions : [];
  state.risk = payload?.risk ?? null;
  state.lastUpdatedAt = payload?.timestamp || new Date().toISOString();
  state.reachable = true;
};

const executionSlice = createSlice({
  name: 'execution',
  initialState,
  reducers: {
    // Pushed over socket.io (`execution-events` / `positions` rooms).
    executionStatePushed: (state, action) => applyState(state, action.payload),
    clearExecutionError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExecutionState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExecutionState.fulfilled, (state, action) => {
        state.loading = false;
        applyState(state, action.payload);
      })
      .addCase(fetchExecutionState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
        state.reachable = false;
      });

    // Mutations: only trust the state the server returns.
    const mutations = [activateKillSwitch, resumeTrading, squareOffAll];
    mutations.forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.mutating = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.mutating = false;
          if (action.payload && typeof action.payload === 'object') {
            if (typeof action.payload.killSwitch === 'boolean') {
              state.killSwitch = action.payload.killSwitch;
            }
            if (Array.isArray(action.payload.positions)) {
              state.positions = action.payload.positions;
            }
          }
        })
        .addCase(thunk.rejected, (state, action) => {
          state.mutating = false;
          state.error = action.error.message;
        });
    });
  },
});

export const { executionStatePushed, clearExecutionError } = executionSlice.actions;

export const selectExecution = (state) => state.execution;
export const selectTradeMode = (state) => state.execution.mode;
export const selectKillSwitch = (state) => state.execution.killSwitch;
export const selectPositions = (state) => state.execution.positions;
export const selectOpenPositions = (state) =>
  state.execution.positions.filter((p) => p.status === 'OPEN');
export const selectRisk = (state) => state.execution.risk;
export const selectExecutionReachable = (state) => state.execution.reachable;

/** Unrealised P&L across open positions; null when we have no positions data. */
export const selectUnrealisedPnl = (state) => {
  const open = state.execution.positions.filter((p) => p.status === 'OPEN');
  if (!open.length) return 0;
  const sum = open.reduce((acc, p) => acc + (Number.isFinite(p.pnl) ? p.pnl : 0), 0);
  return sum;
};

export default executionSlice.reducer;

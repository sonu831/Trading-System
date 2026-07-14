// @ts-nocheck
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'OFFLINE',
  wsStatus: 'DISCONNECTED',
  viewMode: 'LIVE',
  isBackfillModalOpen: false,
  pipeline: null,
  notifications: [],
  // Polled system stats
  dbRows: null,
  redisMem: null,
  uptimeSec: null,
  ticksPerSec: null,
  swarmStatus: null,
  // Data availability — owner can query "from which timestamp do we have data"
  dataAvailability: {
    symbols: [],
    summary: null,
    fetchedAt: null,
  },
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setSystemStatus: (state, action) => {
      state.pipeline = action.payload;
      if (action.payload?.status) state.status = action.payload.status;
      // Extract live stats from pipeline
      if (action.payload?.layers?.layer3?.metrics?.db_rows) {
        state.dbRows = action.payload.layers.layer3.metrics.db_rows;
      }
      if (action.payload?.layers?.layer1?.metrics?.type) {
        state.status = 'ONLINE';
      }
    },
    setWsStatus: (state, action) => { state.wsStatus = action.payload; },
    setViewMode: (state, action) => { state.viewMode = action.payload; },
    addNotification: (state, action) => {
      state.notifications.push({ id: Date.now(), ...action.payload, read: false });
    },
    setBackfillModalOpen: (state, action) => { state.isBackfillModalOpen = action.payload; },
    setSwarmStatus: (state, action) => { state.swarmStatus = action.payload; },
    updateSystemStats: (state, action) => {
      const { dbRows, uptimeSec, ticksPerSec } = action.payload;
      if (dbRows != null) state.dbRows = dbRows;
      if (uptimeSec != null) state.uptimeSec = uptimeSec;
      if (ticksPerSec != null) state.ticksPerSec = ticksPerSec;
    },
    setDataAvailability: (state, action) => {
      state.dataAvailability = {
        ...action.payload,
        fetchedAt: Date.now(),
      };
    },
    addToast: (state, action) => {
      const toast = {
        id: Date.now() + Math.random(),
        ...action.payload,
        timestamp: Date.now(),
      };
      state.notifications.push(toast);
    },
    dismissToast: (state, action) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
  },
});

export const {
  setSystemStatus, setViewMode, setBackfillModalOpen,
  addNotification, setSwarmStatus, updateSystemStats, setDataAvailability,
  addToast, dismissToast,
} = systemSlice.actions;

export const selectSystemStatus = (state) => state.system.status;
export const selectPipelineStatus = (state) => state.system.pipeline;
export const selectViewMode = (state) => state.system.viewMode;
export const selectBackfillModalOpen = (state) => state.system.isBackfillModalOpen;
export const selectSwarmStatus = (state) => state.system.swarmStatus;
export const selectSystemDbRows = (state) => state.system.dbRows;
export const selectSystemUptime = (state) => state.system.uptimeSec;
export const selectDataAvailability = (state) => state.system.dataAvailability;
export const selectToasts = (state) => state.system.notifications;

export default systemSlice.reducer;

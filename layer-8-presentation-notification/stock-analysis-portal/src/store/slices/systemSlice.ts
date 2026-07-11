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
  },
});

export const {
  setSystemStatus, setViewMode, setBackfillModalOpen,
  addNotification, setSwarmStatus, updateSystemStats,
} = systemSlice.actions;

export const selectSystemStatus = (state) => state.system.status;
export const selectPipelineStatus = (state) => state.system.pipeline;
export const selectViewMode = (state) => state.system.viewMode;
export const selectBackfillModalOpen = (state) => state.system.isBackfillModalOpen;
export const selectSwarmStatus = (state) => state.system.swarmStatus;
export const selectSystemDbRows = (state) => state.system.dbRows;
export const selectSystemUptime = (state) => state.system.uptimeSec;

export default systemSlice.reducer;

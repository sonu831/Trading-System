import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'OFFLINE', // ONLINE | OFFLINE
  wsStatus: 'DISCONNECTED', // CONNECTED | DISCONNECTED | RECONNECTING
  viewMode: 'LIVE', // LIVE | HISTORICAL
  isBackfillModalOpen: false,
  pipeline: null, // Full system status object
  notifications: [],
};

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setSystemStatus: (state, action) => {
      state.pipeline = action.payload;
      // If the payload has a top-level status, use it, otherwise assume ONLINE if data exists
      if (action.payload?.status) {
        state.status = action.payload.status;
      }
    },
    setWsStatus: (state, action) => {
      state.wsStatus = action.payload;
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    addNotification: (state, action) => {
      state.notifications.push({
        id: Date.now(),
        ...action.payload,
        read: false,
      });
    },
    setBackfillModalOpen: (state, action) => {
      state.isBackfillModalOpen = action.payload;
    },
  },
});

export const {
  setSystemStatus,
  setViewMode,
  setBackfillModalOpen,
  addNotification,
  markNotificationRead,
  clearNotifications,
} = systemSlice.actions;

export const selectSystemStatus = (state) => state.system.systemStatus;
export const selectPipelineStatus = (state) => state.system.pipeline;
export const selectViewMode = (state) => state.system.viewMode;
export const selectNotifications = (state) => state.system.notifications;
export const selectBackfillModalOpen = (state) => state.system.isBackfillModalOpen;

export default systemSlice.reducer;

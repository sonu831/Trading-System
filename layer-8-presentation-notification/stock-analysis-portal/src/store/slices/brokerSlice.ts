// @ts-nocheck
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchBrokers = createAsyncThunk('brokers/fetchList', async () => {
  const res = await fetch('/api/v1/providers');
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to fetch brokers');
  return data.data;
});

export const createBroker = createAsyncThunk('brokers/create', async (payload) => {
  const res = await fetch('/api/v1/providers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to create broker');
  return data.data;
});

export const updateBroker = createAsyncThunk('brokers/update', async ({ id, ...payload }) => {
  const res = await fetch(`/api/v1/providers/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to update broker');
  return data.data;
});

export const enableBroker = createAsyncThunk('brokers/enable', async (id) => {
  const res = await fetch(`/api/v1/providers/${id}/enable`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to enable broker');
  return data.data;
});

export const disableBroker = createAsyncThunk('brokers/disable', async (id) => {
  const res = await fetch(`/api/v1/providers/${id}/disable`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to disable broker');
  return data.data;
});

export const saveCredential = createAsyncThunk('brokers/saveCredential', async ({ providerId, field_name, field_value }) => {
  const res = await fetch(`/api/v1/providers/${providerId}/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_name, field_value }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to save credential');
  return { field_name };
});

const initialState = {
  list: [],
  selected: null,
  loading: false,
  error: null,
  authFlow: { step: null, jwtToken: null, refreshToken: null, feedToken: null },
};

const brokerSlice = createSlice({
  name: 'brokers',
  initialState,
  reducers: {
    setSelectedBroker: (state, action) => { state.selected = action.payload; },
    setAuthFlowStep: (state, action) => { state.authFlow.step = action.payload; },
    setAuthFlowData: (state, action) => { state.authFlow = { ...state.authFlow, ...action.payload }; },
    resetAuthFlow: (state) => { state.authFlow = { step: null, jwtToken: null, refreshToken: null, feedToken: null }; },
    clearBrokerError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrokers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchBrokers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchBrokers.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(createBroker.fulfilled, (state, action) => { state.list.push(action.payload); })
      .addCase(enableBroker.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.payload.id);
        if (idx >= 0) state.list[idx] = action.payload;
        if (state.selected?.id === action.payload.id) state.selected = action.payload;
      })
      .addCase(disableBroker.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.payload.id);
        if (idx >= 0) state.list[idx] = action.payload;
        if (state.selected?.id === action.payload.id) state.selected = action.payload;
      })
      .addCase(updateBroker.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.payload.id);
        if (idx >= 0) state.list[idx] = action.payload;
        if (state.selected?.id === action.payload.id) state.selected = action.payload;
      });
  },
});

export const { setSelectedBroker, setAuthFlowStep, setAuthFlowData, resetAuthFlow, clearBrokerError } = brokerSlice.actions;
export const selectBrokers = (state) => state.brokers.list;
export const selectBrokersLoading = (state) => state.brokers.loading;
export const selectBrokerError = (state) => state.brokers.error;
export const selectAuthFlow = (state) => state.brokers.authFlow;
export default brokerSlice.reducer;

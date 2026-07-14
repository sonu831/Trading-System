// @ts-nocheck
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { BROKER_CAPABILITIES } from '@/shared/types';

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

export const deleteBroker = createAsyncThunk('brokers/delete', async (id) => {
  const res = await fetch(`/api/v1/providers/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to delete broker');
  return id;
});

export const deleteCredential = createAsyncThunk('brokers/deleteCredential', async ({ providerId, fieldName }) => {
  const res = await fetch(`/api/v1/providers/${providerId}/credentials?field_name=${fieldName}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to delete credential');
  return { providerId, fieldName };
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

export const saveCredentialsBulk = createAsyncThunk('brokers/saveCredentialsBulk', async ({ providerId, credentials }) => {
  const res = await fetch(`/api/v1/providers/${providerId}/credentials/bulk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to save credentials');
  return { providerId, credentials };
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
      })
      .addCase(deleteBroker.fulfilled, (state, action) => {
        state.list = state.list.filter((b) => b.id !== action.payload);
        if (state.selected?.id === action.payload) state.selected = null;
      })
      .addCase(saveCredential.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.meta.arg.providerId);
        if (idx < 0) return;
        const broker = state.list[idx];
        const credIdx = broker.credentials?.findIndex((c) => c.field_name === action.meta.arg.field_name);
        if (credIdx >= 0) {
          broker.credentials[credIdx] = { ...broker.credentials[credIdx], value: '••••••••', is_active: !!action.meta.arg.field_value };
        } else {
          broker.credentials = [...(broker.credentials || []), { field_name: action.meta.arg.field_name, value: '••••••••', is_active: true }];
        }
        if (state.selected?.id === action.meta.arg.providerId) state.selected = broker;
      })
      .addCase(deleteCredential.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.payload.providerId);
        if (idx < 0) return;
        const broker = state.list[idx];
        broker.credentials = (broker.credentials || []).filter((c) => c.field_name !== action.payload.fieldName);
        if (state.selected?.id === action.payload.providerId) state.selected = broker;
      })
      .addCase(saveCredentialsBulk.fulfilled, (state, action) => {
        const idx = state.list.findIndex((b) => b.id === action.payload.providerId);
        if (idx < 0) return;
        const broker = state.list[idx];
        const newCreds = (action.payload.credentials || []).map((c) => ({
          field_name: c.field_name,
          value: c.field_value ? '••••••••' : '',
          is_active: !!c.field_value,
        }));
        const existingMap = {};
        (broker.credentials || []).forEach((c) => { existingMap[c.field_name] = c; });
        newCreds.forEach((c) => { existingMap[c.field_name] = c; });
        broker.credentials = Object.values(existingMap);
        if (state.selected?.id === action.payload.providerId) state.selected = broker;
      });
  },
});

export const { setSelectedBroker, setAuthFlowStep, setAuthFlowData, resetAuthFlow, clearBrokerError } = brokerSlice.actions;
export const selectBrokers = (state) => state.brokers.list;
export const selectBrokersLoading = (state) => state.brokers.loading;
export const selectBrokerError = (state) => state.brokers.error;
export const selectAuthFlow = (state) => state.brokers.authFlow;

/**
 * Select the valid execution broker — only a broker with restingStop capability
 * AND the 'execution' or 'both' role qualifies as the OMS executor.
 * mStock has restingStop:false and must NEVER be the OMS executor.
 */
export const selectExecutorBroker = (state) => {
  const brokers = state.brokers.list || [];
  return brokers.find(
    (b) => b.enabled !== false
      && (b.role === 'execution' || b.role === 'both')
      && BROKER_CAPABILITIES[b.provider]?.restingStop === true
  ) || null;
};

/**
 * Select the feed broker (highest priority data source).
 */
export const selectFeedBroker = (state) => {
  const brokers = state.brokers.list || [];
  return brokers
    .filter((b) => b.enabled !== false && (b.role === 'data' || b.role === 'both'))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))[0] || null;
};
export default brokerSlice.reducer;

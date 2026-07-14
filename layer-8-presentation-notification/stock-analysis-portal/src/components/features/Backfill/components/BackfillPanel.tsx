// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Input, Button, Badge } from '@/components/ui';
import { Table } from '@/components/molecules';
import { selectPipelineStatus, addToast } from '@/store/slices/systemSlice';
import BackfillProgress from '@/components/features/Backfill/components/BackfillProgress';

const API_URL = '';
const MAX_DAYS = 30;

export default function BackfillPanel() {
  const dispatch = useDispatch();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [coverage, setCoverage] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(true);
  const [jobStatus, setJobStatus] = useState(null);

  const pipelineStatus = useSelector(selectPipelineStatus);
  const backfillStatus = pipelineStatus?.layers?.layer1?.backfill;

  const toast = (type, text, title) => dispatch(addToast({ type, text, title }));

  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    setToDate(today.toISOString().split('T')[0]);
    setFromDate(weekAgo.toISOString().split('T')[0]);
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/data/availability`);
      const data = await res.json();
      setCoverage(data.data?.symbols || []);
      setLoadingCoverage(false);
    } catch (e) {
      console.error('Failed to fetch coverage:', e);
      setLoadingCoverage(false);
      toast('error', e.message, 'Coverage fetch failed');
    }
  };

  const validateDateRange = () => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_DAYS) {
      toast('warning', `Date range cannot exceed ${MAX_DAYS} days`, 'Invalid range');
      return false;
    }
    if (from > to) {
      toast('warning', 'From date must be before To date', 'Invalid range');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateDateRange()) return;

    setLoading(true);
    setJobStatus(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate, toDate, symbol: symbol || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setJobStatus({
          jobId: data.data?.jobId,
          from: fromDate, to: toDate,
          symbol: symbol || 'ALL (Nifty 50)',
          status: 'STARTED',
          timestamp: new Date().toISOString(),
        });
        toast('success', `Job ${data.data?.jobId?.slice(0, 8)} started`, 'Backfill triggered');
        setTimeout(fetchCoverage, 5000);
      } else {
        toast('error', data.error || 'Failed to start backfill', 'Backfill error');
      }
    } catch (e) {
      toast('error', 'Network error — API unreachable', 'Backfill failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A');
  const formatDateTime = (dateStr) => (dateStr ? new Date(dateStr).toLocaleString() : 'N/A');

  return (
    <Card className="border-border bg-surface">
      <h2 className="text-xl font-bold text-text-primary mb-4">📥 Historical Data Backfill</h2>

      {backfillStatus && (
        <BackfillProgress
          status={backfillStatus.status}
          progress={backfillStatus.progress}
          details={backfillStatus.details}
        />
      )}

      <form onSubmit={handleSubmit} className="bg-background/50 p-4 rounded-lg border border-border mb-4">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <Input label="From Date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required className="flex-1" />
          <Input label="To Date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required className="flex-1" />
          <Input label="Symbol (optional)" type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="e.g., RELIANCE" helperText="Leave empty for all Nifty 50 stocks" className="flex-1" />
        </div>

        <Button type="submit" disabled={loading || backfillStatus?.status === 'running' || backfillStatus?.status === 1} loading={loading} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90">
          {loading ? 'Starting...' : backfillStatus?.status === 'running' || backfillStatus?.status === 1 ? '⏳ Backfill in Progress...' : '🚀 Start Backfill'}
        </Button>
        <p className="text-xs text-text-tertiary mt-2">Max {MAX_DAYS} days range.</p>
      </form>

      {jobStatus && (
        <div className="bg-background/50 p-4 rounded-lg border border-border mb-4">
          <h3 className="text-lg font-bold text-text-secondary mb-3">⚡ Job Status</h3>
          <Table className="w-full">
            <Table.Body className="text-sm">
              <Table.Row><Table.Cell className="text-text-tertiary w-32 py-1">Job ID:</Table.Cell><Table.Cell className="font-mono text-primary py-1">{jobStatus.jobId}</Table.Cell></Table.Row>
              <Table.Row><Table.Cell className="text-text-tertiary py-1">Symbols:</Table.Cell><Table.Cell className="py-1">{jobStatus.symbol}</Table.Cell></Table.Row>
              <Table.Row><Table.Cell className="text-text-tertiary py-1">Range:</Table.Cell><Table.Cell className="py-1">{jobStatus.from} to {jobStatus.to}</Table.Cell></Table.Row>
              <Table.Row><Table.Cell className="text-text-tertiary py-1">Status:</Table.Cell><Table.Cell className="py-1"><Badge variant="info" size="sm">{jobStatus.status}</Badge></Table.Cell></Table.Row>
              <Table.Row><Table.Cell className="text-text-tertiary py-1">Started:</Table.Cell><Table.Cell className="py-1">{formatDateTime(jobStatus.timestamp)}</Table.Cell></Table.Row>
            </Table.Body>
          </Table>
        </div>
      )}

      <h3 className="text-lg font-bold text-text-secondary mb-3 mt-6">📊 Current Data Coverage</h3>
      {loadingCoverage ? (
        <p className="text-text-tertiary">Loading coverage data...</p>
      ) : coverage.length === 0 ? (
        <p className="text-text-tertiary">No historical data found. Run a backfill to populate.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-6 mb-3 p-3 bg-background/50 rounded border border-border">
            <span className="text-text-secondary text-sm">Total Symbols: <strong className="text-text-primary">{coverage.length}</strong></span>
            <span className="text-text-secondary text-sm">Total Candles: <strong className="text-text-primary">{coverage.reduce((sum, item) => sum + (item.total_candles || 0), 0).toLocaleString()}</strong></span>
          </div>
          <Table className="w-full">
            <Table.Header>
              <Table.Row className="bg-background text-text-tertiary uppercase text-xs">
                <Table.HeaderCell className="px-4 py-2">Symbol</Table.HeaderCell>
                <Table.HeaderCell className="px-4 py-2">Earliest</Table.HeaderCell>
                <Table.HeaderCell className="px-4 py-2">Latest</Table.HeaderCell>
                <Table.HeaderCell className="px-4 py-2">Candles</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body className="divide-y divide-border text-sm">
              {coverage.slice(0, 10).map((item) => (
                <Table.Row key={item.symbol} className="hover:bg-surface-hover">
                  <Table.Cell className="px-4 py-2 font-bold text-primary">{item.symbol}</Table.Cell>
                  <Table.Cell className="px-4 py-2 text-text-secondary">{formatDate(item.earliest)}</Table.Cell>
                  <Table.Cell className="px-4 py-2 text-text-secondary">{formatDate(item.latest)}</Table.Cell>
                  <Table.Cell className="px-4 py-2 font-mono">{item.total_candles?.toLocaleString()}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {coverage.length > 10 && <p className="text-xs text-text-tertiary mt-2">Showing 10 of {coverage.length} symbols</p>}
        </div>
      )}
    </Card>
  );
}

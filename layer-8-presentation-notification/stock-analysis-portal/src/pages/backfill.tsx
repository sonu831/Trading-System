// @ts-nocheck
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import { selectPipelineStatus } from '@/store/slices/systemSlice';
import useBackfillManager from '@/hooks/useBackfillManager';
import { Database, RefreshCw, Zap, AlertTriangle, CheckCircle2, Clock, Download, BarChart3, Play } from 'lucide-react';

const CANDLE_THRESHOLD = { HEALTHY: 50000, WARNING: 20000 };

function ProviderStatusBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/v1/providers');
        const data = await res.json();
        const providers = data.data || [];
        const mstock = providers.find((p) => p.provider === 'mstock');
        setStatus(mstock ? { status: mstock.status, enabled: mstock.enabled } : null);
      } catch (_) { setStatus(null); }
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  if (!status) return (
    <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-xs">
      ⚠️ No mStock provider configured — <a href="/brokers" className="underline">add one in Broker settings</a>
    </div>
  );

  if (status.status === 'CONNECTED') return (
    <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
      <CheckCircle2 size={14} /> mStock session active — ready for backfill
    </div>
  );

  return (
    <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
      <div className="flex items-center gap-2 font-semibold mb-1">
        <AlertTriangle size={14} /> mStock session: {status.status || 'UNKNOWN'}
      </div>
      <p>mStock requires TOTP authentication before pulling data. Go to <a href="/brokers" className="underline">Broker settings</a>, select mStock, enter credentials and TOTP to establish a session. Until then, backfill will return 0 candles.</p>
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className="bg-surface-hover rounded-lg p-3 text-center">
      {Icon && <Icon size={16} className={`mx-auto mb-1 ${tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'err' ? 'text-error' : 'text-text-tertiary'}`} />}
      <div className={`text-xl font-extrabold tabular-nums ${tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'err' ? 'text-error' : 'text-text-primary'}`}>{value}</div>
      <div className="text-[10px] uppercase text-text-tertiary tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function SymbolRow({ item, backfillInProgress, onBackfill }) {
  const getStatus = (candles, status) => {
    if (status === 'unpopulated') return 'unpopulated';
    return candles >= CANDLE_THRESHOLD.HEALTHY ? 'healthy' : candles >= CANDLE_THRESHOLD.WARNING ? 'warning' : 'critical';
  };
  const status = getStatus(item.total_candles || 0, item.status);
  return (
    <tr className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${status === 'critical' ? 'bg-error/5' : status === 'warning' ? 'bg-warning/5' : status === 'unpopulated' ? 'bg-surface-hover/30' : ''}`}>
      <td className="px-4 py-3">
        <span className="font-bold text-text-primary">{item.symbol}</span>
        {item.sector && <span className="text-[10px] text-text-tertiary ml-1.5">{item.sector}</span>}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-text-secondary">
        {item.first_date ? new Date(item.first_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-text-tertiary">—</span>}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-text-secondary">
        {item.last_date ? new Date(item.last_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-text-tertiary">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`tabular-nums font-bold text-sm ${status === 'healthy' ? 'text-success' : status === 'warning' ? 'text-warning' : status === 'unpopulated' ? 'text-text-tertiary' : 'text-error'}`}>
          {(item.total_candles || 0).toLocaleString()}
        </span>
        {item.gaps?.length > 0 && <span className="text-[10px] text-warning ml-1">· {item.gaps.length} gap{item.gaps.length > 1 ? 's' : ''}</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`badge text-[10px] font-bold px-2 py-1 rounded-full border ${status === 'healthy' ? 'badge-ok' : status === 'warning' ? 'badge-warn' : status === 'unpopulated' ? 'badge-muted' : 'badge-err'}`}>
          {status === 'healthy' ? '✓ Synced' : status === 'warning' ? '⚠ Partial' : status === 'unpopulated' ? '○ Unpopulated' : '✗ Lagging'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => onBackfill(item.symbol)} disabled={backfillInProgress[item.symbol]}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition ${backfillInProgress[item.symbol] ? 'bg-surface-hover text-text-tertiary cursor-wait' : 'bg-primary/15 text-primary hover:bg-primary/25'}`}>
          {backfillInProgress[item.symbol] ? <RefreshCw size={12} className="inline animate-spin mr-1" /> : <Download size={12} className="inline mr-1" />}
          {backfillInProgress[item.symbol] ? 'Running' : 'Backfill'}
        </button>
      </td>
    </tr>
  );
}

export default function BackfillPage() {
  const pipeline = useSelector(selectPipelineStatus);
  const backfillData = pipeline?.layers?.layer1?.backfill;
  const {
    symbols, loading, error, summary, laggingSymbols, isDialogOpen, backfillInProgress,
    activeJobId, jobStatus,
    handleSort, fetchCoverage, triggerBackfill, triggerBulkBackfill, openBackfillDialog, closeDialog,
  } = useBackfillManager();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [bulkFromDate, setBulkFromDate] = useState('');
  const [bulkToDate, setBulkToDate] = useState('');
  const [showBulkDlg, setShowBulkDlg] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  React.useEffect(() => {
    const today = new Date();
    const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 5);
    setToDate(today.toISOString().split('T')[0]);
    setFromDate(yearAgo.toISOString().split('T')[0]);
    setBulkToDate(today.toISOString().split('T')[0]);
    setBulkFromDate(yearAgo.toISOString().split('T')[0]);
  }, []);

  const openDlg = (sym) => { setSelectedSymbol(sym); openBackfillDialog(sym); };
  const closeDlg = () => { setSelectedSymbol(null); closeDialog(); };

  const handleSingleBackfill = () => {
    if (selectedSymbol && fromDate && toDate) triggerBackfill(selectedSymbol, fromDate, toDate);
  };

  const handleBulkBackfill = () => {
    if (bulkFromDate && bulkToDate) { triggerBulkBackfill(bulkFromDate, bulkToDate); setShowBulkDlg(false); }
  };

  return (
    <AppShell>
      <Head><title>Backfill Manager | Trading System</title></Head>

      <div className="flex items-baseline gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">📊 Backfill Manager</h1>
          <span className="text-sm text-text-tertiary">Historical data coverage · MStock API · 5-year retention</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={fetchCoverage} className="btn-primary text-xs" disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowBulkDlg(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-emerald-500/25 transition">
            🚀 Bulk ({laggingSymbols.length})
          </button>
        </div>
      </div>

      {/* LIVE BACKFILL STATUS — polls GET /api/v1/backfill/:jobId every 2s */}
      {jobStatus && jobStatus.status !== 'COMPLETED' && jobStatus.status !== 'FAILED' && (
        <div className="card mb-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-bold">Backfill running · Job {activeJobId?.slice(0, 8)}</span>
            <span className="text-xs text-text-tertiary ml-auto">
              {jobStatus.processed != null ? `${(jobStatus.processed || 0).toLocaleString()} / ${(jobStatus.total_records || '?').toLocaleString()} records` : `${jobStatus.status || 'PENDING'}`}
            </span>
          </div>
          {jobStatus.total_records > 0 && (
            <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                style={{ width: `${Math.min(100, ((jobStatus.processed || 0) / jobStatus.total_records) * 100)}%` }} />
            </div>
          )}
          <div className="flex justify-between text-[11px] text-text-tertiary mt-2">
            <span>{jobStatus.symbols?.join(', ') || 'All symbols'}</span>
            <span>{jobStatus.started_at ? new Date(jobStatus.started_at).toLocaleTimeString() : ''}</span>
          </div>
          {jobStatus.errors?.length > 0 && (
            <div className="mt-2 p-2 rounded bg-error/10 border border-error/20 text-error text-[11px]">
              ⚠️ {jobStatus.errors.length} error{jobStatus.errors.length > 1 ? 's' : ''}: {jobStatus.errors.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* STATS GRID */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <StatBadge icon={BarChart3} label="Total symbols" value={summary.totalSymbols} />
        <StatBadge icon={CheckCircle2} label="Healthy" value={summary.healthyCount} tone="ok" />
        <StatBadge icon={AlertTriangle} label="Warning" value={summary.warningCount} tone="warn" />
        <StatBadge icon={AlertTriangle} label="Critical" value={summary.criticalCount} tone="err" />
        <StatBadge icon={Database} label="Total candles" value={summary.totalCandles.toLocaleString()} />
        <StatBadge icon={Clock} label="Earliest data" value={symbols.length ? new Date(Math.min(...symbols.filter(s => s.first_date).map(s => new Date(s.first_date).getTime()))).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' }) : '—'} />
      </div>

      {/* MESSAGE */}
      <ProviderStatusBanner />

      {/* ERROR */}
      {error && (
        <div className="card text-center py-8 mb-4">
          <div className="text-error text-lg mb-2">❌ Error Loading Data</div>
          <p className="text-text-secondary text-sm mb-3">{error}</p>
          <button onClick={fetchCoverage} className="text-xs font-semibold px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition">Retry</button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="card text-center py-10">
          <RefreshCw size={24} className="animate-spin mx-auto text-text-tertiary mb-2" />
          <span className="text-text-tertiary text-sm">Loading data coverage...</span>
        </div>
      )}

      {/* SYMBOL TABLE */}
      {!loading && !error && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold">📈 Symbol Coverage</h2>
            <span className="text-[11px] text-text-tertiary">{symbols.length} of {summary.totalSymbols} symbols</span>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  <th className="px-4 py-2.5 cursor-pointer hover:text-text-primary text-left" onClick={() => handleSort('symbol')}>Symbol</th>
                  <th className="px-4 py-2.5 cursor-pointer hover:text-text-primary text-left" onClick={() => handleSort('first_date')}>Earliest</th>
                  <th className="px-4 py-2.5 cursor-pointer hover:text-text-primary text-left" onClick={() => handleSort('last_date')}>Latest</th>
                  <th className="px-4 py-2.5 cursor-pointer hover:text-text-primary text-right" onClick={() => handleSort('total_candles')}>Candles</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((item) => (
                  <SymbolRow key={item.symbol} item={item} backfillInProgress={backfillInProgress} onBackfill={openDlg} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SINGLE BACKFILL MODAL */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeDlg}>
          <div className="card max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">📥 Backfill {selectedSymbol}</h3>
              <button onClick={closeDlg} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
            </div>
            <p className="text-xs text-text-secondary mb-4">Fetch 1-minute candles from MStock historical API. Already-covered date ranges are skipped automatically.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">From Date</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-text-tertiary block mb-1">To Date</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" />
              </div>
            </div>
            <p className="text-[11px] text-text-tertiary mb-4">⚠️ Large date ranges are chunked into 2-day windows (750 candles each) to respect API limits.</p>
            <div className="flex gap-3">
              <button onClick={closeDlg} className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary text-sm transition">Cancel</button>
              <button onClick={handleSingleBackfill} disabled={!fromDate || !toDate}
                className="btn-primary flex-1 justify-center text-sm">🚀 Start Backfill</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK BACKFILL MODAL */}
      {showBulkDlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkDlg(false)}>
          <div className="card max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">🚀 Bulk Backfill · {laggingSymbols.length} symbols</h3>
              <button onClick={() => setShowBulkDlg(false)} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
            </div>
            <div className="bg-surface-hover rounded-lg p-3 mb-4 max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
              {laggingSymbols.map((s) => (
                <span key={s.symbol} className={`badge text-[10px] font-bold px-2 py-1 rounded-full border ${s.status === 'critical' ? 'badge-err' : 'badge-warn'}`}>{s.symbol}</span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-[11px] text-text-tertiary block mb-1">From Date</label><input type="date" value={bulkFromDate} onChange={(e) => setBulkFromDate(e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" /></div>
              <div><label className="text-[11px] text-text-tertiary block mb-1">To Date</label><input type="date" value={bulkToDate} onChange={(e) => setBulkToDate(e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" /></div>
            </div>
            <p className="text-[11px] text-text-tertiary mb-4">⚠️ This triggers backfill for all {laggingSymbols.length} lagging symbols. Smart chunking skips gaps already covered.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkDlg(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary text-sm transition">Cancel</button>
              <button onClick={handleBulkBackfill} disabled={!bulkFromDate || !bulkToDate}
                className="btn-primary flex-1 justify-center text-sm">🚀 Start All</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

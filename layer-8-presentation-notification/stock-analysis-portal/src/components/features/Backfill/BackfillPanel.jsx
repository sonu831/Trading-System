import React from 'react';
import { Card } from '@/components/ui';
import BackfillProgress from './components/BackfillProgress';
import { useBackfillLogic } from '@/hooks/features/backfill/useBackfillLogic';
import { BackfillForm } from './BackfillForm';
import { BackfillCoverage } from './BackfillCoverage';
import { BackfillStatus } from './BackfillStatus';

export const BackfillPanel = () => {
  const {
    fromDate, setFromDate,
    toDate, setToDate,
    symbol, setSymbol,
    force, setForce,
    loading,
    message,
    coverage,
    loadingCoverage,
    jobStatus,
    backfillStatus,
    triggerBackfill,
    MAX_DAYS
  } = useBackfillLogic();

  return (
    <Card className="border-white/10 bg-slate-900 shadow-2xl backdrop-blur-md">
      <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
        📥 Historical Data Backfill
      </h2>

      {/* Global Progress Indicator */}
      {backfillStatus && (
        <BackfillProgress
          status={backfillStatus.status}
          progress={backfillStatus.progress}
          details={backfillStatus.details}
          logs={backfillStatus.logs}
        />
      )}

      {/* Input Form */}
      <BackfillForm
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        symbol={symbol} setSymbol={setSymbol}
        force={force} setForce={setForce}
        onSubmit={triggerBackfill}
        loading={loading}
        isActive={backfillStatus && (backfillStatus.status === 'running' || backfillStatus.status === 1)}
        maxDays={MAX_DAYS}
      />

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg mb-4 border text-sm font-medium ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Job Status Details */}
      <BackfillStatus jobStatus={jobStatus} />

      {/* Data Coverage Table */}
      <BackfillCoverage coverage={coverage} loading={loadingCoverage} />
    </Card>
  );
};

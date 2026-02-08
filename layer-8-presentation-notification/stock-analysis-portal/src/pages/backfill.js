import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import useBackfillManager from '../hooks/useBackfillManager';
import BackfillManager from '../components/features/BackfillManager';

/**
 * Backfill Manager Page
 * Dedicated page for managing historical data backfills
 */
export default function BackfillPage() {
  const {
    symbols,
    loading,
    error,
    summary,
    laggingSymbols,
    selectedSymbol,
    isDialogOpen,
    backfillInProgress,
    message,
    sortConfig,
    handleSort,
    fetchCoverage,
    triggerBackfill,
    triggerBulkBackfill,
    openBackfillDialog,
    closeDialog,
    setMessage,
  } = useBackfillManager();

  return (
    <>
      <Head>
        <title>Backfill Manager | Trading System</title>
        <meta name="description" content="Manage historical data backfills for Nifty 50 stocks" />
      </Head>

      <AppLayout>
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <BackfillManager
            symbols={symbols}
            loading={loading}
            error={error}
            summary={summary}
            laggingSymbols={laggingSymbols}
            selectedSymbol={selectedSymbol}
            isDialogOpen={isDialogOpen}
            backfillInProgress={backfillInProgress}
            message={message}
            sortConfig={sortConfig}
            onSort={handleSort}
            onRefresh={fetchCoverage}
            onTriggerBackfill={triggerBackfill}
            onTriggerBulkBackfill={triggerBulkBackfill}
            onOpenDialog={openBackfillDialog}
            onCloseDialog={closeDialog}
            onClearMessage={() => setMessage(null)}
          />
        </div>
      </AppLayout>
    </>
  );
}

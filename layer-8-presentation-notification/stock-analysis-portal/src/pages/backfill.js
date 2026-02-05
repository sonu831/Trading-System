import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
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

      <main className="min-h-screen bg-background text-text-primary">
        {/* Navigation Header */}
        <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <nav className="flex items-center gap-4">
              <Link 
                href="/" 
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Dashboard
              </Link>
              <span className="text-border">|</span>
              <Link 
                href="/system" 
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                System Pipeline
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <a
                href="/grafana/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-tertiary hover:text-primary transition-colors"
              >
                📊 Grafana
              </a>
              <a
                href="/kafka/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-tertiary hover:text-primary transition-colors"
              >
                📨 Kafka UI
              </a>
            </div>
          </div>
        </header>

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

        {/* Footer */}
        <footer className="border-t border-border py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-text-tertiary text-xs">
            Trading System • Layer 8: Presentation & Notification
          </div>
        </footer>
      </main>
    </>
  );
}

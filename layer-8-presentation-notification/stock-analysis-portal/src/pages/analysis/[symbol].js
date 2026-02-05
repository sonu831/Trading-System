import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useAnalysis from '@/hooks/useAnalysis';
import {
  StockChart,
  IndicatorPanel,
  TimeframeSelector,
  MultiTimeframeSummary,
} from '@/components/features/Analysis';
import { Card, Badge } from '@/components/ui';

/**
 * Stock Detail & Technical Analysis Page
 * Dynamic route: /analysis/[symbol]
 */
export default function AnalysisPage() {
  const router = useRouter();
  const { symbol: symbolParam } = router.query;

  const {
    symbol,
    interval,
    candleData,
    indicators,
    summary,
    overview,
    multiTF,
    loading,
    error,
    changeInterval,
    refresh,
  } = useAnalysis(symbolParam);

  const getSignalBadgeColor = (color) => {
    switch (color) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'warning';
    }
  };

  return (
    <>
      <Head>
        <title>{symbol ? `${symbol} Analysis` : 'Stock Analysis'} | Trading System</title>
        <meta name="description" content={`Technical analysis and charts for ${symbol}`} />
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
                System
              </Link>
            </nav>
            <button
              onClick={refresh}
              className="text-sm text-text-tertiary hover:text-primary transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Stock Header */}
          <Card className="border-border bg-surface p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-primary">{symbol || 'Loading...'}</h1>
                {overview && (
                  <>
                    <span className="text-2xl font-mono text-text-primary">
                      ₹{overview.price?.toFixed(2)}
                    </span>
                    <span
                      className={`text-lg font-bold ${overview.changePct >= 0 ? 'text-success' : 'text-error'}`}
                    >
                      {overview.changePct >= 0 ? '+' : ''}
                      {overview.changePct?.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                {summary?.signalBadge && (
                  <Badge variant={getSignalBadgeColor(summary.signalBadge.color)} size="lg">
                    {summary.signalBadge.signal}
                  </Badge>
                )}
                {summary?.trendState && (
                  <span className="text-sm text-text-tertiary">
                    RSI: <span className="font-mono">{summary.latestRSI?.toFixed(1)}</span>
                    <span className="ml-1 text-text-secondary">({summary.trendState})</span>
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Timeframe Selector */}
          <div className="flex items-center justify-between gap-4">
            <TimeframeSelector
              selected={interval}
              onChange={changeInterval}
              disabled={loading}
            />
            {loading && (
              <span className="text-sm text-text-tertiary flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Loading...
              </span>
            )}
          </div>

          {/* Error State */}
          {error && (
            <Card className="border-error bg-error/10 p-6 text-center">
              <p className="text-error">❌ {error}</p>
              <button
                onClick={refresh}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Try Again
              </button>
            </Card>
          )}

          {/* Main Chart */}
          {!error && (
            <Card className="border-border bg-surface overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-secondary">
                  {symbol} - {interval.toUpperCase()} Chart
                </h2>
                <span className="text-xs text-text-tertiary">
                  {candleData.length} candles
                </span>
              </div>
              <div className="p-2">
                <StockChart candles={candleData} indicators={indicators} height={450} />
              </div>
            </Card>
          )}

          {/* Indicator Panels */}
          {!error && indicators && (
            <IndicatorPanel candles={candleData} indicators={indicators} height={120} />
          )}

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Multi-Timeframe Summary */}
            <MultiTimeframeSummary data={multiTF} />

            {/* Signal Breakdown */}
            {summary && (
              <Card className="border-border bg-surface p-4">
                <h3 className="text-sm font-bold text-text-primary mb-4">Signal Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">RSI (14)</span>
                    <span
                      className={`font-mono ${
                        summary.latestRSI > 70
                          ? 'text-error'
                          : summary.latestRSI < 30
                            ? 'text-success'
                            : 'text-text-primary'
                      }`}
                    >
                      {summary.latestRSI?.toFixed(1)} ({summary.trendState})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Trend Direction</span>
                    <span className="text-text-primary">{summary.trendState}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Signal</span>
                    <Badge variant={getSignalBadgeColor(summary.signalBadge?.color)}>
                      {summary.signalBadge?.signal}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-text-tertiary text-xs">
            Trading System • Technical Analysis Dashboard
          </div>
        </footer>
      </main>
    </>
  );
}

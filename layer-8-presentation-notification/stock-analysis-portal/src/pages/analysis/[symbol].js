import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import useAnalysis from '@/hooks/analysis/useAnalysis';
import {
  StockChart,
  IndicatorPanel,
  TimeframeSelector,
  MultiTimeframeSummary,
  EnhancedMultiTFSummary,
  CandlePatternBadges,
  PCRPanel,
  AIPredictionPanel,
  BacktestPanel,
  IndicatorOverlayToggle,
} from '@/components/Analysis';
import { Card, Badge, Button } from '@/components/ui';
import { PageHeader, EmptyState, ErrorBoundary } from '@/components/common';

/**
 * Stock Detail & Technical Analysis Page
 * Enhanced with multi-factor analysis, AI predictions, and backtesting
 * Dynamic route: /analysis/[symbol]
 */
export default function AnalysisPage() {
  const router = useRouter();
  const { symbol: symbolParam } = router.query;

  // Chart overlay state
  const [overlays, setOverlays] = useState({
    ema: true,
    bollinger: false,
    supertrend: false,
    volume: true,
    support: false,
  });

  const {
    symbol,
    interval,
    candleData,
    indicators,
    summary,
    patterns,
    overview,
    multiTF,
    enhancedMultiTF,
    optionsData,
    loading,
    error,
    changeInterval,
    refresh,
    refreshAll,
    // AI Prediction
    aiPrediction,
    aiLoading,
    aiError,
    fetchAIPrediction,
    // Backtest
    backtestResults,
    backtestLoading,
    backtestError,
    fetchBacktest,
    clearBacktest,
  } = useAnalysis(symbolParam);

  const handleOverlayToggle = useCallback((key) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleFetchAI = useCallback(() => {
    if (symbol) {
      fetchAIPrediction(symbol);
    }
  }, [symbol, fetchAIPrediction]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-8 flex items-center justify-center">
        <EmptyState
          icon="❌"
          title="Analysis Failed"
          description={error || "Could not load analysis data."}
          actionLabel="Try Again"
          onAction={refresh}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Head>
        <title>{symbol ? `${symbol} Analysis` : 'Stock Analysis'} | Trading System</title>
        <meta name="description" content={`Technical analysis and charts for ${symbol}`} />
      </Head>

      <main className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
        {/* Navigation Header */}
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-slate-400 hover:text-slate-100 transition-colors font-medium flex items-center gap-2"
              >
                ← Dashboard
              </Link>
              <span className="text-slate-700">|</span>
              <Link
                href="/system"
                className="text-slate-400 hover:text-slate-100 transition-colors font-medium"
              >
                System
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshAll}
                className="text-slate-400 hover:text-indigo-400"
              >
                🔄 Refresh All
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Stock Header Card */}
          <Card variant="glass" className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white tracking-tight">{symbol || 'Loading...'}</h1>
                {overview && (
                  <>
                    <span className="text-2xl font-mono text-slate-200">
                      ₹{overview.price?.toFixed(2)}
                    </span>
                    <span
                      className={`text-lg font-bold ${overview.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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
                  <span className="text-sm text-slate-400">
                    RSI: <span className="font-mono text-slate-200">{summary.latestRSI?.toFixed(1)}</span>
                    <span className="ml-1 text-slate-500">({summary.trendState})</span>
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Timeframe Selector + Overlay Toggles */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TimeframeSelector
              selected={interval}
              onChange={changeInterval}
              disabled={loading}
            />
            <IndicatorOverlayToggle overlays={overlays} onToggle={handleOverlayToggle} />
            {loading && (
              <span className="text-sm text-indigo-400 flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Updating Analysis...
              </span>
            )}
          </div>

          {/* Main Chart */}
          <Card variant="glass" padding="none" className="overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                {symbol} - {interval.toUpperCase()} Chart
              </h2>
              <span className="text-xs text-slate-600 font-mono">
                {candleData?.length || 0} candles
              </span>
            </div>
            <div className="p-2 bg-slate-900/50">
               {loading && !candleData.length ? (
                 <div className="h-[450px] flex items-center justify-center text-slate-500">
                   Loading Chart Data...
                 </div>
               ) : (
                <StockChart
                  candles={candleData}
                  indicators={indicators}
                  height={450}
                  showEMA={overlays.ema}
                  showBollinger={overlays.bollinger}
                  showSupertrend={overlays.supertrend}
                  showVolume={overlays.volume}
                  showSupportResistance={overlays.support}
                />
               )}
            </div>
          </Card>

          {/* Candle Pattern Badges */}
          <CandlePatternBadges patterns={patterns} maxDisplay={5} />

          {/* Indicator Panels (RSI, MACD, Volume) */}
          {indicators && (
            <IndicatorPanel candles={candleData} indicators={indicators} height={120} interval={interval} />
          )}

          {/* Multi-Timeframe Analysis Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhanced Multi-TF Summary (spans 2 cols) */}
            <div className="lg:col-span-2">
              <EnhancedMultiTFSummary data={enhancedMultiTF} />
            </div>

            {/* Signal Breakdown */}
            {summary && (
              <Card variant="glass" className="p-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Signal Breakdown
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-mono normal-case">
                    {interval}
                  </span>
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-slate-400 text-sm">RSI (14)</span>
                    <span
                      className={`font-mono font-bold ${
                        summary.latestRSI > 70
                          ? 'text-rose-400'
                          : summary.latestRSI < 30
                            ? 'text-emerald-400'
                            : 'text-slate-200'
                      }`}
                    >
                      {summary.latestRSI?.toFixed(1)} <span className="text-xs text-slate-500 font-sans ml-1">({summary.trendState})</span>
                    </span>
                  </div>
                  {indicators?.macd && (
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-slate-400 text-sm">MACD Histogram</span>
                      <span
                        className={`font-mono font-bold ${
                          indicators.macd.histogram?.[indicators.macd.histogram.length - 1] > 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {indicators.macd.histogram?.[indicators.macd.histogram.length - 1]?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {indicators?.supertrend && (
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-slate-400 text-sm">Supertrend</span>
                      <span
                        className={`font-mono font-bold ${
                          indicators.supertrend.direction?.[indicators.supertrend.direction.length - 1] === 1
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {indicators.supertrend.direction?.[indicators.supertrend.direction.length - 1] === 1
                          ? '▲ Bullish'
                          : '▼ Bearish'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400 text-sm">Overall Signal</span>
                    <Badge variant={getSignalBadgeColor(summary.signalBadge?.color)}>
                      {summary.signalBadge?.signal}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* AI Prediction + Options PCR Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Prediction Panel */}
            <AIPredictionPanel
              data={aiPrediction}
              loading={aiLoading}
              error={aiError}
              onFetch={handleFetchAI}
            />

            {/* Options PCR Panel (hidden if no data) */}
            <PCRPanel data={optionsData} />
          </div>

          {/* Historical Backtest Panel (Full Width) */}
          <BacktestPanel
            results={backtestResults}
            loading={backtestLoading}
            error={backtestError}
            onRunBacktest={fetchBacktest}
            onClear={clearBacktest}
            symbol={symbol}
          />
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6 mt-12 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-xs">
            Trading System • Technical Analysis Dashboard • AI-Powered Insights
          </div>
        </footer>
      </main>
    </ErrorBoundary>
  );
}

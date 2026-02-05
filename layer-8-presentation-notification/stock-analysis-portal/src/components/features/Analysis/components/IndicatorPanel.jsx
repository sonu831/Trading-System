import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * IndicatorPanel Component
 * Renders RSI and MACD charts using Lightweight Charts v5 API
 */
export default function IndicatorPanel({ candles, indicators, height = 120 }) {
  const rsiContainerRef = useRef(null);
  const macdContainerRef = useRef(null);
  const [chartModule, setChartModule] = useState(null);
  const rsiChartRef = useRef(null);
  const macdChartRef = useRef(null);
  const rsiDisposedRef = useRef(false);
  const macdDisposedRef = useRef(false);

  // Dynamic import for lightweight-charts
  useEffect(() => {
    import('lightweight-charts').then((module) => {
      setChartModule(module);
    });
  }, []);

  // RSI Chart
  useEffect(() => {
    if (!chartModule || !rsiContainerRef.current || !candles?.length || !indicators?.rsi) return;
    
    rsiDisposedRef.current = false;

    const { createChart, ColorType, LineSeries } = chartModule;

    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }

    const chart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#1f2937',
        visible: false,
      },
    });

    rsiChartRef.current = chart;

    // RSI Line (v5 API)
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const rsiData = indicators.rsi
      .map((v, i) => ({
        time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
        value: v,
      }))
      .filter((d) => d.value !== null && !isNaN(d.time));

    if (rsiData.length > 0) {
      rsiSeries.setData(rsiData);
    }

    // Overbought/Oversold lines
    const overboughtLine = chart.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const oversoldLine = chart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    if (rsiData.length > 0) {
      const firstTime = rsiData[0].time;
      const lastTime = rsiData[rsiData.length - 1].time;
      overboughtLine.setData([
        { time: firstTime, value: 70 },
        { time: lastTime, value: 70 },
      ]);
      oversoldLine.setData([
        { time: firstTime, value: 30 },
        { time: lastTime, value: 30 },
      ]);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (rsiContainerRef.current) {
        chart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      rsiDisposedRef.current = true;
      if (rsiChartRef.current) {
        try {
          rsiChartRef.current.remove();
        } catch (e) {
          // Chart already disposed, ignore
        }
        rsiChartRef.current = null;
      }
    };
  }, [chartModule, candles, indicators, height]);

  // MACD Chart
  useEffect(() => {
    if (!chartModule || !macdContainerRef.current || !candles?.length || !indicators?.macd) return;
    
    macdDisposedRef.current = false;

    const { createChart, ColorType, LineSeries, HistogramSeries } = chartModule;

    if (macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
    }

    const chart = createChart(macdContainerRef.current, {
      width: macdContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#1f2937',
        visible: false,
      },
    });

    macdChartRef.current = chart;

    // MACD Histogram (v5 API)
    const histogramSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const histogramData = indicators.macd.histogram
      .map((v, i) => ({
        time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
        value: v,
        color: v >= 0 ? '#10b981' : '#ef4444',
      }))
      .filter((d) => d.value !== null && !isNaN(d.time));

    if (histogramData.length > 0) {
      histogramSeries.setData(histogramData);
    }

    // MACD Line (v5 API)
    const macdLine = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const macdData = indicators.macd.macd
      .map((v, i) => ({
        time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
        value: v,
      }))
      .filter((d) => d.value !== null && !isNaN(d.time));

    if (macdData.length > 0) {
      macdLine.setData(macdData);
    }

    // Signal Line (v5 API)
    const signalLine = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const signalData = indicators.macd.signal
      .map((v, i) => ({
        time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
        value: v,
      }))
      .filter((d) => d.value !== null && !isNaN(d.time));

    if (signalData.length > 0) {
      signalLine.setData(signalData);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (macdContainerRef.current) {
        chart.applyOptions({ width: macdContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      macdDisposedRef.current = true;
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove();
        } catch (e) {
          // Chart already disposed, ignore
        }
        macdChartRef.current = null;
      }
    };
  }, [chartModule, candles, indicators, height]);

  if (!indicators) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* RSI Panel */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-surface px-3 py-1 flex items-center justify-between">
          <span className="text-xs font-bold text-text-secondary">RSI (14)</span>
          {indicators.rsi && (
            <span
              className={`text-xs font-mono ${
                indicators.rsi[indicators.rsi.length - 1] > 70
                  ? 'text-error'
                  : indicators.rsi[indicators.rsi.length - 1] < 30
                    ? 'text-success'
                    : 'text-text-tertiary'
              }`}
            >
              {indicators.rsi[indicators.rsi.length - 1]?.toFixed(1) || 'N/A'}
            </span>
          )}
        </div>
        <div ref={rsiContainerRef} />
      </div>

      {/* MACD Panel */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-surface px-3 py-1 flex items-center justify-between">
          <span className="text-xs font-bold text-text-secondary">MACD (12, 26, 9)</span>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-blue-500"></span> MACD
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-amber-500"></span> Signal
            </span>
          </div>
        </div>
        <div ref={macdContainerRef} />
      </div>
    </div>
  );
}

IndicatorPanel.propTypes = {
  candles: PropTypes.array,
  indicators: PropTypes.shape({
    rsi: PropTypes.array,
    macd: PropTypes.shape({
      macd: PropTypes.array,
      signal: PropTypes.array,
      histogram: PropTypes.array,
    }),
  }),
  height: PropTypes.number,
};

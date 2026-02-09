import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * StockChart Component
 * Renders candlestick chart with multiple overlay options using TradingView Lightweight Charts v5
 * Supports: EMA, Bollinger Bands, Supertrend overlays
 */
export default function StockChart({
  candles,
  indicators,
  height = 400,
  showEMA = true,
  showBollinger = false,
  showSupertrend = false,
  showVolume = false,
  showSupportResistance = false,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const isDisposedRef = useRef(false);
  const [chartModule, setChartModule] = useState(null);

  // Dynamic import for lightweight-charts (SSR-safe)
  useEffect(() => {
    import('lightweight-charts').then((module) => {
      setChartModule(module);
    });
  }, []);

  useEffect(() => {
    if (!chartModule || !chartContainerRef.current || !candles || candles.length === 0) return;
    
    // Reset disposal flag
    isDisposedRef.current = false;

    const {
      createChart,
      CrosshairMode,
      ColorType,
      CandlestickSeries,
      LineSeries,
    } = chartModule;

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' }, // Transparent to let Glassmorphism show
        textColor: '#94a3b8', // slate-400
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6366f1', width: 1, style: 2 }, // indigo-500
        horzLine: { color: '#6366f1', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series (v5 API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#f43f5e', // rose-500
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    // Format candle data for chart
    const formattedCandles = candles.map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(formattedCandles);

    // Add EMA overlays
    if (showEMA && indicators?.ema) {
      const emaColors = {
        ema20: '#f59e0b', // Amber
        ema50: '#3b82f6', // Blue
        ema200: '#8b5cf6', // Purple
      };

      Object.entries(indicators.ema).forEach(([key, values]) => {
        if (!values || values.length === 0) return;

        const lineSeries = chart.addSeries(LineSeries, {
          color: emaColors[key] || '#6b7280',
          lineWidth: 1,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const lineData = values
          .map((v, i) => ({
            time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
            value: v,
          }))
          .filter((d) => d.value !== null && !isNaN(d.time));

        if (lineData.length > 0) {
          lineSeries.setData(lineData);
        }
      });
    }

    // Add Bollinger Bands overlay
    if (showBollinger && indicators?.bb) {
      const bbColors = {
        upper: '#f43f5e',   // Rose
        middle: '#94a3b8',  // Slate
        lower: '#10b981',   // Emerald
      };

      ['upper', 'middle', 'lower'].forEach((band) => {
        const values = indicators.bb[band];
        if (!values || values.length === 0) return;

        const lineSeries = chart.addSeries(LineSeries, {
          color: bbColors[band],
          lineWidth: band === 'middle' ? 1 : 1,
          lineStyle: band === 'middle' ? 2 : 0, // Dashed for middle
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const lineData = values
          .map((v, i) => ({
            time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
            value: v,
          }))
          .filter((d) => d.value !== null && !isNaN(d.time));

        if (lineData.length > 0) {
          lineSeries.setData(lineData);
        }
      });
    }

    // Add Supertrend overlay
    if (showSupertrend && indicators?.supertrend?.value) {
      const supertrendData = indicators.supertrend.value
        .map((v, i) => {
          if (v === null) return null;
          const direction = indicators.supertrend.direction?.[i];
          return {
            time: Math.floor(new Date(candles[i]?.time).getTime() / 1000),
            value: v,
            color: direction === 1 ? '#10b981' : '#f43f5e',
          };
        })
        .filter((d) => d !== null && !isNaN(d.time));

      if (supertrendData.length > 0) {
        // Split into bullish and bearish segments for proper coloring
        const bullishSeries = chart.addSeries(LineSeries, {
          color: '#10b981',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const bearishSeries = chart.addSeries(LineSeries, {
          color: '#f43f5e',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const bullishData = [];
        const bearishData = [];

        supertrendData.forEach((d, i) => {
          const direction = indicators.supertrend.direction?.[candles.findIndex(c =>
            Math.floor(new Date(c.time).getTime() / 1000) === d.time
          )];

          if (direction === 1) {
            bullishData.push({ time: d.time, value: d.value });
            bearishData.push({ time: d.time, value: NaN });
          } else {
            bearishData.push({ time: d.time, value: d.value });
            bullishData.push({ time: d.time, value: NaN });
          }
        });

        if (bullishData.length > 0) bullishSeries.setData(bullishData.filter(d => !isNaN(d.value)));
        if (bearishData.length > 0) bearishSeries.setData(bearishData.filter(d => !isNaN(d.value)));
      }
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      isDisposedRef.current = true;
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Chart already disposed, ignore
        }
        chartRef.current = null;
      }
    };
  }, [chartModule, candles, indicators, height, showEMA, showBollinger, showSupertrend]);

  if (!candles || candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-900/50 border border-white/10 rounded-lg backdrop-blur-sm"
        style={{ height }}
      >
        <span className="text-slate-500">No chart data available</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Overlay Legend */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-4 text-xs bg-slate-900/80 border border-white/5 px-3 py-2 rounded-lg backdrop-blur-sm shadow-xl">
        {showEMA && (
          <>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-amber-500"></span> EMA 20
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-blue-500"></span> EMA 50
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-purple-500"></span> EMA 200
            </span>
          </>
        )}
        {showBollinger && (
          <>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-rose-500"></span> BB Upper
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-slate-500"></span> BB Middle
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-3 h-0.5 bg-emerald-500"></span> BB Lower
            </span>
          </>
        )}
        {showSupertrend && (
          <span className="flex items-center gap-1 text-slate-300">
            <span className="w-3 h-0.5 bg-gradient-to-r from-emerald-500 to-rose-500"></span> Supertrend
          </span>
        )}
      </div>
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
}

StockChart.propTypes = {
  candles: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.string.isRequired,
      open: PropTypes.number.isRequired,
      high: PropTypes.number.isRequired,
      low: PropTypes.number.isRequired,
      close: PropTypes.number.isRequired,
    })
  ),
  indicators: PropTypes.shape({
    ema: PropTypes.object,
    bb: PropTypes.object,
    supertrend: PropTypes.object,
  }),
  height: PropTypes.number,
  showEMA: PropTypes.bool,
  showBollinger: PropTypes.bool,
  showSupertrend: PropTypes.bool,
  showVolume: PropTypes.bool,
  showSupportResistance: PropTypes.bool,
};

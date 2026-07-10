import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function PriceChart({ candles = [], timeframe = '1m', height = 400 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const vwapLineRef = useRef(null);
  const ema21LineRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const chart = createChart(containerRef.current, {
        height,
        layout: {
          background: { color: 'transparent' },
          textColor: 'rgba(148, 163, 184, 0.8)',
        },
        grid: {
          vertLines: { color: 'rgba(51, 65, 85, 0.3)' },
          horzLines: { color: 'rgba(51, 65, 85, 0.3)' },
        },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: 'rgba(51, 65, 85, 0.5)' },
        timeScale: {
          borderColor: 'rgba(51, 65, 85, 0.5)',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444',
        borderUpColor: '#10b981', borderDownColor: '#ef4444',
        wickUpColor: '#10b981', wickDownColor: '#ef4444',
      });

      const volumeSeries = chart.addHistogramSeries({
        color: 'rgba(59, 130, 246, 0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      // VWAP line
      const vwapLine = chart.addLineSeries({
        color: 'rgba(245, 158, 11, 0.6)', lineWidth: 1, lineStyle: 2,
        priceLineVisible: false, lastValueVisible: false,
      });

      // EMA21 line
      const ema21Line = chart.addLineSeries({
        color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      vwapLineRef.current = vwapLine;
      ema21LineRef.current = ema21Line;

      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      const observer = new ResizeObserver(handleResize);
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
        chart.remove();
      };
    } catch (err) {
      setError(err.message);
    }
  }, [height]);

  // Update data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;

    const ohlc = candles.map((c) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
    }));

    const volumes = candles.map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
    }));

    // Compute VWAP
    const vwap = candles.map((c, i) => {
      const slice = candles.slice(0, i + 1);
      const totalPV = slice.reduce((s, c2) => s + ((c2.high + c2.low + c2.close) / 3) * c2.volume, 0);
      const totalV = slice.reduce((s, c2) => s + c2.volume, 0);
      return { time: c.time, value: totalV > 0 ? totalPV / totalV : c.close };
    });

    // Compute EMA21
    const period = 21;
    const ema21 = [];
    let ema = candles[0]?.close || 0;
    const multiplier = 2 / (period + 1);
    candles.forEach((c, i) => {
      ema = (c.close - ema) * multiplier + ema;
      if (i >= period - 1) ema21.push({ time: c.time, value: ema });
    });

    candleSeriesRef.current.setData(ohlc);
    volumeSeriesRef.current.setData(volumes);
    vwapLineRef.current.setData(vwap);
    ema21LineRef.current.setData(ema21);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-center text-error text-sm" style={{ height }}>
        Chart error: {error}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', minHeight: height }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-xs text-text-tertiary">
          {candles.length} bars · {timeframe}
        </span>
        <div className="flex gap-2 text-xs text-text-tertiary">
          <span className="text-amber-400">— VWAP</span>
          <span className="text-blue-400">— EMA21</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: `calc(100% - 28px)` }} />
    </div>
  );
}

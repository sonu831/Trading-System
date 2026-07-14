// @ts-nocheck
import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

// lightweight-charts v5 uses addSeries(CandlestickSeries, options) — import the series type
let CandlestickSeries: any;
try { CandlestickSeries = require('lightweight-charts').CandlestickSeries; } catch (_) {
  // Fallback: v4 API uses addCandlestickSeries() directly
}

export default function TradingViewChart({ symbol = 'NIFTY', timeframe = '1m', height = 420 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e2e' },
        textColor: '#a0a0b0',
      },
      grid: {
        vertLines: { color: '#2a2a3a' },
        horzLines: { color: '#2a2a3a' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#3a3a4a', autoScale: true },
      timeScale: { borderColor: '#3a3a4a', timeVisible: true },
      width: containerRef.current.clientWidth,
    });

    const opts = { upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350' };

    // v5: chart.addSeries(CandlestickSeries, opts). v4: chart.addCandlestickSeries(opts)
    const s = CandlestickSeries
      ? chart.addSeries(CandlestickSeries, opts)
      : chart.addCandlestickSeries(opts);

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const tvSymbol = `NSE:${symbol}`;
    const resMap = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '1d': 'D' };
    const resolution = resMap[timeframe] || '1';
    const series = seriesRef.current;
    if (!series) return;

    let active = true;

    const fetchData = async () => {
      try {
        const from = Math.floor(Date.now() / 1000) - 86400;
        const to = Math.floor(Date.now() / 1000) + 3600;
        const res = await fetch(`/api/v1/tv/history?symbol=${tvSymbol}&resolution=${resolution}&from=${from}&to=${to}`);
        const data = await res.json();
        if (!active || data.s !== 'ok' || !data.t?.length) return;

        const bars = [];
        for (let i = 0; i < data.t.length; i++) {
          bars.push({
            time: data.t[i],
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
          });
        }
        series.setData(bars);
      } catch (_) {}
    };

    fetchData();
    const timer = setInterval(fetchData, 5000);

    return () => { active = false; clearInterval(timer); };
  }, [symbol, timeframe]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border">
      <div ref={containerRef} />
    </div>
  );
}

// @ts-nocheck
import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';

export default function TradingViewChart({ symbol = 'NIFTY', timeframe = '1m', height = 420 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: '#1e1e2e' }, textColor: '#a0a0b0' },
      grid: { vertLines: { color: '#2a2a3a' }, horzLines: { color: '#2a2a3a' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#3a3a4a', autoScale: true },
      timeScale: { borderColor: '#3a3a4a', timeVisible: true },
      width: containerRef.current.clientWidth,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const h = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); chart.remove(); };
  }, []);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    const tvSymbol = `NSE:${symbol}`;
    const rMap = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '1d': 'D' };
    const resolution = rMap[timeframe] || '1';
    let active = true;

    const fetch = async () => {
      try {
        const from = Math.floor(Date.now() / 1000) - 86400;
        const to = Math.floor(Date.now() / 1000) + 3600;
        const r = await globalThis.fetch(`/api/v1/tv/history?symbol=${tvSymbol}&resolution=${resolution}&from=${from}&to=${to}`);
        const d = await r.json();
        if (!active || d.s !== 'ok') return;
        const bars = d.t.map((t, i) => ({ time: t, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i] }));
        s.setData(bars);
      } catch (_) {}
    };

    fetch();
    const timer = setInterval(fetch, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [symbol, timeframe]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border">
      <div ref={containerRef} />
    </div>
  );
}

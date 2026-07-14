// @ts-nocheck
import { useEffect, useRef, useId } from 'react';

const TV_SCRIPT = 'https://s3.tradingview.com/tv.js';

export default function TradingViewChart({ symbol = 'NIFTY', timeframe = '1m', height = 420 }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const id = useId().replace(/:/g, '');

  const tvSymbol = `NSE:${symbol}`;
  const tfMap: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '1d': 'D' };
  const tvInterval = tfMap[timeframe] || '1';

  useEffect(() => {
    const containerId = `tv-${id}`;

    // Custom UDF datafeed backed by our /api/v1/tv endpoints
    const datafeed = {
      onReady: (cb: any) => fetch('/api/v1/tv/config').then(r => r.json()).then(cb),
      resolveSymbol: (name: string, cb: any) => fetch(`/api/v1/tv/symbols?symbol=${name}`).then(r => r.json()).then(cb),
      getBars: (symInfo: any, res: string, from: number, to: number, onResult: any) => {
        fetch(`/api/v1/tv/history?symbol=${symInfo.name}&resolution=${res}&from=${from}&to=${to}`)
          .then(r => r.json())
          .then(d => {
            if (d.s === 'ok' && d.t?.length) {
              const bars = d.t.map((t: number, i: number) => ({
                time: t * 1000, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i],
              }));
              onResult(bars, { noData: false });
            } else {
              onResult([], { noData: true });
            }
          })
          .catch(() => onResult([], { noData: true }));
      },
      subscribeBars: () => {},
      unsubscribeBars: () => {},
    };

    const createWidget = () => {
      if (!containerRef.current || !(window as any).TradingView) return;
      widgetRef.current = new (window as any).TradingView.widget({
        container_id: containerId,
        datafeed,
        symbol: tvSymbol,
        interval: tvInterval,
        theme: 'dark',
        style: '1',
        locale: 'in',
        timezone: 'Asia/Kolkata',
        toolbar_bg: '#1e1e2e',
        enable_publishing: false,
        hide_side_toolbar: true,
        allow_symbol_change: true,
        details: false,
        studies: ['MASimple@tv-basicstudies', 'VWAP@tv-basicstudies'],
        width: '100%',
        height,
        disabled_features: ['header_compare', 'header_saveload'],
      });
    };

    if (!document.querySelector(`script[src="${TV_SCRIPT}"]`)) {
      const script = document.createElement('script');
      script.src = TV_SCRIPT;
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else if ((window as any).TradingView) {
      createWidget();
    }

    return () => { try { widgetRef.current?.remove(); } catch (_) {} };
  }, []);

  useEffect(() => {
    if (widgetRef.current) widgetRef.current.setSymbol(tvSymbol, tvInterval, () => {});
  }, [symbol, timeframe]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height }}>
      <div id={`tv-${id}`} ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// @ts-nocheck
import { useEffect, useRef, useId } from 'react';

const TV_SCRIPT_URL = 'https://s3.tradingview.com/tv.js';

const symbolMap: Record<string, string> = {
  NIFTY: 'NSE:NIFTY',
  BANKNIFTY: 'NSE:BANKNIFTY',
  FINNIFTY: 'NSE:FINNIFTY',
};

function toTvSymbol(underlying: string): string {
  return symbolMap[underlying] || `NSE:${underlying}`;
}

function toTvInterval(tf: string): string {
  const map: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '2h': '120', '4h': '240',
    '1d': 'D', '1w': 'W', '1M': 'M',
  };
  return map[tf] || tf;
}

export default function TradingViewChart({ symbol = 'NIFTY', timeframe = '1m', height = 420 }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    const tvSymbol = toTvSymbol(symbol);
    const tvInterval = toTvInterval(timeframe);
    const containerId = `tv-chart-${id}`;

    const createWidget = () => {
      if (!containerRef.current || !(window as any).TradingView) return;

      widgetRef.current = new (window as any).TradingView.widget({
        container_id: containerId,
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
        hotlist: false,
        calendar: false,
        studies: ['MASimple@tv-basicstudies', 'VWAP@tv-basicstudies'],
        show_popup_button: false,
        width: '100%',
        height,
        disabled_features: ['header_compare', 'header_saveload', 'header_symbol_search'],
        enabled_features: [],
      });
    };

    if (!document.querySelector(`script[src="${TV_SCRIPT_URL}"]`)) {
      const script = document.createElement('script');
      script.src = TV_SCRIPT_URL;
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else if ((window as any).TradingView) {
      createWidget();
    } else {
      const script = document.querySelector(`script[src="${TV_SCRIPT_URL}"]`);
      if (script) script.addEventListener('load', createWidget);
    }

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch (_) {}
        widgetRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!widgetRef.current) return;
    widgetRef.current.setSymbol(toTvSymbol(symbol), toTvInterval(timeframe), () => {});
  }, [symbol, timeframe]);

  return (
    <div className="tradingview-chart-container w-full" style={{ height }}>
      <div id={`tv-chart-${id}`} ref={containerRef} className="w-full h-full" />
    </div>
  );
}

/**
 * useMarket — typed hook wrapping MarketPort + OptionsPort
 * Replaces raw fetch() calls in organisms.
 */
import { useState, useEffect } from 'react';
import { MarketApi, OptionsApi } from '@/api';
import type { IndexQuote, CandleData } from '@/shared/types';

export function useIndexQuote(underlying: string) {
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  useEffect(() => {
    let active = true;
    const fetch = () => MarketApi.getIndexQuote(underlying).then(d => { if (active && d) setQuote(d); });
    fetch(); const t = setInterval(fetch, 3000);
    return () => { active = false; clearInterval(t); };
  }, [underlying]);
  return quote;
}

export function useCandles(underlying: string, tf = '1m', limit = 200) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  useEffect(() => {
    let active = true;
    const fetch = () => MarketApi.getCandles(underlying, tf, limit).then(d => { if (active && d) setCandles(d.candles || []); });
    fetch(); const t = setInterval(fetch, 10000);
    return () => { active = false; clearInterval(t); };
  }, [underlying, tf, limit]);
  return candles;
}

export function useExpiries(underlying: string) {
  const [expiries, setExpiries] = useState<Array<{ date: string; dte: number; type: string }>>([]);
  useEffect(() => {
    OptionsApi.getExpiries(underlying).then(d => { if (d) setExpiries(d.expiries || []); });
  }, [underlying]);
  return expiries;
}

export function useOptionChain(underlying: string, expiry?: string, strikes = 7) {
  const [data, setData] = useState<{ rows: any[]; spot: number | null; atm: number }>({ rows: [], spot: null, atm: 0 });
  useEffect(() => {
    let active = true;
    const fetch = () => OptionsApi.getChain(underlying).then(d => { if (active && d) setData(d); });
    fetch(); const t = setInterval(fetch, 5000);
    return () => { active = false; clearInterval(t); };
  }, [underlying, expiry, strikes]);
  return data;
}

export function useSessionClock() {
  const [clock, setClock] = useState<any>(null);
  useEffect(() => {
    let active = true;
    const poll = () => globalThis.fetch('/api/v1/session/clock').then(r => r.json()).then(d => { if (active && d.success) setClock(d.data); });
    poll(); const t = setInterval(poll, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return clock;
}

export function useStrikePreview(underlying: string, direction: string) {
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/execution/strike-preview?underlying=${underlying}&direction=${direction}`)
      .then(r => r.json()).then(d => { if (active && d.success) setPreview(d.data); });
    return () => { active = false; };
  }, [underlying, direction]);
  return preview;
}

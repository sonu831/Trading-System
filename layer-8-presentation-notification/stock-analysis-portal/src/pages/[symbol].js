import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { AppLayout } from '@/components/layout';
import AIReasoning from '@/components/AIReasoning';
import ScoreGauge from '@/components/ScoreGauge';

export default function StockDetail() {
  const router = useRouter();
  const { symbol } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        // Using the newly created Layer 7 Endpoint
        const response = await axios.get(`/api/v1/analyze?symbol=${symbol}`);
        setData(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [symbol]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen text-white">
          <div className="animate-spin text-4xl mr-4">⏳</div>
          Loading Analysis for {symbol}...
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="text-red-500 p-10">Error: {error || 'Symbol Not Found'}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => router.push('/')} className="mr-4 text-gray-400 hover:text-white">
            &larr; Back
          </button>
          <h1 className="text-4xl font-bold text-white">{data.symbol || 'Unknown'}</h1>
          <span
            className={`ml-4 px-3 py-1 rounded text-sm font-bold ${data.recommendation?.includes('BUY') ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
          >
            {data.recommendation || 'NEUTRAL'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Stats */}
          <div className="col-span-2 space-y-6">
            {/* Chart Placeholder */}
            <div className="bg-gray-800 h-64 rounded-xl border border-gray-700 flex items-center justify-center text-gray-500">
              [ Candlestick Chart Placeholder ]
            </div>

            {/* AI Reasoning Panel */}
            {data.ai_reasoning ? (
              <AIReasoning
                reasoning={data.ai_reasoning}
                confidence={(data.ai_confidence * 100).toFixed(0)}
                model={data.ai_model_version}
              />
            ) : (
              <div className="bg-gray-800 p-6 rounded-lg text-gray-400">
                No AI Insight Available
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface p-4 rounded-lg border border-border">
                <div className="text-gray-400 text-sm">RSI</div>
                <div className="text-2xl font-bold text-white">
                  {data.rsi ? data.rsi.toFixed(2) : 'N/A'}
                </div>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-border">
                <div className="text-gray-400 text-sm">MACD</div>
                <div className="text-2xl font-bold text-white">
                  {data.macd?.histogram ? data.macd.histogram.toFixed(2) : 'N/A'}
                </div>
              </div>
              <div className="bg-surface p-4 rounded-lg border border-border">
                <div className="text-gray-400 text-sm">EMA Trend</div>
                <div className="text-2xl font-bold text-white">
                  {data.ema50 && data.ema200
                    ? data.ema50 > data.ema200
                      ? 'Bullish'
                      : 'Bearish'
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Score */}
          <div>
            <ScoreGauge score={data.trend_score || 0} />

            <div className="mt-6 bg-surface p-6 rounded-lg border border-border">
              <h4 className="text-white font-bold mb-4">Signal Details</h4>
              <ul className="space-y-2 text-sm text-gray-300 font-mono">
                <li className="flex justify-between">
                  <span>Close Price:</span>
                  <span>{data.ltp}</span>
                </li>
                <li className="flex justify-between">
                  <span>Volatility:</span>
                  <span>{data.atr ? data.atr.toFixed(2) : 'N/A'}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

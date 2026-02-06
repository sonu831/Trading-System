import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layout';
import ScoreGauge from '@/components/ScoreGauge';
import TechnicalSummary from '@/components/analysis/TechnicalSummary';
import SignalMetrics from '@/components/analysis/SignalMetrics';
import AIInsight from '@/components/analysis/AIInsight';
import { useStockAnalysis } from '@/hooks/useStockAnalysis';

export default function StockDetail() {
  const router = useRouter();
  const { symbol } = router.query;
  const { analysis, isLoading, isError } = useStockAnalysis(symbol);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-white">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <div className="text-xl font-light animate-pulse">Analyzing Market Data for {symbol}...</div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !analysis?.success) {
     const errorMsg = isError?.response?.data?.error || isError?.message || analysis?.error || 'Failed to load data';
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-red-500">
           <div className="text-6xl mb-4">⚠️</div>
           <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
           <p className="text-gray-400">{errorMsg}</p>
           <button 
             onClick={() => router.reload()}
             className="mt-6 px-6 py-2 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded text-white transition"
           >
             Retry Analysis
           </button>
        </div>
      </AppLayout>
    );
  }

  const { data } = analysis;
  const overview = data.overview || {};

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-800 pb-6">
          <div className="flex items-center">
            <button 
              onClick={() => router.push('/')} 
              className="mr-6 p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">{data.symbol}</h1>
              <div className="text-gray-400 mt-1 flex items-center space-x-4">
                 <span className="font-mono text-lg text-white">₹{overview.price || data.ltp || '0.00'}</span>
                 <span className={`px-2 py-0.5 rounded text-xs font-bold ${overview.change >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                   {overview.change >= 0 ? '+' : ''}{overview.changePct}%
                 </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-6">
             <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Strategy Verdict</div>
                <div className={`text-xl font-bold ${data.recommendation?.includes('BUY') ? 'text-green-400' : 'text-red-400'}`}>
                  {data.recommendation || 'NEUTRAL'}
                </div>
             </div>
             <ScoreGauge score={data.trend_score || 0} size="small" />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Chart & Technicals */}
          <div className="lg:col-span-2 space-y-8">
             {/* Chart Placeholder - Can later be replaced by <TradingViewChart /> */}
             <div className="bg-gray-900/50 h-[400px] rounded-xl border border-gray-800 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                <span className="text-gray-500 font-light text-lg">Interactive Chart Module</span>
                <span className="text-gray-600 text-sm mt-2">(Coming Soon)</span>
             </div>

             {/* Technical Indicators Summary */}
             <TechnicalSummary data={data} />
             
             {/* Detailed Metrics */}
             <SignalMetrics data={data} />
          </div>

          {/* Right Column: AI & Strategy */}
          <div className="space-y-8">
            {/* AI Insight Card */}
            <AIInsight analysis={data} />

            {/* Multi-Timeframe Matrix (Simplified) */}
             <div className="bg-surface p-6 rounded-lg border border-border shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4">Multi-Timeframe Recon</h3>
                <div className="space-y-3">
                   {['5m', '15m', '1h', '4h', '1d'].map((tf) => {
                      const tfData = data.multiTimeframe?.[tf];
                      const signal = tfData?.verdict?.signal || 'Neutral';
                      return (
                        <div key={tf} className="flex items-center justify-between p-3 bg-gray-800/50 rounded hover:bg-gray-800 transition">
                           <span className="text-gray-400 w-12 font-mono">{tf}</span>
                           <span className={`text-sm font-bold ${signal === 'BUY' ? 'text-green-400' : signal === 'SELL' ? 'text-red-400' : 'text-gray-400'}`}>
                             {signal}
                           </span>
                           <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${signal === 'BUY' ? 'bg-green-500' : signal === 'SELL' ? 'bg-red-500' : 'bg-gray-500'}`} 
                                style={{ width: `${(tfData?.verdict?.confidence || 0) * 100}%` }}
                              />
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

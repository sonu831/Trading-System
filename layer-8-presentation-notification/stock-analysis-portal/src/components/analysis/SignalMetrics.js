import React from 'react';

export default function SignalMetrics({ data }) {
  if (!data) return null;

  return (
    <div className="bg-surface p-6 rounded-lg border border-border shadow-lg mt-6">
      <h3 className="text-xl font-bold text-white mb-4">Signal Details</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-300">
          <thead className="border-b border-gray-700 text-gray-500 uppercase">
            <tr>
              <th className="py-2">Metric</th>
              <th className="py-2">Value</th>
              <th className="py-2">Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <tr>
              <td className="py-2">Close Price</td>
              <td className="font-mono text-white">{data.ltp}</td>
              <td>-</td>
            </tr>
            <tr>
              <td className="py-2">Volatility (ATR)</td>
              <td className="font-mono text-white">{data.atr ? data.atr.toFixed(2) : 'N/A'}</td>
              <td className="text-xs">Risk Measure</td>
            </tr>
            <tr>
              <td className="py-2">Stochastic K</td>
              <td className="font-mono text-white">{data.stoch?.k ? data.stoch.k.toFixed(2) : 'N/A'}</td>
              <td className="text-xs">{data.stoch?.k > 80 ? 'Overbought' : data.stoch?.k < 20 ? 'Oversold' : 'Neutral'}</td>
            </tr>
             <tr>
              <td className="py-2">Bollinger Position</td>
              <td className="font-mono text-white">{data.bb_position ? (data.bb_position * 100).toFixed(0) + '%' : 'N/A'}</td>
              <td className="text-xs">Relative to Band</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

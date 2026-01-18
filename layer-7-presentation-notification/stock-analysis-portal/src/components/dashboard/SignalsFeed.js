import React from 'react';
import { formatTime } from '../../utils/format';

const SignalsFeed = ({ signals }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
          <tr>
            <th className="px-6 py-4">Time</th>
            <th className="px-6 py-4">Symbol</th>
            <th className="px-6 py-4">Action</th>
            <th className="px-6 py-4">Price</th>
            <th className="px-6 py-4">Strategy</th>
            <th className="px-6 py-4">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {signals.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                No signals generated yet.
              </td>
            </tr>
          ) : (
            signals.map((signal, idx) => (
              <tr key={idx} className="hover:bg-gray-700 transition duration-150">
                <td className="px-6 py-4 text-sm text-gray-300">{formatTime(signal.timestamp)}</td>
                <td className="px-6 py-4 font-bold text-white">{signal.symbol}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      signal.action === 'BUY'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-red-900 text-red-300'
                    }`}
                  >
                    {signal.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">₹{signal.price}</td>
                <td className="px-6 py-4 text-xs text-gray-400">{signal.strategy}</td>
                <td className="px-6 py-4">
                  <div className="w-20 bg-gray-900 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full"
                      style={{ width: `${signal.confidence * 100}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SignalsFeed;

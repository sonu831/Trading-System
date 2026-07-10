import React from 'react';

const ScoreGauge = ({ score }) => {
  // Score is -1 to 1. 0 is Neutral.
  // Map to 0-100% for bar. -1=0%, 0=50%, 1=100%.

  // Color Logic
  let color = 'bg-gray-500';
  let text = 'Neutral';
  let textColor = 'text-gray-400';

  if (score > 0.5) {
    color = 'bg-green-500';
    text = 'Strong Buy';
    textColor = 'text-green-500';
  } else if (score > 0.1) {
    color = 'bg-green-400';
    text = 'Weak Buy';
    textColor = 'text-green-400';
  } else if (score < -0.5) {
    color = 'bg-red-500';
    text = 'Strong Sell';
    textColor = 'text-red-500';
  } else if (score < -0.1) {
    color = 'bg-red-400';
    text = 'Weak Sell';
    textColor = 'text-red-400';
  }

  const percentage = ((score + 1) / 2) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 text-center">
      <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Technical Score</h3>
      <div className={`text-3xl font-bold ${textColor} mb-4`}>{score.toFixed(2)}</div>

      {/* Gauge Body */}
      <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden w-full">
        {/* Center Marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-500 z-10"></div>

        <div
          className={`h-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
        <span>Sell (-1.0)</span>
        <span>Neutral (0.0)</span>
        <span>Buy (+1.0)</span>
      </div>

      <div className={`mt-4 text-sm font-semibold uppercase tracking-widest ${textColor}`}>
        {text}
      </div>
    </div>
  );
};

export default ScoreGauge;

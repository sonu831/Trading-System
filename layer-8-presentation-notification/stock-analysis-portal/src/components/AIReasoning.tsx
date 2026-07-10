import React from 'react';

const AIReasoning = ({ reasoning, confidence, model }) => {
  if (!reasoning) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 my-6 shadow-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="text-2xl mr-2">🤖</span> AI Insight
        </h3>
        <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full uppercase tracking-wider">
          {model || 'Llama 3'}
        </span>
      </div>

      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300 italic text-lg border-l-4 border-blue-500 pl-4">
          "{reasoning}"
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end text-sm text-gray-500">
        <span>Confidence Score:</span>
        <div className="w-32 h-2 bg-gray-700 rounded-full ml-3 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
        <span className="ml-2 font-mono text-white">{confidence}%</span>
      </div>
    </div>
  );
};

export default AIReasoning;

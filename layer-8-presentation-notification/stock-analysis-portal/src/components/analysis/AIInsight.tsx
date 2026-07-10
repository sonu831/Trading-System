import React from 'react';

export default function AIInsight({ analysis }) {
  // If analysis object is structured differently, adapt here.
  // Assuming 'ai_prediction' or similar might be in the root or 'ai' field.
  // Fallback to existing structure if needed.
  
  const reasoning = analysis?.ai_reasoning || "AI analysis pending...";
  const confidence = analysis?.ai_confidence ? (analysis.ai_confidence * 100).toFixed(0) : 0;
  const model = analysis?.ai_model_version || "v1.0";
  const sentiment = analysis?.recommendation || "NEUTRAL";

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-lg border border-purple-500/30 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-purple-600/20 text-purple-300 text-xs px-2 py-1 rounded-bl">
        {model}
      </div>
      
      <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-4 flex items-center">
        ✨ AI Market Insight
      </h3>

      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <span className="text-gray-400 text-sm">Sentiment</span>
          <span className={`text-2xl font-bold ${sentiment === 'BUY' ? 'text-green-400' : sentiment === 'SELL' ? 'text-red-400' : 'text-yellow-400'}`}>
            {sentiment}
          </span>
        </div>
        <div className="flex flex-col items-end">
           <span className="text-gray-400 text-sm">Confidence</span>
           <div className="flex items-center">
             <div className="w-24 h-2 bg-gray-700 rounded-full mr-2 overflow-hidden">
                <div 
                  className={`h-full ${confidence > 70 ? 'bg-green-500' : confidence > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                  style={{ width: `${confidence}%` }} 
                />
             </div>
             <span className="text-white font-mono">{confidence}%</span>
           </div>
        </div>
      </div>

      <div className="bg-black/30 p-4 rounded border border-white/5">
        <p className="text-gray-300 text-sm leading-relaxed italic">
          "{reasoning}"
        </p>
      </div>
    </div>
  );
}

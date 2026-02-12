import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  RefreshCcw, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  BarChart2, 
  Target 
} from 'lucide-react';

const PREDEFINED_PROMPTS = [
  { icon: TrendingUp, label: "Trend", text: "What is the current trend and its strength?" },
  { icon: Target, label: "Levels", text: "Identify key support and resistance levels" },
  { icon: Activity, label: "Entry/Exit", text: "Suggest entry price, stop loss, and targets" },
  { icon: BarChart2, label: "Volume", text: "Analyze volume patterns and institutional activity" },
  { icon: AlertTriangle, label: "Risks", text: "What are the major risks for a long position?" },
];

/**
 * AIPredictionPanel Component
 * Displays AI prediction gauge and interactive chat interface
 */
export default function AIPredictionPanel({ 
  symbol,
  data, 
  loading, 
  error, 
  onFetch,
  chatHistory = [],
  chatLoading = false,
  onChat
}) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || chatLoading) return;
    const msg = input;
    setInput('');
    await onChat(symbol, msg);
  };

  const handleChipClick = async (text) => {
    if (chatLoading) return;
    await onChat(symbol, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Prediction Data Handling
  const rawPrediction = parseFloat(data?.prediction);
  const prediction = Number.isFinite(rawPrediction) ? rawPrediction : 0.5;
  
  const rawConfidence = parseFloat(data?.confidence);
  const confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;
  
  const isBullish = prediction > 0.5;
  const percentage = (prediction * 100).toFixed(1);
  const gaugeAngle = Math.min(Math.max(prediction * 180 - 90, -90), 90);

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl flex flex-col backdrop-blur-sm overflow-hidden h-[600px]">
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          AI Analyst
        </h3>
        {data && (
          <Badge variant={isBullish ? 'success' : 'error'} size="sm">
            {isBullish ? '▲ Bullish' : '▼ Bearish'}
          </Badge>
        )}
      </div>

      {/* Content Container - Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Prediction Gauge & Reasoning */}
        <div className="w-full md:w-1/3 p-4 border-r border-white/5 flex flex-col overflow-y-auto">
          {loading ? (
             <div className="flex-1 flex items-center justify-center animate-pulse">
               <div className="w-32 h-32 rounded-full border-4 border-slate-700"></div>
             </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-400">
              <AlertTriangle className="w-8 h-8 mb-2" />
              <p className="text-sm">{error}</p>
              <button onClick={onFetch} className="mt-2 text-xs text-indigo-400 underline">Retry</button>
            </div>
          ) : !data ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400 mb-4">Get AI prediction based on technicals</p>
              <button
                onClick={onFetch}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all"
              >
                Generate Prediction
              </button>
            </div>
          ) : (
            <>
              {/* Gauge */}
              <div className="relative w-full aspect-[2/1] mb-6 mt-2">
                <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M 20 100 A 80 80 0 0 1 180 100" 
                    fill="none" 
                    stroke="url(#gaugeGradient)" 
                    strokeWidth="12" 
                    strokeLinecap="round" 
                    strokeDasharray={`${prediction * 251} 251`} 
                  />
                  <line 
                    x1="100" y1="100" x2="100" y2="30" 
                    stroke="white" strokeWidth="2" 
                    transform={`rotate(${gaugeAngle}, 100, 100)`} 
                  />
                  <circle cx="100" cy="100" r="4" fill="white" />
                </svg>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 text-center">
                  <span className="text-2xl font-bold text-white">{percentage}%</span>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">CONFIDENCE: {confidence.toFixed(0)}%</div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5 flex-grow overflow-y-auto">
                <span className="block text-[10px] text-indigo-300 font-bold uppercase mb-1">Analysis</span>
                <p className="text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {data.reasoning || "No reasoning provided."}
                </p>
                {data.modelVersion && (
                   <div className="mt-2 text-[9px] text-slate-600 text-right font-mono">
                     {data.modelVersion}
                   </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Side: Chat Interface */}
        <div className="w-full md:w-2/3 flex flex-col bg-slate-900/30">
          
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                <Bot className="w-12 h-12 mb-2" />
                <p className="text-sm">Ask me anything about {symbol}</p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : msg.isError 
                          ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.usage && (
                       <div className="mt-1 text-[9px] opacity-50 text-right">
                         {msg.usage.completion_tokens} tokens • {msg.model}
                       </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-lg p-3 rounded-bl-none border border-white/5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span className="text-xs text-slate-400">Analyzing {symbol}...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Predefined Chips */}
          <div className="p-2 border-t border-white/5 bg-slate-900/50 overflow-x-auto whitespace-nowrap custom-scrollbar flex gap-2">
            {PREDEFINED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleChipClick(prompt.text)}
                disabled={chatLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 
                           border border-white/5 rounded-full text-xs text-slate-300 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <prompt.icon className="w-3 h-3 text-indigo-400" />
                {prompt.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-white/10 bg-slate-900">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${symbol}...`}
                disabled={chatLoading}
                className="w-full bg-slate-950 border border-white/10 rounded-lg pl-4 pr-12 py-3 
                           text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50
                           disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatLoading}
                className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 
                           text-white rounded-md transition-colors disabled:opacity-50 disabled:bg-slate-700"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

AIPredictionPanel.propTypes = {
  symbol: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onFetch: PropTypes.func,
  chatHistory: PropTypes.array,
  chatLoading: PropTypes.bool,
  onChat: PropTypes.func
};

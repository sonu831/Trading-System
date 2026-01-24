import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BackfillModal, BackfillProgress } from '@/components/features/Backfill';
import {
  Activity,
  Server,
  Database,
  Cpu,
  BarChart2,
  Radio,
  Monitor,
  ExternalLink,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Icons as SVG components
const Icons = {
  Ingestion: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  Processing: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  ),
  Storage: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  ),
  Analysis: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  ),
  Aggregation: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  ),
  Signal: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  Presentation: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
};

const LayerCard = ({ layer, data }) => (
  <div
    className={`relative group p-6 rounded-xl border border-gray-700 bg-dark-800 hover:border-primary transition duration-300 ${
      data?.status === 'ONLINE' ? 'shadow-lg shadow-green-900/20' : 'opacity-50'
    }`}
  >
    {/* Status Indicator */}
    <div
      className={`absolute top-4 right-4 h-3 w-3 rounded-full ${
        data?.status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
      }`}
    ></div>

    <div className="flex items-center space-x-4 mb-4">
      <div
        className={`p-3 rounded-lg ${
          layer === 'Ingestion'
            ? 'bg-indigo-600'
            : layer === 'Processing'
              ? 'bg-blue-600'
              : layer === 'Storage'
                ? 'bg-green-600'
                : layer === 'Analysis'
                  ? 'bg-red-600'
                  : layer === 'Aggregation'
                    ? 'bg-amber-600'
                    : layer === 'Signal'
                      ? 'bg-pink-600'
                      : 'bg-purple-600'
        }`}
      >
        {Icons[layer] && Icons[layer]()}
      </div>
      <div>
        <h3 className="font-bold text-lg text-white">Layer {data?.id || ''}</h3>
        <p className="text-gray-400 text-sm">{layer}</p>
      </div>
    </div>

    {/* Metrics Grid */}
    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs">
      {data?.metrics &&
        Object.entries(data.metrics).map(([key, value]) => {
          const label = key.replace('websocket_', '').replace('_kb', ' (KB)').replace('_', ' ');
          return (
            <div key={key} className="bg-dark-900 p-2 rounded">
              <div className="text-gray-500 capitalize">{label}</div>
              <div className="text-white font-mono">{value}</div>
            </div>
          );
        })}
    </div>

    {/* Backfill Section for Ingestion Layer */}
    {layer === 'Ingestion' && data?.backfill?.status === 'running' && (
      <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
              Auto-Backfill
            </span>
          </div>
          <span className="text-[10px] text-white font-mono">{data.backfill.progress}%</span>
        </div>
        <div className="w-full bg-dark-900 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-full transition-all duration-700 ease-in-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
            style={{ width: `${data.backfill.progress}%` }}
          ></div>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-950/20 p-1.5 rounded border border-indigo-900/30">
          <div className="text-[9px] text-indigo-300 font-medium truncate">
            <span className="text-indigo-500 mr-1">➜</span>
            {data.backfill.details || 'Initializing...'}
          </div>
        </div>
      </div>
    )}
  </div>
);

const FlowArrow = () => (
  <div className="hidden md:flex flex-col items-center justify-center text-gray-600">
    <div className="h-full w-0.5 bg-gradient-to-b from-gray-700 to-gray-700"></div>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-gray-500 animate-bounce mt-2"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  </div>
);

export default function SystemPipeline() {
  const [systemData, setSystemData] = useState(null);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/system-status`);
        // Handle wrapped response
        setSystemData(res.data?.data || res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-dark-900 text-gray-100 p-2 md:p-8 font-sans">
      <header className="mb-6 md:mb-10 flex flex-col lg:flex-row justify-between items-center bg-dark-800 p-4 md:p-6 rounded-xl border border-dark-700 gap-6">
        <div className="text-center lg:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-white">System Pipeline Overview</h1>
          <p className="text-gray-400 text-sm md:text-base">Real-time Architecture Visualization</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 w-full lg:w-auto">
          <button
            onClick={() => setIsBackfillOpen(true)}
            disabled={systemData?.layers?.layer1?.backfill?.status === 'running'}
            className={`flex items-center justify-center gap-2 px-3 md:px-4 py-2 rounded-lg font-bold transition text-sm md:text-base flex-1 sm:flex-initial ${
              systemData?.layers?.layer1?.backfill?.status === 'running'
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
            }`}
          >
            <Activity size={18} />
            <span>
              {systemData?.layers?.layer1?.backfill?.status === 'running'
                ? 'Backfilling...'
                : 'Backfill Manager'}
            </span>
          </button>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <a
              href="/grafana/"
              target="_blank"
              className="bg-dark-700 hover:bg-dark-600 px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm whitespace-nowrap"
            >
              <span>Grafana</span>
              <span className="text-[10px] bg-green-900 text-green-300 px-1 rounded">3001</span>
            </a>
            <a
              href="/kafka/"
              target="_blank"
              className="bg-dark-700 hover:bg-dark-600 px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm whitespace-nowrap"
            >
              <span>Kafka</span>
              <span className="text-[10px] bg-green-900 text-green-300 px-1 rounded">8080</span>
            </a>
          </div>

          <a
            href="/"
            className="bg-primary hover:bg-blue-600 px-4 md:px-6 py-2 rounded-lg font-bold text-white transition text-center text-sm md:text-base w-full sm:w-auto"
          >
            Dashboard
          </a>
        </div>
      </header>

      {/* ... Content ... */}
      {/* Keeping previous content structure but omitted for brevity in thought process, must include in full replacement */}
      {/* Re-rendering full content below */}

      {/* Backfill Notification */}
      {/* Backfill Notification */}
      {systemData?.layers?.layer1?.backfill?.status === 'running' && (
        <div className="max-w-4xl mx-auto">
          <BackfillProgress
            status="running"
            progress={systemData.layers.layer1.backfill.progress}
            details={systemData.layers.layer1.backfill.details}
          />
        </div>
      )}

      {systemData?.layers?.layer1?.backfill?.status === 'completed' && (
        <div className="max-w-4xl mx-auto">
          <BackfillProgress status="completed" />
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 relative">
          <LayerCard layer="Ingestion" data={{ id: 1, ...systemData?.layers?.layer1 }} />
          <LayerCard layer="Processing" data={{ id: 2, ...systemData?.layers?.layer2 }} />
        </div>

        <FlowArrow />

        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
          <h3 className="text-gray-400 uppercase text-[10px] font-bold mb-4 tracking-wider text-center md:text-left">
            Layer 3: Storage Foundation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-lg text-center">
              <div className="text-red-400 font-bold mb-1">Redis</div>
              <div className="text-xs text-gray-400">{systemData?.infra?.redis}</div>
            </div>
            <div
              className={`bg-green-900/20 border border-green-900/50 p-4 rounded-lg text-center transition-all ${
                systemData?.layers?.layer1?.backfill?.status === 'running'
                  ? 'ring-1 ring-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                  : ''
              }`}
            >
              <div className="flex justify-center items-center gap-2">
                <div className="text-green-400 font-bold">TimescaleDB</div>
                {systemData?.layers?.layer1?.backfill?.status === 'running' && (
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                )}
              </div>
              <div className="text-xs text-gray-400">{systemData?.infra?.timescaledb}</div>
            </div>
            <div
              className={`bg-orange-900/20 border border-orange-900/50 p-4 rounded-lg text-center transition-all ${
                systemData?.layers?.layer1?.backfill?.status === 'running'
                  ? 'ring-1 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                  : ''
              }`}
            >
              <div className="flex justify-center items-center gap-2">
                <div className="text-orange-400 font-bold">Kafka</div>
                {systemData?.layers?.layer1?.backfill?.status === 'running' && (
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></div>
                )}
              </div>
              <div className="text-xs text-gray-400">{systemData?.infra?.kafka}</div>
            </div>
          </div>
        </div>

        <FlowArrow />

        <div
          className={`bg-dark-800 p-8 rounded-xl border-2 border-red-500/30 relative overflow-hidden transition duration-500 ${systemData?.layers?.layer4?.status === 'ONLINE' ? 'shadow-[0_0_30px_rgba(239,68,68,0.15)]' : ''}`}
        >
          <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
            CRITICAL PATH
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <LayerCard layer="Analysis" data={{ id: 4, ...systemData?.layers?.layer4 }} />
            <LayerCard layer="Aggregation" data={{ id: 5, ...systemData?.layers?.layer5 }} />
          </div>
          <div className="text-center mt-4 text-xs text-gray-500 flex justify-center items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
            Processing {systemData?.layers?.layer4?.metrics?.goroutines || 50} Goroutines Parallel
          </div>
        </div>

        <FlowArrow />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <LayerCard layer="Signal" data={{ id: 6, ...systemData?.layers?.layer6 }} />
          <LayerCard layer="Presentation" data={{ id: 7, ...systemData?.layers?.layer7 }} />
        </div>
      </div>

      <BackfillModal isOpen={isBackfillOpen} onClose={() => setIsBackfillOpen(false)} />
    </main>
  );
}

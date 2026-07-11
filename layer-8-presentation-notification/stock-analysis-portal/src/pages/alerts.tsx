// @ts-nocheck
import { useEffect, useState } from 'react';
import { AlertsApi } from '@/api';
import { AlertTriangle, XCircle, Info, CheckCircle } from 'lucide-react';

const ICONS = { critical: XCircle, error: XCircle, warn: AlertTriangle, info: Info };
const COLORS = {
  critical: 'border-red-700 bg-red-900/20 text-red-300',
  error: 'border-red-700/50 bg-red-900/10 text-red-300',
  warn: 'border-yellow-700/50 bg-yellow-900/10 text-yellow-300',
  info: 'border-blue-700/50 bg-blue-900/10 text-blue-300',
};

export default function AlertsPage() {
  const [data, setData] = useState({ alerts: [], count: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => AlertsApi.list().then(setData).catch(() => {}).finally(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const alerts = data.alerts || [];
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const counts = { all: alerts.length, error: alerts.filter(a => a.severity === 'error' || a.severity === 'critical').length, warn: alerts.filter(a => a.severity === 'warn').length, info: alerts.filter(a => a.severity === 'info').length };

  return (
    <div className="min-h-screen bg-background text-text-primary p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Alerts</h1>
          <p className="text-sm text-text-tertiary">Kill-switch trips, NO-STOP warnings, fills, rejects, feed failures</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[{ k: 'all', label: 'All' }, { k: 'error', label: 'Errors' }, { k: 'warn', label: 'Warnings' }, { k: 'info', label: 'Info' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1 rounded text-xs font-medium transition ${filter === f.k ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary hover:text-text-secondary'}`}>
            {f.label} {counts[f.k] > 0 && <span className="ml-1 opacity-70">({counts[f.k]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-text-tertiary text-sm">Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-text-tertiary text-sm">— No alerts</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a, i) => {
            const Icon = ICONS[a.severity] || Info;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${COLORS[a.severity] || COLORS.info}`}>
                <Icon size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.message}</div>
                  <div className="text-xs opacity-70 mt-0.5">{a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

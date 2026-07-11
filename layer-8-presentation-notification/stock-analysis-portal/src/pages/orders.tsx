// @ts-nocheck
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Hash, List, Layers } from 'lucide-react';
import { OrdersApi } from '@/api';

const COLOR_MAP = {
  FILLED: 'bg-green-900/30 text-green-400 border-green-700',
  COMPLETE: 'bg-green-900/30 text-green-400 border-green-700',
  REJECTED: 'bg-red-900/30 text-red-400 border-red-700',
  CANCELLED: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  CANCELED: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  PENDING: 'bg-blue-900/30 text-blue-400 border-blue-700',
  OPEN: 'bg-blue-900/30 text-blue-400 border-blue-700',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = () => OrdersApi.list().then(setOrders).catch(() => {}).finally(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const filtered = filter === 'all' ? orders : orders.filter(o => (o.status || '').toUpperCase() === filter.toUpperCase());
  const counts = { all: orders.length, filled: orders.filter(o => (o.status || '').toUpperCase() === 'FILLED' || (o.status || '').toUpperCase() === 'COMPLETE').length, rejected: orders.filter(o => (o.status || '').toUpperCase() === 'REJECTED').length, pending: orders.filter(o => (o.status || '').toUpperCase() === 'PENDING' || (o.status || '').toUpperCase() === 'OPEN').length };

  return (
    <div className="min-h-screen bg-background text-text-primary p-6">
      <h1 className="text-2xl font-bold mb-1">Orders &amp; Execution</h1>
      <p className="text-sm text-text-tertiary mb-6">Order book — placed, filled, rejected, cancelled</p>

      <div className="flex items-center gap-2 mb-4">
        {[{ k: 'all', label: 'All' }, { k: 'filled', label: 'Filled' }, { k: 'rejected', label: 'Rejected' }, { k: 'pending', label: 'Pending' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1 rounded text-xs font-medium transition ${filter === f.k ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary hover:text-text-secondary'}`}>
            {f.label} {counts[f.k] > 0 && <span className="ml-1 opacity-70">({counts[f.k]})</span>}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-tertiary text-sm">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-text-tertiary text-sm">— No orders</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-alt">
                <th className="text-left p-3 text-text-tertiary font-medium">Time</th>
                <th className="text-left p-3 text-text-tertiary font-medium">Order ID</th>
                <th className="text-left p-3 text-text-tertiary font-medium">Symbol</th>
                <th className="text-left p-3 text-text-tertiary font-medium">Action</th>
                <th className="text-right p-3 text-text-tertiary font-medium">Qty</th>
                <th className="text-right p-3 text-text-tertiary font-medium">Price</th>
                <th className="text-center p-3 text-text-tertiary font-medium">Status</th>
                <th className="text-right p-3 text-text-tertiary font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const status = (o.status || 'PENDING').toUpperCase();
                return (
                  <tr key={o.orderId || i} className="border-t border-border hover:bg-surface-hover">
                    <td className="p-3 text-text-tertiary font-mono">{String(o.time || '').slice(11, 19) || '—'}</td>
                    <td className="p-3 font-mono text-text-secondary">{String(o.orderId || '').slice(0, 12)}</td>
                    <td className="p-3 text-text-secondary">{o.symbol || '—'}</td>
                    <td className="p-3"><span className={o.action === 'BUY' ? 'text-green-400' : 'text-red-400'}>{o.action || '—'}</span></td>
                    <td className="p-3 text-right font-mono text-text-secondary">{o.quantity || '—'}</td>
                    <td className="p-3 text-right font-mono text-text-secondary">{o.price != null ? Number(o.price).toFixed(2) : '—'}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${COLOR_MAP[status] || 'bg-gray-900/30 text-gray-400 border-gray-700'}`}>{status}</span>
                      {o.error && <div className="text-red-400 mt-1">{o.error}</div>}
                    </td>
                    <td className="p-3 text-right font-mono text-text-tertiary">{o.latencyMs != null ? `${o.latencyMs}ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

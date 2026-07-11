// @ts-nocheck
import AppShell from '@/components/layout/AppShell/AppShell';
import { useTheme } from '@/utils/theme-provider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Settings</h1>
        <span className="text-sm text-text-tertiary">Theme · display · notifications</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card">
          <h2 className="text-sm font-bold mb-3">Theme</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTheme('dark')} className={`text-sm font-semibold px-4 py-2 rounded-lg border cursor-pointer transition ${theme === 'dark' ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}>🌙 Midnight</button>
            <button onClick={() => setTheme('light')} className={`text-sm font-semibold px-4 py-2 rounded-lg border cursor-pointer transition ${theme === 'light' ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}>☀️ Daylight</button>
          </div>
          <div className="text-xs text-text-tertiary mt-3">The token system can support more than two themes — new palettes swap CSS variables only.</div>
        </div>
        <div className="card">
          <h2 className="text-sm font-bold mb-3">Display</h2>
          <div className="kv"><span className="text-text-secondary text-xs">Currency</span><span className="font-semibold text-sm">₹ · en-IN (₹12,45,000)</span></div>
          <div className="kv"><span className="text-text-secondary text-xs">P&amp;L palette</span><span className="text-sm">Colorblind-safe</span></div>
          <div className="kv"><span className="text-text-secondary text-xs">Times</span><span className="font-semibold text-sm">IST</span></div>
        </div>
      </div>
    </AppShell>
  );
}

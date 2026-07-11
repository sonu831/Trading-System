// @ts-nocheck
import Link from 'next/link';
import { useRouter } from 'next/router';

function SidebarLink({ href, icon, label, tag, active }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? 'bg-primary/12 text-primary font-bold' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
      <span className="w-4 text-center opacity-80">{icon}</span>
      <span>{label}</span>
      {tag && <span className="ml-auto text-[9px] font-extrabold text-accent tracking-wider">{tag}</span>}
    </Link>
  );
}

export default function AppShell({ children }) {
  const router = useRouter();
  const path = router.pathname;

  return (
    <div className="app min-h-screen bg-background text-text-primary font-sans" style={{ fontFamily: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" }}>
      {/* SAFETY BAR */}
      <div className="sticky top-0 z-40 flex items-center gap-4 bg-surface border-b border-border shadow-lg px-5 py-2.5">
        <Link href="/" className="font-extrabold text-base tracking-tight whitespace-nowrap bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Stock Analysis By Gurus
        </Link>
        <div className="flex items-center gap-3 ml-4 text-xs">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">NIFTY</span>
            <span className="font-bold text-sm tabular-nums">24,850.30 <span className="text-success">+0.45%</span></span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">BANKNIFTY</span>
            <span className="font-bold text-sm tabular-nums">54,210.80 <span className="text-error">−0.16%</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="badge badge-paper text-[11px] font-bold px-2.5 py-1 rounded-full border">🧪 PAPER</span>
          <span className="text-xs text-text-tertiary tabular-nums" id="ist-clock">09:41 IST</span>
          <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(52,211,153,0.25)] animate-pulse" />
          <span className="text-xs text-text-tertiary">ONLINE</span>
          <button className="px-3.5 py-1.5 rounded-lg bg-error text-white font-extrabold text-xs tracking-wider border-none cursor-pointer hover:brightness-110 transition">
            KILL
          </button>
        </div>
      </div>

      {/* SHELL: sidebar + main */}
      <div className="flex">
        {/* SIDEBAR */}
        <nav className="w-[220px] min-h-[calc(100vh-49px)] border-r border-border bg-surface p-3 overflow-y-auto flex flex-col gap-5 shrink-0">
          <div>
            <h4 className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-1.5 px-2.5 font-bold">Trade</h4>
            <div className="flex flex-col gap-0.5">
              <SidebarLink href="/scalp" icon="⚡" label="Scalp Cockpit" active={path.startsWith('/scalp')} />
              <SidebarLink href="/trading" icon="📈" label="Positions & P&amp;L" active={path === '/trading'} />
            </div>
          </div>
          <div>
            <h4 className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-1.5 px-2.5 font-bold">Analyze</h4>
            <div className="flex flex-col gap-0.5">
              <SidebarLink href="/" icon="🏠" label="Overview" active={path === '/'} />
              <SidebarLink href="/internals" icon="📊" label="Market Internals" tag="NEW" active={path === '/internals'} />
              <SidebarLink href="/regime" icon="🌡️" label="Regime" tag="NEW" active={path === '/regime'} />
              <SidebarLink href="/predictions" icon="🧠" label="Predictions" tag="NEW" active={path === '/predictions'} />
              <SidebarLink href="/signals" icon="🎯" label="Signals" tag="NEW" active={path === '/signals'} />
              <SidebarLink href="/backtest" icon="🧪" label="Backtest Lab" active={path === '/backtest'} />
            </div>
          </div>
          <div>
            <h4 className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-1.5 px-2.5 font-bold">Configure</h4>
            <div className="flex flex-col gap-0.5">
              <SidebarLink href="/strategies" icon="🧩" label="Strategies" active={path === '/strategies'} />
              <SidebarLink href="/risk" icon="🛡️" label="Risk" active={path === '/risk'} />
              <SidebarLink href="/brokers" icon="🔑" label="Brokers" active={path.startsWith('/brokers')} />
              <SidebarLink href="/settings" icon="⚙️" label="Settings" active={path === '/settings'} />
            </div>
          </div>
          <div>
            <h4 className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-1.5 px-2.5 font-bold">Operate</h4>
            <div className="flex flex-col gap-0.5">
              <SidebarLink href="/alerts" icon="🔔" label="Alerts" tag="NEW" active={path === '/alerts'} />
              <SidebarLink href="/operate" icon="🩺" label="Backfill · Swarm · System" active={path === '/operate'} />
            </div>
          </div>
        </nav>

        {/* MAIN */}
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

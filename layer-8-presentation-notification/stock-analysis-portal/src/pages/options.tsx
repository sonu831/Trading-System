import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell/AppShell';
import OptionChainGrid from '@/components/organisms/OptionChainGrid';

export default function OptionsPage() {
  const router = useRouter();
  const underlying = (router.query.u as string) || 'NIFTY';

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Options Analytics</h1>
        <div className="flex gap-2 ml-auto">
          {['NIFTY', 'BANKNIFTY'].map((u) => (
            <button key={u} onClick={() => router.push(`/options?u=${u}`)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${underlying === u ? 'bg-primary text-white' : 'bg-surface border border-border text-text-secondary hover:text-text-primary'}`}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <OptionChainGrid underlying={underlying} />
    </AppShell>
  );
}

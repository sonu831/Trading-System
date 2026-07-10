import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import OptionChainGrid from '@/components/organisms/OptionChainGrid';

export default function OptionsPage() {
  const router = useRouter();
  const underlying = (router.query.u as string) || 'NIFTY';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Options Analytics</h1>
          <div className="flex gap-2">
            {['NIFTY', 'BANKNIFTY'].map((u) => (
              <button
                key={u}
                onClick={() => router.push(`/options?u=${u}`)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  underlying === u ? 'bg-primary text-white' : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <OptionChainGrid underlying={underlying} />
      </div>
    </AppLayout>
  );
}

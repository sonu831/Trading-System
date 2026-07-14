// @ts-nocheck
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell/AppShell';
import BrokerDetail from '@/components/brokers/BrokerDetail/BrokerDetail';

export default function BrokerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  if (!id) return null;
  return (
    <AppShell>
      <BrokerDetail id={id} />
    </AppShell>
  );
}

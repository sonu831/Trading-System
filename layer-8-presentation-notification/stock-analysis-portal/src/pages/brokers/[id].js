import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layout';
import BrokerDetail from '@/components/brokers/BrokerDetail/BrokerDetail';

export default function BrokerDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) return null;

  return (
    <AppLayout>
      <BrokerDetail id={id} />
    </AppLayout>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import BrokerList from '@/components/brokers/BrokerList/BrokerList';
import AddBrokerModal from '@/components/brokers/AddBrokerModal';

export default function BrokersPage() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <AppLayout>
      <BrokerList onAddClick={() => setShowAdd(true)} />
      <AddBrokerModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </AppLayout>
  );
}

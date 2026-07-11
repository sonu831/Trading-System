// @ts-nocheck
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import BrokerList from '@/components/brokers/BrokerList/BrokerList';
import AddBrokerModal from '@/components/brokers/AddBrokerModal';

export default function BrokersPage() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Brokers</h1>
        <span className="text-sm text-text-tertiary">Provider registry · FlatTrade-first execution</span>
      </div>
      <BrokerList onAddClick={() => setShowAdd(true)} />
      <AddBrokerModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </AppShell>
  );
}

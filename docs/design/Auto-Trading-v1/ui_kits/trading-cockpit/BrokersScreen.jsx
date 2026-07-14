function BrokersScreen() {
  const { Button, Card, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input } = window.AutoTrading_f56db4;
  const [brokers, setBrokers] = React.useState(window.MOCK.brokers);
  const [showAdd, setShowAdd] = React.useState(false);
  const user = window.CURRENT_USER;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="key" style={{ color: 'var(--color-accent)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Broker Connections</h1>
      </div>

      {/* Per-user account context — broker credentials are scoped to this signed-in user */}
      <Card padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--font-weight-bold)', flexShrink: 0 }}>
          {user.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{user.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{user.email} · Account {user.accountId}</div>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Credentials below apply only to this account.</span>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {brokers.map((b) => (
          <Card key={b.id} padding="sm">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{b.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{b.accountId || 'Not linked'}</div>
              </div>
              <Badge size="sm" variant={b.status === 'connected' ? 'success' : 'default'}>{b.status === 'connected' ? 'Connected' : 'Disconnected'}</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Mode: <span style={{ color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>{b.mode}</span></span>
              <Button size="sm" variant={b.status === 'connected' ? 'secondary' : 'primary'}>{b.status === 'connected' ? 'Manage' : 'Connect'}</Button>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={() => setShowAdd(true)}>+ Add broker</Button>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} size="sm">
        <ModalHeader onClose={() => setShowAdd(false)}>Add broker</ModalHeader>
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Broker" placeholder="e.g. Angel One" />
            <Input label="API key" type="password" placeholder="••••••••" />
            <Input label="API secret" type="password" placeholder="••••••••" helperText={`Stored encrypted, scoped to ${user.name}'s account only`} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setShowAdd(false)}>Save &amp; test connection</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
window.BrokersScreen = BrokersScreen;

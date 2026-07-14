import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../../ui/Button/Button';

export default {
  title: 'Molecules/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl', 'full'] },
    isOpen: { control: 'boolean' },
  },
};

function ModalDemo({ size = 'md', children, actions, title = 'Confirm Action' }: { size?: string; children: any; actions?: any; title?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ minWidth: '400px' }}>
      {open ? null : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Modal
        </Button>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} size={size}>
        <Modal.Header onClose={() => setOpen(false)}>{title}</Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        {actions ? (
          <Modal.Footer>{actions}</Modal.Footer>
        ) : null}
      </Modal>
    </div>
  );
}

export const Default = {
  name: 'Basic modal',
  render: () => (
    <ModalDemo title="Session Expired">
      <p className="text-text-secondary">Your session has expired. Please log in again to continue trading.</p>
    </ModalDemo>
  ),
};

export const WithActions = {
  name: 'With footer actions',
  render: () => (
    <ModalDemo
      title="Kill All Positions"
      actions={
        <>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Confirm Kill</Button>
        </>
      }
    >
      <p className="text-text-secondary">This will immediately square off all open positions. This action cannot be undone.</p>
      <div className="mt-3 p-3 bg-error/10 border border-error/20 rounded-lg">
        <p className="text-error text-sm font-semibold">Type "KILL" to confirm this destructive action.</p>
      </div>
    </ModalDemo>
  ),
};

export const Large = {
  render: () => (
    <ModalDemo size="lg" title="Data Backfill">
      <div className="space-y-4">
        <p className="text-text-secondary">Select the date range and symbols for historical data backfill.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-tertiary">From</label>
            <div className="mt-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary">2024-01-01</div>
          </div>
          <div>
            <label className="text-xs text-text-tertiary">To</label>
            <div className="mt-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary">2025-12-31</div>
          </div>
        </div>
        <div className="p-3 bg-surface-hover rounded-lg">
          <p className="text-xs text-text-tertiary">Estimated records: ~1,200,000 candles</p>
        </div>
      </div>
    </ModalDemo>
  ),
};

export const Small = {
  render: () => (
    <ModalDemo size="sm" title="Delete Alert">
      <p className="text-text-secondary">Are you sure you want to delete this alert?</p>
    </ModalDemo>
  ),
};

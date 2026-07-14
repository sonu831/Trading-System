import React from 'react';
import ConfirmDialog from './ConfirmDialog';

export default {
  title: 'Trading/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
};

export const KillConfirm = {
  args: {
    isOpen: true,
    title: 'Halt all trading?',
    description: 'This flips the kill switch: no new entries will be taken and open positions are squared off at market.',
    confirmLabel: 'Halt trading',
    onConfirm: () => {},
    onCancel: () => {},
  },
};

export const WithTypePhrase = {
  args: {
    isOpen: true,
    title: 'Resume trading?',
    description: 'Trading was halted by the daily-loss circuit breaker. Confirm before resuming.',
    confirmLabel: 'Resume trading',
    confirmPhrase: 'RESUME',
    onConfirm: () => {},
    onCancel: () => {},
  },
};

export const Busy = {
  args: {
    isOpen: true,
    title: 'Squaring off positions...',
    description: 'All open positions are being squared off at market. This may take a moment.',
    confirmLabel: 'Please wait',
    busy: true,
    onConfirm: () => {},
    onCancel: () => {},
  },
};

export const Closed = {
  args: {
    isOpen: false,
    title: 'Delete',
    description: 'This won\'t show because isOpen is false.',
    confirmLabel: 'Delete',
    onConfirm: () => {},
    onCancel: () => {},
  },
};

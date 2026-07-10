import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';

/**
 * Dashboard rule U6: destructive actions confirm.
 *
 * When `confirmPhrase` is supplied the operator must type it exactly — deliberate
 * friction for the things that cannot be undone (arming live, flattening the book).
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmPhrase,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <span className={danger ? 'text-error' : 'text-warning'} aria-hidden="true">
            <AlertTriangle size={22} />
          </span>
          <div className="flex-1">
            <h2 id="confirm-title" className="text-lg font-bold text-text-primary">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{description}</p>
            ) : null}
          </div>
        </div>

        {confirmPhrase ? (
          <div className="mt-4">
            <label htmlFor="confirm-phrase" className="block text-xs text-text-tertiary mb-1">
              Type <span className="font-mono font-bold text-text-primary">{confirmPhrase}</span> to
              continue
            </label>
            <input
              id="confirm-phrase"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
              placeholder={confirmPhrase}
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!phraseOk || busy}
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? 'bg-error hover:brightness-110' : 'bg-primary hover:brightness-110'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  confirmLabel: PropTypes.string,
  confirmPhrase: PropTypes.string,
  danger: PropTypes.bool,
  busy: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

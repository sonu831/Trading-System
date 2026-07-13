// @ts-nocheck
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { XOctagon, Play } from 'lucide-react';
import {
  activateKillSwitch,
  resumeTrading,
  selectKillSwitch,
  selectExecution,
} from '@/store/slices/executionSlice';
import ConfirmDialog from '@/components/trading/ConfirmDialog';

/**
 * Dashboard rule U1: the kill switch is always one click away.
 *
 * Lives in the Navbar, so it is reachable from every route and on mobile.
 * Halting requires one confirmation; RESUMING requires typing the phrase, because
 * resuming after a daily-loss breaker trip is the genuinely dangerous direction.
 */
export default function KillSwitchButton({ className = '' }) {
  const dispatch = useDispatch();
  const killSwitch = useSelector(selectKillSwitch);
  const { mutating, reachable } = useSelector(selectExecution);
  const [confirming, setConfirming] = useState(null); // 'kill' | 'resume' | null

  const unknown = killSwitch === null;
  const halted = killSwitch === true;

  const handleConfirm = async () => {
    if (confirming === 'kill') await dispatch(activateKillSwitch());
    if (confirming === 'resume') await dispatch(resumeTrading());
    setConfirming(null);
  };

  // Engine unreachable: show it plainly rather than a button that pretends to work.
  if (reachable === false) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-text-tertiary text-xs font-bold ${className}`}
        title="Execution engine unreachable — kill switch state unknown"
      >
        <XOctagon size={14} aria-hidden="true" />
        ENGINE OFFLINE
      </span>
    );
  }

  return (
    <>
      {halted ? (
        <button
          type="button"
          onClick={() => setConfirming('resume')}
          disabled={mutating}
          title="Trading is halted. Resume new entries."
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border border-warning/50 bg-warning/10 text-warning hover:bg-warning/20 transition disabled:opacity-50 ${className}`}
        >
          <Play size={15} aria-hidden="true" />
          HALTED — Resume
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming('kill')}
          disabled={mutating || unknown}
          title={unknown ? 'Kill switch state unknown' : 'Halt all new entries and flatten positions'}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm bg-error text-white shadow-md hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
          <XOctagon size={15} aria-hidden="true" />
          KILL
        </button>
      )}

      <ConfirmDialog
        isOpen={confirming === 'kill'}
        title="Halt all trading?"
        description={
          <>
            This flips the kill switch: <strong>no new entries</strong> will be taken and open
            positions are squared off at market. The switch is persisted, so it survives a restart.
          </>
        }
        confirmLabel="Halt trading"
        busy={mutating}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        isOpen={confirming === 'resume'}
        title="Resume trading?"
        description={
          <>
            Trading was halted — possibly by the <strong>daily-loss circuit breaker</strong>. Resuming
            allows new entries again. Confirm the day&apos;s loss limit and strategy behaviour before
            you do this.
          </>
        }
        confirmLabel="Resume trading"
        confirmPhrase="RESUME"
        busy={mutating}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

KillSwitchButton.propTypes = {
  className: PropTypes.string,
};

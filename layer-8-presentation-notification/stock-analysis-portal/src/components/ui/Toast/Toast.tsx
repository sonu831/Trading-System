// @ts-nocheck
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectToasts, dismissToast } from '@/store/slices/systemSlice';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'border-l-success bg-success/5',
  error: 'border-l-error bg-error/5',
  warning: 'border-l-warning bg-warning/5',
  info: 'border-l-info bg-info/5',
};

const ICON_COLORS = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
};

function ToastItem({ toast }) {
  const dispatch = useDispatch();
  const Icon = ICONS[toast.type] || ICONS.info;

  useEffect(() => {
    const duration = toast.duration || 6000;
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dispatch]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg backdrop-blur-md animate-slide-in-right ${COLORS[toast.type] || COLORS.info} bg-surface/95 border-border min-w-[320px] max-w-[420px]`}
      role="alert"
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${ICON_COLORS[toast.type] || ICON_COLORS.info}`} />
      <div className="flex-1 min-w-0">
        {toast.title && <div className="text-xs font-bold text-text-primary mb-0.5">{toast.title}</div>}
        <div className="text-xs text-text-secondary leading-relaxed">{toast.text}</div>
      </div>
      <button
        onClick={() => dispatch(dismissToast(toast.id))}
        className="shrink-0 text-text-tertiary hover:text-text-primary transition"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useSelector(selectToasts);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
      {toasts.slice(-5).map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

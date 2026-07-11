import React, { useEffect, useState } from 'react';

/** Modal — centered dialog with backdrop blur and scale/fade transition. */
export function Modal({ isOpen, onClose, children, size = 'md', style, ...props }) {
  const [render, setRender] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) { setRender(true); const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }
    setVisible(false);
    const t = setTimeout(() => setRender(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!render) return null;
  const widths = { sm: 420, md: 520, lg: 720, xl: 960 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', opacity: visible ? 1 : 0, transition: 'opacity 300ms' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: widths[size] || widths.md, transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)', opacity: visible ? 1 : 0, transition: 'all 300ms', ...style }} {...props}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-2xl)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({ children, onClose, style, ...props }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }} {...props}>
      <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>{children}</div>
      {onClose && <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', fontSize: 16 }}>✕</button>}
    </div>
  );
}

export function ModalBody({ children, style, ...props }) {
  return <div style={{ padding: 16, overflowY: 'auto', flex: 1, ...style }} {...props}>{children}</div>;
}

export function ModalFooter({ children, style, ...props }) {
  return <div style={{ padding: 16, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, ...style }} {...props}>{children}</div>;
}

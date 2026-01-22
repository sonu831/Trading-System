import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Card from '../Card';
import Button from '../Button';

const Modal = ({ isOpen, onClose, children, size = 'md', className = '' }) => {
  const [visible, setVisible] = useState(false);
  const [render, setRender] = useState(false);

  // Handle entry/exit animations
  useEffect(() => {
    if (isOpen) {
      setRender(true);
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setRender(false), 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (render) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [render]);

  if (!render) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] h-[90vh]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container */}
      <div
        className={`relative w-full ${sizeClasses[size] || sizeClasses.md} transform transition-all duration-300 ease-out ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'} ${className}`}
        role="dialog"
        aria-modal="true"
      >
        <Card className="w-full flex flex-col max-h-[90vh] bg-surface border-border shadow-2xl">
          {children}
        </Card>
      </div>
    </div>
  );
};

// Sub-components
const ModalHeader = ({ children, onClose, className = '' }) => (
  <div className={`p-4 border-b border-border flex justify-between items-center ${className}`}>
    <div className="font-bold text-lg text-text-primary">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        className="text-text-tertiary hover:text-text-primary p-1 rounded-full hover:bg-surface-hover transition-colors"
        aria-label="Close"
      >
        ✕
      </button>
    )}
  </div>
);

const ModalBody = ({ children, className = '' }) => (
  <div className={`p-4 overflow-y-auto flex-1 ${className}`}>{children}</div>
);

const ModalFooter = ({ children, className = '' }) => (
  <div
    className={`p-4 border-t border-border flex justify-end space-x-2 bg-surface/50 ${className}`}
  >
    {children}
  </div>
);

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  className: PropTypes.string,
};

ModalHeader.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func,
  className: PropTypes.string,
};
ModalBody.propTypes = { children: PropTypes.node, className: PropTypes.string };
ModalFooter.propTypes = { children: PropTypes.node, className: PropTypes.string };

export default Modal;

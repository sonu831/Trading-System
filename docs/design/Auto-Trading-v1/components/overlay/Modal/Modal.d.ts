import { ReactNode } from 'react';

/**
 * @startingPoint section="Components" subtitle="Centered dialog, blurred backdrop" viewport="700x300"
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export function Modal(props: ModalProps): JSX.Element | null;
export function ModalHeader(props: { children: ReactNode; onClose?: () => void }): JSX.Element;
export function ModalBody(props: { children: ReactNode }): JSX.Element;
export function ModalFooter(props: { children: ReactNode }): JSX.Element;

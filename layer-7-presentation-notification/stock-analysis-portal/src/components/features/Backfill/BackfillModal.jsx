import React from 'react';
import PropTypes from 'prop-types';
import BackfillPanel from './components/BackfillPanel';
import { Modal } from '@/components/ui';

const BackfillModal = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <Modal.Header onClose={onClose}>Backfill System</Modal.Header>
      <Modal.Body className="p-0">
        {/* Panel handles its own padding/layout internally, or we can adjust here */}
        <BackfillPanel />
      </Modal.Body>
    </Modal>
  );
};

BackfillModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BackfillModal;

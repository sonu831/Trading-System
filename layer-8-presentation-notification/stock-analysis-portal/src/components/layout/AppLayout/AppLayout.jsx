import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { selectBackfillModalOpen, setBackfillModalOpen } from '@/store/slices/systemSlice';
import { BackfillModal } from '@/components/features/Backfill';
import Navbar from '../Navbar';
import Footer from '../Footer';

const AppLayout = ({ children, viewMode, setViewMode, systemStatus }) => {
  const isBackfillOpen = useSelector(selectBackfillModalOpen);
  const dispatch = useDispatch();

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans flex flex-col transition-colors duration-200">
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-grow">
        <Navbar viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus} />
        <main>{children}</main>
      </div>
      <Footer />

      {/* Global Modals */}
      <BackfillModal
        isOpen={isBackfillOpen}
        onClose={() => dispatch(setBackfillModalOpen(false))}
      />
    </div>
  );
};

AppLayout.propTypes = {
  children: PropTypes.node.isRequired,
  viewMode: PropTypes.string,
  setViewMode: PropTypes.func,
  systemStatus: PropTypes.string,
};

export default AppLayout;

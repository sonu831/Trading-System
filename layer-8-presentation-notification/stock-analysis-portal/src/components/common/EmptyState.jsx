import React from 'react';
import PropTypes from 'prop-types';
import { Card, Button } from '@/components/ui';

/**
 * EmptyState Component
 * A reusable placeholder for when data is missing or loading.
 */
export default function EmptyState({
  icon = '📭',
  title = 'No Data Available',
  description = 'There is no data to display at this time.',
  actionLabel,
  onAction,
  loading = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="text-4xl mb-4 opacity-50">{loading ? '⏳' : icon}</div>
      <h3 className="text-xl font-bold text-slate-200 mb-2">{title}</h3>
      <p className="text-slate-400 max-w-md mb-6">{description}</p>
      
      {actionLabel && (onAction || loading) && (
        <Button 
          onClick={onAction} 
          disabled={loading}
          variant="primary"
          loading={loading}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  loading: PropTypes.bool,
  className: PropTypes.string,
};

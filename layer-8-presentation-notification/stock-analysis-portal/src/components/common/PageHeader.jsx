import React from 'react';
import PropTypes from 'prop-types';

/**
 * PageHeader Component
 * Standard layout for page top sections with title, subtitle, and actions.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-400 mt-1 text-sm md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      
      {actions && (
        <div className="flex flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  className: PropTypes.string,
};

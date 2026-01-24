import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import Card from '../Card';

const Carousel = ({ children, title, className = '' }) => {
  const scrollRef = useRef(null);

  return (
    <Card className={`mb-6 ${className} p-0 overflow-hidden border-border`}>
      {title && (
        <div className="p-4 border-b border-border bg-surface/50">
          <h3 className="text-text-tertiary text-xs font-bold uppercase tracking-wider">{title}</h3>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto p-4 space-x-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {children}
      </div>
    </Card>
  );
};

Carousel.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
};

export default Carousel;

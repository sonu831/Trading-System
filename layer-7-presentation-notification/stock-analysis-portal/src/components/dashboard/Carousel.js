import React, { useRef, useEffect } from 'react';

const Carousel = ({ children, title }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Auto-scroll functionality
    let scrollAmount = 0;
    const scrollStep = 1;
    const delay = 30; // ms

    const scrollInterval = setInterval(() => {
      if (!el) return;
      // If user is hovering, maybe pause? For now, simple auto scroll or maybe just manual scroll is better for data.
      // User asked for "flash on carousel", maybe auto-scroll.
      // Let's implement slow auto-scroll that pauses on hover.
    }, delay);

    return () => clearInterval(scrollInterval);
  }, []);

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 mb-6">
      {title && (
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">{title}</h3>
      )}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto space-x-4 pb-4 snap-x scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      >
        {children}
      </div>
    </div>
  );
};

export default Carousel;

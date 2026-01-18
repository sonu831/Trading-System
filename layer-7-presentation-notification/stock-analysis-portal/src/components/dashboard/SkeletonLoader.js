import React from 'react';

const SkeletonPulse = ({ className }) => (
  <div className={`animate-pulse bg-gray-700/50 rounded ${className}`}></div>
);

const SkeletonLoader = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div className="space-y-2">
          <SkeletonPulse className="h-8 w-64" />
          <SkeletonPulse className="h-4 w-48" />
        </div>
        <div className="flex space-x-4 mt-4 md:mt-0">
          <SkeletonPulse className="h-10 w-24" />
          <SkeletonPulse className="h-10 w-32" />
        </div>
      </div>

      {/* Market Overview Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-40">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          <SkeletonPulse className="h-12 w-20 mb-2" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-40">
          <SkeletonPulse className="h-4 w-32 mb-4" />
          <div className="flex justify-between items-end mb-2">
            <SkeletonPulse className="h-8 w-16" />
            <SkeletonPulse className="h-8 w-24" />
          </div>
          <SkeletonPulse className="h-4 w-full" />
        </div>
      </div>

      {/* Carousel Skeleton */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
        <SkeletonPulse className="h-4 w-40 mb-4" />
        <div className="flex space-x-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="min-w-[160px] h-24 bg-gray-700/30 rounded-lg p-3">
              <SkeletonPulse className="h-3 w-20 mb-2" />
              <SkeletonPulse className="h-6 w-16 mb-2" />
              <SkeletonPulse className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="grid grid-cols-5 gap-4 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonPulse key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <SkeletonPulse key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;

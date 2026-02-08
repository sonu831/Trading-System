import React, { useState } from 'react';
import { Card } from '../../ui';

export default function NotificationItem({ notification }) {
  const [expanded, setExpanded] = useState(false);

  // Helper to determine icon/color based on type
  const getTypeStyles = (type) => {
    switch (type) {
      case 'BACKFILL_STATS':
        return { icon: 'Hz', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' };
      case 'ERROR':
        return { icon: '!', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' };
      case 'SUCCESS':
        return { icon: '✓', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
      default:
        return { icon: 'i', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' };
    }
  };

  const { icon, color, bg } = getTypeStyles(notification.type);

  return (
    <Card className={`mb-4 transition-all hover:shadow-md ${notification.is_read ? 'opacity-80' : 'border-l-4 border-l-primary'}`}>
      <div className="p-4">
        <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg} ${color} font-bold flex-shrink-0`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                 <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {notification.type === 'BACKFILL_STATS' ? 'Data Backfill Report' : notification.type}
                 </h4>
                 {!notification.is_read && (
                    <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full font-bold">NEW</span>
                 )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {notification.message}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(notification.created_at || notification.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {/* Expandable Metadata Viewer */}
        {expanded && (
          <div className="mt-4 pl-14">
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto border border-gray-200 dark:border-gray-700">
              <pre>{JSON.stringify(notification.metadata || notification.data || {}, null, 2)}</pre>
            </div>
            {notification.type === 'BACKFILL_STATS' && (
                <div className="mt-2 text-xs text-gray-500">
                    Tip: Check "ignored" count to verify duplicate handling logic.
                </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

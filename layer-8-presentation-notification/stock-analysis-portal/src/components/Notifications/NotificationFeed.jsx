import React from 'react';
import NotificationItem from './NotificationItem';

export default function NotificationFeed({ notifications, onLoadMore, hasMore, loading }) {
  if (!notifications?.length && !loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-2 text-4xl">📭</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No notifications yet</h3>
        <p className="text-gray-500">We'll verify functionality once the first alert arrives.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
      
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Load Older Notifications'}
          </button>
        </div>
      )}
    </div>
  );
}

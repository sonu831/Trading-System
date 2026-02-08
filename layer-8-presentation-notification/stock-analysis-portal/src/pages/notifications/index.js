import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '../../components/layout';
import NotificationFeed from '../../components/features/Notifications/NotificationFeed';
import { Card } from '../../components/ui';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const fetchNotifications = async (currentOffset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/notifications?limit=${LIMIT}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data.length < LIMIT) setHasMore(false);
        setNotifications((prev) => currentOffset === 0 ? data.data : [...prev, ...data.data]);
        setOffset(currentOffset + LIMIT);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(0);
  }, []);

  const handleLoadMore = () => {
    fetchNotifications(offset);
  };

  const markAllRead = async () => {
    try {
        await fetch('/api/v1/notifications/read-all', { method: 'PUT' });
        // Optimistically update UI
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <AppLayout>
      <Head>
        <title>Notifications | Nifty 50 Trading System</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Notifications
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              System alerts, backfill reports, and modification logs.
            </p>
          </div>
          <button
            onClick={markAllRead}
            className="text-sm text-primary hover:text-blue-600 font-medium cursor-pointer"
          >
            Mark all as read
          </button>
        </div>

        <NotificationFeed 
            notifications={notifications} 
            loading={loading} 
            hasMore={hasMore} 
            onLoadMore={handleLoadMore} 
        />
      </div>
    </AppLayout>
  );
}

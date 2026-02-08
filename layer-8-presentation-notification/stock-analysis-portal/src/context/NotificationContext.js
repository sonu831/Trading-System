import React, { createContext, useState, useEffect, useContext } from 'react';
import { useSocket } from '../hooks/useSocket';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]); // For sliding modals
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useSocket();

  // 1. Fetch History on Mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/v1/notifications?limit=20');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data);
          setUnreadCount(data.data.filter(n => !n.is_read).length);
        }
      } catch (e) {
        console.error('Failed to fetch notifications', e);
      }
    };
    fetchHistory();
  }, []);


  // Unique ID generator to prevent duplicate keys
  let notificationCounter = 0;
  const generateUniqueId = () => {
    return `notif-${Date.now()}-${++notificationCounter}`;
  };

  // 2. Listen for Real-time events
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      // Data from socket: { type, message, metadata, ... }
      
      // If it's a persistent notification (has ID), merge it. 
      // If ephemeral (BACKFILL_STATS), show toast but maybe don't add to main list if not saved?
      // For now, treat all socket events as displayable.

      const newNotification = {
        id: data.id || generateUniqueId(),
        type: data.type || 'INFO',
        message: formatMessage(data),
        timestamp: data.created_at || Date.now(),
        read: false,
        data: data
      };

      // Add to list
      setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);

      // Trigger Toast
      addToast(newNotification);
    };

    socket.on('system:notification', handleNotification);

    return () => {
      socket.off('system:notification', handleNotification);
    };
  }, [socket]);


  // Batching state: group notifications within 10 seconds
  const [batchTimer, setBatchTimer] = useState(null);
  const [batchedNotifications, setBatchedNotifications] = useState([]);

  const addToast = (notification) => {
    // Add to batch
    setBatchedNotifications((prev) => [...prev, notification]);

    // Clear existing timer
    if (batchTimer) {
      clearTimeout(batchTimer);
    }

    // Set new timer to flush batch after 10 seconds
    const timer = setTimeout(() => {
      flushBatch();
    }, 10000);

    setBatchTimer(timer);
  };

  const flushBatch = () => {
    if (batchedNotifications.length === 0) return;

    // Create a single grouped toast
    const groupedToast = {
      id: Date.now(),
      type: batchedNotifications[0].type,
      message: batchedNotifications.length === 1 
        ? batchedNotifications[0].message
        : `${batchedNotifications.length} new notifications`,
      count: batchedNotifications.length,
      items: batchedNotifications,
      timestamp: Date.now()
    };

    setToasts((prev) => [...prev, groupedToast]);

    // Auto remove after 5 seconds with proper cleanup
    const toastId = groupedToast.id;
    const removeTimer = setTimeout(() => {
      removeToast(toastId);
    }, 5000);

    // Store timer for cleanup
    groupedToast.removeTimer = removeTimer;

    // Clear batch
    setBatchedNotifications([]);
    setBatchTimer(null);
  };

  const removeToast = (id) => {
    setToasts((prev) => {
      const toast = prev.find(t => t.id === id);
      if (toast?.removeTimer) {
        clearTimeout(toast.removeTimer);
      }
      return prev.filter(t => t.id !== id);
    });
  };

  const markAsRead = async () => {
    // Optimistic update
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Backend update (fire and forget)
    try {
        await fetch('/api/v1/notifications/read-all', { method: 'PUT' });
    } catch (e) { console.error(e); }
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const formatMessage = (data) => {
    if (data.type === 'BACKFILL_STATS') {
        const { inserted, ignored } = data.stats || data.metadata || {};
        return `Backfill: ${inserted || 0} Inserted, ${ignored || 0} Duplicates`;
    }
    return data.message || 'New System Notification';
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        clearNotifications,
        toasts,
        removeToast
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

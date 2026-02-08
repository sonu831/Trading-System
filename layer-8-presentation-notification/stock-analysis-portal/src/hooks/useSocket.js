import { useEffect, useState } from 'react';
import io from 'socket.io-client';

let socket;

export const useSocket = () => {
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    // Only connect once and only on client
    if (typeof window !== 'undefined' && !socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
        transports: ['websocket'],
        path: '/socket.io',
      });

      socket.on('connect', () => {
        console.log('✅ Connected to WebSocket');
      });

      socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket');
      });
    }

    setSocketInstance(socket);

    return () => {
      // Don't disconnect on unmount, keep global connection for notifications
    };
  }, []);

  return socketInstance;
};

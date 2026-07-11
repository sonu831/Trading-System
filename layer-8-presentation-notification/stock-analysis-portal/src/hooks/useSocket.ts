import type { Socket } from 'socket.io-client';
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { cockpitTickPushed, cockpitChainPushed, cockpitRegimePushed, cockpitPositionPushed,
  cockpitExecutionPushed, cockpitAlertPushed, cockpitBreadthPushed } from '@/store/slices/cockpitSlice';

const SOCKET_URL = (process.env.NEXT_PUBLIC_WS_URL as string) || '/';

let socketInstance: Socket | null = null;

function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socket = getSocket();
  const dispatch = useDispatch();
  const roomsRef = useRef<Set<string>>(new Set());

  const subscribe = useCallback((room: string) => {
    if (!roomsRef.current.has(room)) {
      roomsRef.current.add(room);
      socket.emit('subscribe', room);
    }
  }, [socket]);

  useEffect(() => {
    socket.on('tick', (data) => dispatch(cockpitTickPushed(data)));
    socket.on('chain', (data) => dispatch(cockpitChainPushed(data)));
    socket.on('regime', (data) => dispatch(cockpitRegimePushed(data)));
    socket.on('positions', (data) => dispatch(cockpitPositionPushed(data)));
    socket.on('execution', (data) => dispatch(cockpitExecutionPushed(data)));
    socket.on('alert', (data) => dispatch(cockpitAlertPushed(data)));
    socket.on('breadth', (data) => dispatch(cockpitBreadthPushed(data)));

    return () => {
      socket.off('tick'); socket.off('chain'); socket.off('regime'); socket.off('positions');
      socket.off('execution'); socket.off('alert'); socket.off('breadth');
    };
  }, [dispatch, socket]);

  return { socket, subscribe };
}

export default getSocket;

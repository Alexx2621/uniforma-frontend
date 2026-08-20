import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { api } from '../api/axios';

export type { Socket };

export const getRealtimeUrl = () =>
  `${process.env.REACT_APP_REALTIME_URL || api.defaults.baseURL || window.location.origin}`.replace(/\/$/, '');

export const createRealtimeSocket = (): Socket => {
  const externalRelay = Boolean(process.env.REACT_APP_REALTIME_URL);
  return io(getRealtimeUrl(), {
    withCredentials: !externalRelay,
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8_000,
    randomizationFactor: 0.35,
    timeout: 5_000,
  });
};

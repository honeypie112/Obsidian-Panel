const isDev = import.meta.env.MODE === 'development';
// In development, Vite proxy routes /api to backend - use same origin
export const API_URL = import.meta.env.VITE_API_URL || '';
export const SOCKET_URL = import.meta.env.VITE_API_URL || '';

const isDev = import.meta.env.MODE === 'development';
export const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000' : '');
export const SOCKET_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000' : undefined);

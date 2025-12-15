// In production (same origin), use relative paths (empty string).
// In dev (detected by Vite), use localhost:5000 if VITE_API_URL isn't set.

const isDev = import.meta.env.MODE === 'development';

export const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000' : '');

// Socket.io config
// Production: undefined (auto-detects from window.location, which serves the frontend)
// Development: points to backend explicitly
export const SOCKET_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:5000' : undefined);

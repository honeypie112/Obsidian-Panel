// In production (same origin), use relative paths.
// In dev, use env var or localhost fallback.
export const API_URL = import.meta.env.VITE_API_URL || '';

// Socket.io needs a full URL or just path if same origin,
// but for some setups (CORS), it's explicit.
// For same-origin production, undefined/null lets socket.io auto-detect.
export const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

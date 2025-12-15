import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add a request interceptor to add the auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('obsidian_token'); // Ensure this matches what AuthContext uses/will use
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;

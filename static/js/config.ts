/// <reference types="vite/client" />

// API configuration
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment 
    ? 'http://localhost:5002'  // Development
    : window.location.origin;   // Production

export const config = {
    api: {
        pins: `${API_BASE_URL}/pins`,
        connections: `${API_BASE_URL}/connections`,
        randomGif: `${API_BASE_URL}/api/random-gif`,
        downloadPins: `${API_BASE_URL}/download-pins`,
    }
};

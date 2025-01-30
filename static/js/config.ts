// API configuration
const API_BASE_URL = 'http://localhost:5002';

export const config = {
    api: {
        pins: `${API_BASE_URL}/pins`,
        connections: `${API_BASE_URL}/connections`,
        randomGif: `${API_BASE_URL}/api/random-gif`,
    }
};

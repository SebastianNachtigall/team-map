# Technical Context

## Technologies Used

### Frontend
- TypeScript/JavaScript
- Leaflet.js for map visualization
- Server-Sent Events (SSE) for real-time updates
- HTML5/CSS3 for UI components

### Backend
- Python with Flask framework
- File-based JSON storage
- OpenStreetMap for map tiles
- Nominatim API for reverse geocoding
- GIPHY API integration for GIF support

## Development Setup
1. Python Environment
   - Python 3.x required
   - Dependencies managed via pip
   - Requirements listed in requirements.txt

2. Node.js Environment
   - Node.js and npm required
   - TypeScript compilation
   - Vite for development server and building

3. Environment Variables
   - GIPHY_API_KEY for GIF integration
   - PORT configuration (default: 5002)

4. Development Tools
   - Jest for testing
   - ESLint for code linting
   - Docker support for containerization
   - Railway deployment configuration

## Technical Constraints
1. Storage
   - File-based JSON storage system for pins
   - Each pin file contains its own connections
   - No database required
   - Real-time synchronization handled through SSE
   - Efficient bi-directional connection tracking within pins

2. API Limitations
   - Nominatim usage policy requires rate limiting
   - GIPHY API requires valid API key
   - No authentication system implemented

3. Browser Support
   - Modern browsers with ES6+ support
   - CSS Grid and Flexbox for layouts
   - WebSocket/SSE capability required

4. Performance Considerations
   - Client-side rendering of map markers
   - Efficient connection visualization
   - Optimized real-time updates
   - Caching for reverse geocoding results
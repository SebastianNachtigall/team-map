# Technical Context

## Technology Stack

### Frontend
- TypeScript for type-safe JavaScript development
- Leaflet.js for interactive map functionality
- Vite as the build tool and development server
- ESLint for code linting
- Jest for testing

### Backend
- Python 3 with Flask web framework
- Server-Sent Events (SSE) for real-time updates
- Gunicorn as the WSGI HTTP server
- OpenStreetMap for geocoding services
- Giphy API integration for GIF support

## Development Setup

### Prerequisites
1. Python 3.x
2. Node.js and npm
3. Environment Variables:
   - GIPHY_API_KEY: Required for GIF functionality
   - PORT: Optional, defaults to 5002

### Installation Steps
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

### Running the Application
1. Start the Flask backend:
   ```bash
   python app.py
   ```
   - Runs on port 5002 by default
   - Handles API requests and serves static files

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   - Provides hot module replacement
   - Compiles TypeScript in real-time

## Technical Constraints

### Backend
1. Rate Limiting
   - OpenStreetMap geocoding requires 1-second delay between requests
   - Giphy API has rate limits based on API key

2. Data Storage
   - Uses file-based storage in JSON format
   - Pins stored in individual files under pins/ directory
   - Connections stored within pin files

3. Real-time Updates
   - Uses Server-Sent Events for live updates
   - Maintains client connections in memory
   - Broadcasts updates to all connected clients

### Frontend
1. Browser Support
   - Requires modern browser with ES6+ support
   - CSS Grid and Flexbox for layout
   - WebSocket support for real-time updates

2. Map Constraints
   - Uses OpenStreetMap tiles
   - Limited to web Mercator projection
   - Marker clustering not implemented

3. Performance Considerations
   - Lazy loading of images
   - Debounced map interactions
   - Connection animations optimized for performance

## Deployment & Configuration

### Docker Setup
- Multi-stage Dockerfile for development and production
- Development stage includes hot-reloading and debugging tools
- Production stage optimized for performance
- Docker Compose for local development:
  ```yaml
  services:
    web:
      build:
        context: .
        target: development
      volumes:
        - .:/app
      ports:
        - "5173:5173"
        - "5002:5002"
  ```

### Vite Configuration
- Different base URLs for development and production:
  - Development: Uses relative paths (./)
  - Production: Uses absolute paths (/)
- Asset handling:
  - CSS files maintain original structure
  - JavaScript bundled in assets directory
  - Source maps enabled for debugging
- Build output:
  ```
  dist/
    ├── index.html
    ├── static/
    │   └── css/
    └── assets/
        └── [name].[hash].js
  ```

### Environment-Specific Configuration
- Development:
  - Uses Vite dev server with HMR
  - Proxies API requests to Flask backend
  - Supports source maps and debugging
- Production (Railway):
  - Static files served by Flask
  - Assets properly hashed for caching
  - Environment variables for API keys and configuration

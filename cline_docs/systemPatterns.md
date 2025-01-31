# System Patterns

## Architecture Patterns

### 1. Component-Based Architecture
- Main application split into logical managers:
  * MapManager: Handles map initialization and interaction
  * PinManager: Manages pin creation and lifecycle
  * ConnectionManager: Handles connections between pins
  * ActivityFeed: Manages real-time activity updates

### 2. Event-Driven Communication
- Server-Sent Events (SSE) for real-time updates
- Broadcaster pattern for distributing updates
- Event-based UI interactions
- Pub/sub pattern for state changes

### 3. File-Based Storage Pattern
- JSON files as persistent storage for pins
- Each pin file contains:
  * Basic pin data (location, name, etc.)
  * Incoming connections from other pins
  * Outgoing connections to other pins
- Real-time file system synchronization

## Key Technical Decisions

### 1. Map Implementation
- Leaflet.js chosen for:
  * Lightweight and performant
  * Extensive customization options
  * Good TypeScript support
  * Free OpenStreetMap integration

### 2. Backend Architecture
- Flask for simplicity and ease of deployment
- File-based storage instead of database for:
  * Simplified deployment
  * No database administration needed
  * Easy backup and version control
  * Efficient connection management within pin data
  * Sufficient for expected data volume

### 3. Real-Time Updates
- SSE preferred over WebSocket for:
  * Simpler implementation
  * One-way communication sufficient
  * Better reconnection handling
  * Native browser support

### 4. Real-Time Implementation Details
- Frontend SSE Client:
  * Configured through config.ts for environment awareness
  * Automatic reconnection with 5-second delay
  * Event-specific handlers for different update types
  * Error handling with logging

- Event Types:
  * pin_added: Triggers PinManager.handleNewPin
  * connection_added: Triggers ConnectionManager.handleNewConnection
  * activity_update: Updates activity feed

- State Management:
  * In-memory pin tracking in PinManager
  * Connection state in ConnectionManager
  * Duplicate prevention for all events
  * Real-time UI updates without page reloads

### 4. UI/UX Patterns
- Responsive design with mobile support
- Interactive markers with popups
- Visual feedback for user actions
- Animated connections for engagement
- Modular CSS organization

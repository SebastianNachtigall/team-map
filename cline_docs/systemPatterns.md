# System Patterns

## Architecture Overview

### Frontend Architecture
1. Manager Pattern
   - Core managers for different concerns:
     - MapManager: Handles map initialization and interactions
     - PinManager: Manages pin creation, updates, and deletion
     - ConnectionManager: Handles connections between pins
     - ActivityFeed: Manages real-time activity updates

2. Event-Driven Communication
   - Server-Sent Events for real-time updates
   - Custom event system for inter-manager communication
   - Centralized event handling in App class

3. TypeScript Type System
   - Strong typing for data structures
   - Interface definitions for API responses
   - Type guards for runtime safety

### Backend Architecture
1. Flask Application Structure
   - RESTful API endpoints
   - File-based JSON storage
   - Real-time event broadcasting
   - Geocoding service integration

2. Data Storage Pattern
   - Individual JSON files for pins
   - Embedded connections within pin files
   - In-memory caching for performance
   - File system as persistent storage

## Key Technical Decisions

### 1. File-Based Storage
- Decision: Use file system instead of database
- Rationale:
  - Simple deployment without database setup
  - Easy backup and version control
  - Sufficient for expected data volume
  - Direct file access for better performance

### 2. Real-Time Updates
- Decision: Server-Sent Events over WebSockets
- Rationale:
  - Simpler implementation than WebSockets
  - One-way communication sufficient
  - Better browser support
  - Automatic reconnection handling

### 3. Map Implementation
- Decision: Leaflet.js with OpenStreetMap
- Rationale:
  - Open-source and free to use
  - Extensive documentation
  - Good performance
  - Rich feature set
  - Custom control support

### 4. TypeScript Integration
- Decision: Full TypeScript implementation
- Rationale:
  - Type safety during development
  - Better IDE support
  - Easier refactoring
  - Self-documenting code

## Design Patterns Used

### 1. Manager Pattern
- Separates concerns into distinct managers
- Each manager handles specific functionality
- Centralized coordination through App class

### 2. Observer Pattern
- Used for real-time updates
- Broadcaster class manages subscriptions
- Event-based communication between components

### 3. Factory Pattern
- Creation of markers and connections
- Standardized object initialization
- Encapsulated creation logic

### 4. Singleton Pattern
- Single App instance
- Shared manager instances
- Centralized state management

## Code Organization

### Frontend Structure
```
static/
├── css/
│   ├── components/    # Component-specific styles
│   └── main.css       # Global styles
└── js/
    ├── utils/         # Utility functions
    ├── types.ts       # TypeScript definitions
    ├── config.ts      # Configuration
    ├── main.ts        # Application entry
    ├── map.ts         # Map functionality
    ├── pins.ts        # Pin management
    └── connections.ts # Connection handling
```

### Backend Structure
```
/
├── app.py            # Main Flask application
├── pins/             # Pin storage directory
├── connections/      # Connection storage directory
└── static/           # Static files served by Flask
```

## Error Handling
1. Frontend
   - Type-safe error handling
   - Graceful degradation
   - User-friendly error messages

2. Backend
   - Structured error responses
   - Logging system
   - Rate limiting handling

## Build and Asset Patterns

### Asset Organization
1. Development
   - Static assets in source control
   - CSS organized by component
   - Direct TypeScript imports
   - Local file serving

2. Production
   - Hashed asset filenames
   - Bundled and minified code
   - Preserved CSS structure
   - Optimized loading

### Build Process Pattern
1. Development Build
   ```
   Source Files → Vite Dev Server → Hot Module Replacement
        ↓
   Docker Volume → Live Updates → Instant Feedback
   ```

2. Production Build
   ```
   Source Files → Vite Build → Optimized Assets
        ↓
   Docker Image → Flask Static Serving → Production Deploy
   ```

### Environment Configuration Pattern
1. Local Development
   - Docker Compose orchestration
   - Volume mounting for live updates
   - Development-specific Vite config
   - Local environment variables

2. Production Deployment
   - Multi-stage Docker builds
   - Railway-specific configuration
   - Production Vite settings
   - Secure environment variables

### Asset Path Resolution Pattern
1. Development
   - Relative paths for assets
   - Direct source file access
   - HMR for instant updates
   - Proxy for API requests

2. Production
   - Absolute paths from root
   - Hashed file names
   - Cached static assets
   - Direct API access

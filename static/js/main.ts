import { MapManager } from './map';
import { ConnectionManager } from './connections';
import { PinManager } from './pins';
import { ActivityFeed } from './activity';
import { Pin, MarkerWithData } from './types';
import { config } from './config';

declare global {
    interface Window {
        app: App;
    }
}

export class App {
    public mapManager: MapManager;
    public pinManager: PinManager;
    public connectionManager: ConnectionManager;
    public activityFeed: ActivityFeed;

    private async fetchApi(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }
        return response.json();
    }

    constructor() {
        console.log('Initializing App...');
        
        // Initialize managers
        console.log('Initializing MapManager...');
        this.mapManager = new MapManager('map');
        
        console.log('Initializing PinManager...');
        this.pinManager = new PinManager(this.mapManager);
        
        console.log('Initializing ConnectionManager...');
        this.connectionManager = new ConnectionManager(this.mapManager);
        
        console.log('Initializing ActivityFeed...');
        this.activityFeed = new ActivityFeed('activityList');

        // Make app instance globally available
        console.log('Making app instance globally available...');
        window.app = this;

        // Setup event listeners
        console.log('Setting up event listeners...');
        this.setupEventListeners();

        // Initialize pin creation after everything is set up
        console.log('Initializing pin creation...');
        this.mapManager.initializePinCreation();

        // Load initial data
        console.log('Loading initial data...');
        this.loadInitialData()
            .catch(error => {
                console.error('Error loading initial data:', error);
            });

        // Initialize SSE connection
        console.log('Setting up SSE connection...');
        this.setupSSE();
        
        console.log('App initialization complete');
    }

    private setupSSE() {
        const eventSource = new EventSource(config.api.stream);
        
        eventSource.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                console.log('SSE event received:', event);
                
                switch(event.type) {
                    case 'pin_added':
                        console.log('New pin added:', event.pin);
                        this.pinManager.handleNewPin(event.pin);
                        this.activityFeed.addActivity('pin_created', { pin: event.pin });
                        break;
                        
                    case 'connection_added':
                        console.log('New connection added:', event.connection);
                        this.connectionManager.handleNewConnection(event.connection);
                        this.activityFeed.addActivity('connection_created', { connection: event.connection });
                        break;
                        
                    case 'activity_update':
                        console.log('Activity update:', event.message);
                        // Create a generic pin_created activity with just the message
                        this.activityFeed.addActivity('pin_created', {
                            pin: {
                                id: crypto.randomUUID(),
                                name: event.message,
                                lat: 0,
                                lng: 0,
                                timestamp: new Date().toISOString()
                            }
                        });
                        break;
                }
            } catch (error) {
                console.error('Error processing SSE event:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            // Attempt to reconnect after a delay
            setTimeout(() => this.setupSSE(), 5000);
        };
    }

    private async loadInitialData() {
        try {
            // Load pins first
            console.log('Loading pins...');
            await this.pinManager.loadPins();

            // Load connections after pins are loaded
            console.log('Loading connections...');
            await this.connectionManager.loadConnections();
        } catch (error) {
            console.error('Error loading initial data:', error);
            throw error;
        }
    }

    private async getRandomGif(): Promise<string> {
        try {
            const response = await fetch(config.api.randomGif);
            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.status === 'success' && data.url) {
                return data.url;
            }
            throw new Error('Invalid response format');
        } catch (error) {
            console.error('Error fetching random GIF:', error);
            throw error;
        }
    }

    private setupEventListeners() {
        // Clear any existing event listeners
        const existingElements = document.querySelectorAll('[data-has-listeners]');
        existingElements.forEach(el => {
            const newEl = el.cloneNode(true);
            el.parentNode?.replaceChild(newEl, el);
        });

        // Add data attribute to track elements with listeners
        const elementsWithListeners = document.querySelectorAll('button, input');
        elementsWithListeners.forEach(el => {
            el.setAttribute('data-has-listeners', 'true');
        });

        console.log('Setting up event listeners...');
        
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.querySelector('.sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('hidden');
            });
        }
        
        // Show all tooltips after map is loaded
        this.mapManager.getMap().on('load', () => {
            const markers = this.mapManager.getMarkers();
            markers.forEach(marker => {
                if (marker.getTooltip()) {
                    marker.openTooltip();
                }
            });
        });
    }
}

// Create app instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating App instance');
    new App();
});

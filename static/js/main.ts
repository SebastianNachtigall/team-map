import { MapManager } from './map';
import { ConnectionManager } from './connections';
import { PinManager } from './pins';
import { ActivityFeed } from './activity';
import { Pin, MarkerWithData, PinsResponse } from './types';
import { config } from './config';
import { PollingManager } from './utils/polling';

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
    private pollingManager: PollingManager;

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
        
        // Initialize polling manager
        console.log('Initializing PollingManager...');
        this.pollingManager = new PollingManager();
        
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
            
        // Start polling for pins
        this.startPolling();
        
        console.log('App initialization complete');
    }

    private startPolling() {
        // Start polling for pins every 2 seconds
        this.pollingManager.startPolling<PinsResponse>({
            endpoint: config.api.pins,
            interval: 2000,
            onError: (error) => {
                console.error('Polling error:', error);
            }
        }, async (data: PinsResponse) => {
            if (data.status === 'success') {
                // Store current popup state
                const openPopups = new Map<string, boolean>();
                this.mapManager.getMarkers().forEach((marker) => {
                    const markerWithData = marker as MarkerWithData;
                    if (markerWithData.pinId) {
                        openPopups.set(markerWithData.pinId, markerWithData.getPopup()?.isOpen() || false);
                    }
                });

                // Update pins on the map
                this.mapManager.clearMarkers();
                data.pins.forEach((pin: Pin) => {
                    const marker = this.pinManager.addPinToMap(pin);
                    if (marker) {
                        const popupContent = this.pinManager.createPopupContent(pin, marker);
                        marker.bindPopup(popupContent);
                        
                        // Restore popup state
                        if (openPopups.get(pin.id)) {
                            marker.openPopup();
                        }
                    }
                });

                // Update connections
                if (window.app?.connectionManager) {
                    window.app.connectionManager.loadConnections();
                }
            }
        });
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

import { MapManager } from './map';
import { ConnectionManager } from './connections';
import { PinManager } from './pins';
import { ActivityFeed } from './activity';
import { Pin, MarkerWithData, PinsResponse, Connection } from './types';
import { config } from './config';
import { PollingManager } from './utils/polling';
import { SnapshotGenerator } from './utils/snapshot';

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
                // Get current pins on the map
                const currentMarkers = this.mapManager.getMarkers() as MarkerWithData[];
                const currentPinIds = new Set(currentMarkers.map(m => m.pinId).filter(Boolean));
                
                // Get new pins from the response
                const newPinIds = new Set(data.pins.map(p => p.id));
                
                // Store popup states before any changes
                const openPopups = new Map<string, boolean>();
                currentMarkers.forEach(marker => {
                    if (marker.pinId) {
                        openPopups.set(marker.pinId, marker.getPopup()?.isOpen() || false);
                    }
                });

                // Remove deleted pins
                currentMarkers.forEach(marker => {
                    if (marker.pinId && !newPinIds.has(marker.pinId)) {
                        if (marker.labelMarker) {
                            marker.labelMarker.remove();
                        }
                        this.mapManager.removeMarker(marker);
                    }
                });

                // Update existing and add new pins
                data.pins.forEach((pin: Pin) => {
                    if (!currentPinIds.has(pin.id)) {
                        // New pin
                        const marker = this.pinManager.addPinToMap(pin);
                        if (marker) {
                            const popupContent = this.pinManager.createPopupContent(pin, marker);
                            marker.bindPopup(popupContent);
                        }
                    } else {
                        // Existing pin - update if needed
                        const existingMarker = currentMarkers.find(m => m.pinId === pin.id);
                        if (existingMarker) {
                            const popupContent = this.pinManager.createPopupContent(pin, existingMarker);
                            existingMarker.setPopupContent(popupContent);
                            
                            // Restore popup state
                            if (openPopups.get(pin.id)) {
                                existingMarker.openPopup();
                            }
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

    private generateSnapshot() {
        try {
            console.log('Generating snapshot...');
            const pins = this.pinManager.getPins();
            console.log('Pins for snapshot:', pins);
            
            const connections = this.connectionManager.getConnections();
            console.log('Connections for snapshot:', connections);
            
            const map = this.mapManager.getMap();
            console.log('Map for snapshot:', map.getCenter(), map.getZoom());

            console.log('Creating snapshot generator...');
            const snapshotGenerator = new SnapshotGenerator(pins, connections, map);
            
            console.log('Downloading snapshot...');
            snapshotGenerator.downloadSnapshot();
        } catch (error) {
            console.error('Error generating snapshot:', error);
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

        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            console.log('Setting up download button listener');
            downloadBtn.addEventListener('click', () => {
                console.log('Download button clicked');
                this.generateSnapshot();
            });
        } else {
            console.warn('Download button not found in DOM');
        }
        
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.querySelector('.sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('hidden');
            });
        }
        
        // Settings button and dropdown
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDropdown = document.getElementById('settingsDropdown');
        if (settingsBtn && settingsDropdown) {
            // Toggle dropdown on settings button click
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                settingsDropdown.classList.toggle('active');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                settingsDropdown.classList.remove('active');
            });

            // Prevent dropdown from closing when clicking inside it
            settingsDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Download pins button
        const downloadPinsBtn = document.getElementById('downloadPinsBtn');
        if (downloadPinsBtn) {
            downloadPinsBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(config.api.downloadPins);
                    if (!response.ok) {
                        throw new Error('Failed to download pins');
                    }
                    
                    // Get the blob from the response
                    const blob = await response.blob();
                    
                    // Create a URL for the blob
                    const url = window.URL.createObjectURL(blob);
                    
                    // Create a temporary link and click it to download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'pins.zip';
                    document.body.appendChild(a);
                    a.click();
                    
                    // Clean up
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    // Close the dropdown
                    settingsDropdown?.classList.remove('active');
                } catch (error) {
                    console.error('Error downloading pins:', error);
                    alert('Failed to download pins. Please try again.');
                }
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

import { MapManager } from './map';
import { ConnectionManager } from './connections';
import { PinManager } from './pins';
import { ActivityFeed } from './activity';
import { Pin, MarkerWithData } from './types';

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
        this.pinManager.loadPins()
            .then(() => {
                // Load connections after pins are loaded
                console.log('Loading connections...');
                return this.connectionManager.loadConnections();
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
            });
        
        console.log('App initialization complete');
    }

    private async loadInitialData() {
        await this.pinManager.loadPins();
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

import L from 'leaflet';
import { MapConfig, MarkerWithData } from './types';
import { sanitizeText } from './utils/helpers';

export class MapManager {
    private map: L.Map;
    private markers: L.Marker[] = [];
    private defaultConfig: MapConfig = {
        center: L.latLng(50.0, 10.0),  // Center of Europe
        zoom: 4,  // Zoom level to show most of Europe
        maxZoom: 18,
        minZoom: 3
    };
    private containerId: string;
    private isPlacingPin: boolean = false;

    constructor(elementId: string, config: Partial<MapConfig> = {}) {
        console.log('Initializing MapManager with element ID:', elementId);
        this.containerId = elementId;
        const mapConfig = { ...this.defaultConfig, ...config };
        
        this.map = L.map(elementId).setView(
            mapConfig.center,
            mapConfig.zoom
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: mapConfig.maxZoom,
            attribution: ' OpenStreetMap contributors'
        }).addTo(this.map);

        this.setupControls();
        console.log('MapManager initialization complete');
    }

    public initializePinCreation() {
        console.log('Initializing pin creation...');
        this.map.whenReady(() => {
            console.log('Map is ready, initializing pin creation...');
            this.setupPinCreation();
            console.log('Pin creation initialized');
        });
    }

    private setupControls() {
        // Add zoom control
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
    }

    private setupPinCreation() {
        console.log('Setting up pin creation...');
        const addPinBtn = document.getElementById('addPinBtn') as HTMLButtonElement;
        const nameInput = document.getElementById('name') as HTMLInputElement;
        const imageUrlInput = document.getElementById('imageUrl') as HTMLInputElement;
        const luckyGifBtn = document.getElementById('luckyGifBtn') as HTMLButtonElement;
        const instructions = document.getElementById('instructions') as HTMLElement;

        if (!addPinBtn || !nameInput || !imageUrlInput || !luckyGifBtn || !instructions) {
            console.error('Required elements not found:', { addPinBtn, nameInput, imageUrlInput, luckyGifBtn, instructions });
            return;
        }

        // Remove any existing event listeners
        const newLuckyGifBtn = luckyGifBtn.cloneNode(true) as HTMLButtonElement;
        luckyGifBtn.parentNode?.replaceChild(newLuckyGifBtn, luckyGifBtn);

        // Setup lucky GIF button
        newLuckyGifBtn.addEventListener('click', async (event) => {
            console.log('Lucky GIF button clicked');
            event.preventDefault();
            event.stopPropagation();
            
            try {
                newLuckyGifBtn.disabled = true;
                newLuckyGifBtn.textContent = '🎲';
                
                const data = await this.fetchApi('/api/random-gif');
                if (data.status === 'success' && data.url) {
                    console.log('Setting image URL to:', data.url);
                    imageUrlInput.value = data.url;
                } else {
                    console.error('Error fetching random GIF:', data);
                    alert(data.message || 'Could not fetch a random GIF. Please try again!');
                }
            } catch (error) {
                console.error('Error fetching random GIF:', error);
                alert('Could not fetch a random GIF. Please try again!');
            } finally {
                newLuckyGifBtn.disabled = false;
                newLuckyGifBtn.textContent = '🍀';
            }
        });

        const resetPinCreation = () => {
            console.log('Resetting pin creation state...');
            this.isPlacingPin = false;
            addPinBtn.textContent = 'Add Pin';
            addPinBtn.classList.remove('active');
            instructions.textContent = 'Click "Add Pin" to place marker';
        };

        // Update button state when name field changes
        nameInput.addEventListener('input', () => {
            console.log('Name input changed:', nameInput.value);
            if (!nameInput.value) {
                resetPinCreation();
                if (this.isPlacingPin && window.app?.pinManager) {
                    window.app.pinManager.cancelPinMode();
                }
            }
        });

        addPinBtn.addEventListener('click', () => {
            console.log('Add pin button clicked, name:', nameInput.value);
            if (!nameInput.value) {
                alert('Please enter your name first');
                return;
            }

            if (this.isPlacingPin) {
                console.log('Cancelling pin creation...');
                resetPinCreation();
                if (window.app?.pinManager) {
                    window.app.pinManager.cancelPinMode();
                }
            } else {
                console.log('Starting pin creation...');
                this.isPlacingPin = true;
                addPinBtn.textContent = 'Now place marker';
                addPinBtn.classList.add('active');
                instructions.textContent = 'Click on the map to place your marker';
                if (window.app?.pinManager) {
                    window.app.pinManager.startPinMode(nameInput.value, imageUrlInput.value);
                }
            }
        });

        if (window.app?.pinManager) {
            window.app.pinManager.onPinCreated = () => {
                console.log('Pin created, resetting form...');
                nameInput.value = '';
                imageUrlInput.value = '';
                resetPinCreation();
            };
        }

        console.log('Pin creation setup complete');
    }

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

    public getMap(): L.Map {
        return this.map;
    }

    public addMarker(lat: number, lng: number, options: L.MarkerOptions = {}): L.Marker {
        const marker = L.marker([lat, lng], options);
        marker.addTo(this.map);
        this.markers.push(marker);
        return marker;
    }

    public removeMarker(marker: L.Marker) {
        const index = this.markers.indexOf(marker);
        if (index > -1) {
            this.markers.splice(index, 1);
            marker.remove();
            if (marker.associatedLabel) {
                marker.associatedLabel.remove();
            }
        }
    }

    public createMarkerLabel(marker: L.Marker, text: string): L.Marker {
        const labelIcon = L.divIcon({
            className: 'marker-label',
            html: `<div class="label-content">${sanitizeText(text)}</div>`,
            iconSize: null
        });

        const labelLatLng = L.latLng(
            marker.getLatLng().lat + 0.0002,
            marker.getLatLng().lng
        );

        const label = L.marker(labelLatLng, {
            icon: labelIcon,
            zIndexOffset: 1000,
            interactive: true
        });

        label.on('click', () => {
            marker.openPopup();
        });

        return label;
    }

    public getMarkers(): L.Marker[] {
        return this.markers;
    }

    public clearMarkers() {
        this.markers.forEach(marker => this.removeMarker(marker));
        this.markers = [];
    }

    public panTo(lat: number, lng: number, zoom?: number) {
        if (zoom) {
            this.map.setView([lat, lng], zoom);
        } else {
            this.map.panTo([lat, lng]);
        }
    }

    private createPin(name: string, latlng: L.LatLng, imageUrl: string) {
        // Delegate to PinManager
        window.app.pinManager.startPinMode(name, imageUrl);
    }
}

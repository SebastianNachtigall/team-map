import L from 'leaflet';
import { Pin, MarkerWithData } from './types';
import { MapManager } from './map';

export class PinManager {
    private mapManager: MapManager;
    private isPinMode: boolean = false;
    private selectedMarker: MarkerWithData | null = null;
    private pinName: string = '';
    private pinImageUrl: string = '';
    private boundHandleMapClick: (e: L.LeafletMouseEvent) => void;
    public onPinCreated: () => void = () => {};

    constructor(mapManager: MapManager) {
        this.mapManager = mapManager;
        this.boundHandleMapClick = this.handleMapClick.bind(this);
    }

    public startPinMode(name: string, imageUrl: string = '') {
        console.log('Starting pin mode with:', { name, imageUrl });
        this.isPinMode = true;
        this.pinName = name;
        this.pinImageUrl = imageUrl;
        const map = this.mapManager.getMap();
        map.getContainer().style.cursor = 'crosshair';
        map.on('click', this.boundHandleMapClick);
        console.log('Map click handler attached');
    }

    public cancelPinMode() {
        console.log('Cancelling pin mode');
        this.isPinMode = false;
        this.pinName = '';
        this.pinImageUrl = '';
        const map = this.mapManager.getMap();
        map.getContainer().style.cursor = '';
        map.off('click', this.boundHandleMapClick);
    }

    private async handleMapClick(e: L.LeafletMouseEvent) {
        console.log('Map clicked, isPinMode:', this.isPinMode);
        if (!this.isPinMode) {
            console.log('Not in pin mode, ignoring click');
            return;
        }

        try {
            const pinData = {
                name: this.pinName,
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                imageUrl: this.pinImageUrl
            };
            console.log('Creating pin with data:', pinData);

            // Show loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingText = document.getElementById('loading-text');
            if (loadingOverlay && loadingText) {
                loadingText.textContent = 'Creating pin...';
                loadingOverlay.classList.remove('hidden');
            }

            const response = await fetch('http://localhost:5002/pins', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pinData)
            });

            console.log('Pin creation response:', response.status);
            const data = await response.json();
            console.log('Pin creation data:', data);

            if (data.status === 'success' && data.pin) {
                console.log('Pin created successfully:', data.pin);
                this.addPinToMap(data.pin);
                
                // Add the new pin to the activity feed
                window.app?.activityFeed?.addActivity('pin_created', { pin: data.pin });
                
                this.cancelPinMode();
                this.onPinCreated();
            } else {
                console.error('Error response:', data);
                alert('Error creating pin: ' + (data.message || 'Unknown error'));
                this.cancelPinMode();
                this.onPinCreated();
            }
        } catch (error) {
            console.error('Error creating pin:', error);
            alert('Error creating pin. Please try again.');
            this.cancelPinMode();
            this.onPinCreated();
        } finally {
            // Hide loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    public async loadPins(): Promise<void> {
        try {
            const response = await fetch('http://localhost:5002/pins');
            const data = await response.json();
            
            if (data.status === 'success' && data.pins) {
                // Clear existing markers
                this.mapManager.clearMarkers();
                
                // Add each pin and create activity
                data.pins.forEach((pin: Pin) => {
                    const marker = this.addPinToMap(pin);
                    // Bind popup to marker
                    if (marker) {
                        const popupContent = this.createPopupContent(pin, marker);
                        marker.bindPopup(popupContent);
                    }
                    // Add to activity feed with isExisting flag
                    window.app?.activityFeed?.addActivity('pin_created', { pin }, true);
                });
            }
        } catch (error) {
            console.error('Error loading pins:', error);
            throw error; // Propagate error to caller
        }
    }

    public addPinToMap(pin: Pin) {
        console.log('Adding pin to map:', pin);
        try {
            console.log('Creating marker for pin:', pin);
            
            // Create the regular marker first
            const marker = this.mapManager.addMarker(pin.lat, pin.lng) as MarkerWithData;
            
            marker.pinId = pin.id;
            marker.pinData = pin;

            // Add the label separately
            const labelIcon = L.divIcon({
                className: 'label-only',
                html: `<div class="pin-label">${pin.name}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 45]  // Move label up above the marker
            });
            
            // Create and store the label marker
            marker.labelMarker = L.marker([pin.lat, pin.lng], {
                icon: labelIcon,
                interactive: false,
                zIndexOffset: 100
            }).addTo(this.mapManager.getMap());

            const popupContent = this.createPopupContent(pin, marker);
            marker.bindPopup(popupContent);

            // Add click handler for marker selection
            marker.on('click', (e) => {
                if (!this.isPinMode) {
                    L.DomEvent.stopPropagation(e);
                    this.setSelectedMarker(marker);
                    marker.openPopup();
                }
            });

            return marker;
        } catch (error) {
            console.error('Error adding pin to map:', error);
            throw error;
        }
    }

    public async deletePin(pinId: string) {
        console.log('Deleting pin:', pinId);
        try {
            const response = await fetch(`http://localhost:5002/pins/${pinId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // Find and remove the marker
                const markers = this.mapManager.getMarkers();
                const markerToDelete = markers.find(m => 
                    (m as MarkerWithData).pinId === pinId
                ) as MarkerWithData | undefined;
                
                if (markerToDelete) {
                    // If this was the selected marker, clear selection
                    if (this.selectedMarker === markerToDelete) {
                        this.selectedMarker = null;
                    }
                    
                    // Remove the label marker if it exists
                    if (markerToDelete.labelMarker) {
                        markerToDelete.labelMarker.remove();
                    }
                    
                    // Remove the marker from the map
                    markerToDelete.remove();
                    
                    // Add delete activity
                    window.app?.activityFeed?.addActivity('pin_deleted', { pin: markerToDelete.pinData });
                }
            }
        } catch (error) {
            console.error('Error deleting pin:', error);
            throw error;
        }
    }

    public getSelectedMarker(): MarkerWithData | null {
        console.log('Getting selected marker:', this.selectedMarker);
        return this.selectedMarker;
    }

    private setSelectedMarker(marker: MarkerWithData) {
        console.log('Setting selected marker:', marker);
        
        // Deselect previous marker if any
        if (this.selectedMarker) {
            this.selectedMarker.setOpacity(1);
        }

        this.selectedMarker = marker;
        
        // Add visual feedback to new marker
        marker.setOpacity(0.8);
    }

    public getMarkers(): L.Marker[] {
        console.log('Getting markers from map...');
        const markers: L.Marker[] = [];
        this.mapManager.getMap().eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            }
        });
        console.log('Found markers:', markers);
        return markers;
    }

    public findPinById(pinId: string): Pin | undefined {
        const marker = this.mapManager.getMarkers().find(m => 
            (m as MarkerWithData).pinId === pinId
        ) as MarkerWithData | undefined;
        
        return marker?.pinData;
    }

    private createPopupContent(pin: Pin, marker: MarkerWithData): HTMLElement {
        const popupContent = document.createElement('div');
        popupContent.className = 'pin-popup';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'pin-popup-header';
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'Delete pin';
        deleteButton.className = 'delete-button';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            this.deletePin(pin.id);
        };
        headerDiv.appendChild(deleteButton);

        const connectButton = document.createElement('button');
        connectButton.innerHTML = '❤️';
        connectButton.title = 'Connect this pin';
        connectButton.className = 'connect-button';
        connectButton.onclick = (e) => {
            e.stopPropagation();
            if (window.app?.connectionManager) {
                window.app.connectionManager.startConnectionMode(marker);
                marker.closePopup();
            }
        };
        headerDiv.appendChild(connectButton);
        
        const nameElement = document.createElement('h3');
        nameElement.textContent = pin.name;
        headerDiv.appendChild(nameElement);
        
        popupContent.appendChild(headerDiv);
        
        if (pin.imageUrl) {
            const img = document.createElement('img');
            img.src = pin.imageUrl;
            img.alt = pin.name;
            img.className = 'pin-popup-image';
            popupContent.appendChild(img);
        }

        // Add connections list
        const connectionsDiv = document.createElement('div');
        connectionsDiv.className = 'pin-connections';
        
        if (window.app?.connectionManager) {
            const connections = window.app.connectionManager.findConnectionsForPin(pin.id);
            
            if (connections && connections.length > 0) {
                const connectionsTitle = document.createElement('h4');
                connectionsTitle.textContent = 'Connected to:';
                connectionsDiv.appendChild(connectionsTitle);

                const connectionsList = document.createElement('ul');
                connectionsList.className = 'connections-list';
                
                connections.forEach(connection => {
                    const otherPinId = connection.sourceId === pin.id ? connection.targetId : connection.sourceId;
                    const otherPin = this.findPinById(otherPinId);
                    
                    if (otherPin) {
                        const listItem = document.createElement('li');
                        listItem.className = 'connection-item';
                        
                        const nameSpan = document.createElement('span');
                        nameSpan.textContent = otherPin.name;
                        listItem.appendChild(nameSpan);
                        
                        const deleteButton = document.createElement('button');
                        deleteButton.innerHTML = '💔';
                        deleteButton.title = 'Remove connection';
                        deleteButton.className = 'delete-connection-button';
                        deleteButton.onclick = async (e) => {
                            e.stopPropagation();
                            try {
                                await window.app?.connectionManager?.deleteConnection(connection, {
                                    initiatorPinId: pin.id,
                                    initiatorPinName: pin.name,
                                    otherPinName: otherPin.name
                                });
                                // Update the popup content
                                const newContent = this.createPopupContent(pin, marker);
                                marker.getPopup()?.setContent(newContent);
                            } catch (error) {
                                console.error('Error deleting connection:', error);
                                alert('Failed to delete connection. Please try again.');
                            }
                        };
                        listItem.appendChild(deleteButton);
                        
                        connectionsList.appendChild(listItem);
                    }
                });
                
                connectionsDiv.appendChild(connectionsList);
            }
        }
        
        popupContent.appendChild(connectionsDiv);
        return popupContent;
    }
}

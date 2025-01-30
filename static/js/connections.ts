import L from 'leaflet';
import { Connection, MarkerWithData } from './types';
import { MapManager } from './map';

export class ConnectionManager {
    private mapManager: MapManager;
    private connections: Connection[] = [];
    private connectionLines: L.Path[] = [];
    private connectionHearts: HTMLElement[] = [];
    private isConnectionMode: boolean = false;
    private sourceMarker: MarkerWithData | null = null;
    private markerClickHandlers: Map<MarkerWithData, (e: L.LeafletMouseEvent) => void> = new Map();

    constructor(mapManager: MapManager) {
        this.mapManager = mapManager;
        
        // Create container for hearts
        const heartContainer = document.createElement('div');
        heartContainer.className = 'heart-container';
        document.querySelector('#map')?.appendChild(heartContainer);
        
        // Add escape key handler to cancel connection mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isConnectionMode) {
                this.cancelConnectionMode();
            }
        });
        
        // Add map click handler to cancel connection mode
        this.mapManager.getMap().on('click', () => {
            if (this.isConnectionMode) {
                this.cancelConnectionMode();
            }
        });

        // Load initial connections
        this.loadConnections();
    }

    public startConnectionMode(marker: MarkerWithData) {
        // If already in connection mode, cancel it first
        if (this.isConnectionMode) {
            this.cancelConnectionMode();
        }
        
        this.isConnectionMode = true;
        this.sourceMarker = marker;
        
        // Add source marker class
        const sourceElement = marker.getElement();
        if (sourceElement) {
            sourceElement.classList.add('source-marker');
        }
        
        // Add visual feedback to other markers
        this.mapManager.getMarkers().forEach((m: L.Marker) => {
            if (m !== marker) {
                const markerWithData = m as MarkerWithData;
                const element = markerWithData.getElement();
                if (element) {
                    element.classList.add('available-target');
                }
                
                const handler = (e: L.LeafletMouseEvent) => {
                    L.DomEvent.stopPropagation(e);
                    this.handleMarkerClick(markerWithData);
                };
                this.markerClickHandlers.set(markerWithData, handler);
                markerWithData.on('click', handler);
            }
        });
        
        const map = this.mapManager.getMap();
        map.getContainer().classList.add('connection-mode');
    }

    public cancelConnectionMode() {
        if (!this.isConnectionMode) return;
        
        // Remove source marker class
        if (this.sourceMarker) {
            const sourceElement = this.sourceMarker.getElement();
            if (sourceElement) {
                sourceElement.classList.remove('source-marker');
            }
        }
        
        // Remove classes and handlers from other markers
        this.mapManager.getMarkers().forEach(m => {
            if (m !== this.sourceMarker) {
                const element = m.getElement();
                if (element) {
                    element.classList.remove('available-target');
                }
                
                const handler = this.markerClickHandlers.get(m as MarkerWithData);
                if (handler) {
                    (m as MarkerWithData).off('click', handler);
                    this.markerClickHandlers.delete(m as MarkerWithData);
                }
            }
        });
        
        const map = this.mapManager.getMap();
        map.getContainer().classList.remove('connection-mode');
        
        this.isConnectionMode = false;
        this.sourceMarker = null;
    }

    private async handleMarkerClick(targetMarker: MarkerWithData) {
        if (!this.sourceMarker || !this.isConnectionMode) {
            return;
        }

        try {
            const response = await this.fetchApi('/connections', {
                method: 'POST',
                body: JSON.stringify({
                    sourceId: this.sourceMarker.pinId,
                    targetId: targetMarker.pinId
                })
            });

            const data = await response.json();
            
            if (data.status === 'success' && data.connection) {
                // Add activity for new connection
                window.app?.activityFeed?.addActivity('connection_created', { connection: data.connection });
                
                // Reload all connections to ensure UI is in sync
                await this.loadConnections();
                
                // Update both source and target pin popups
                const sourcePin = window.app?.pinManager?.findPinById(this.sourceMarker.pinId);
                const targetPin = window.app?.pinManager?.findPinById(targetMarker.pinId);
                
                if (sourcePin && targetPin) {
                    // Update source pin popup
                    const sourceContent = window.app?.pinManager?.createPopupContent(sourcePin, this.sourceMarker);
                    if (sourceContent) {
                        this.sourceMarker.getPopup()?.setContent(sourceContent);
                    }
                    
                    // Update target pin popup
                    const targetContent = window.app?.pinManager?.createPopupContent(targetPin, targetMarker);
                    if (targetContent) {
                        targetMarker.getPopup()?.setContent(targetContent);
                    }
                }
                
                this.cancelConnectionMode();
            } else {
                console.error('Error response:', data);
                alert('Error creating connection: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating connection:', error);
            alert('Error creating connection. Please try again.');
        }
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

    public async loadConnections() {
        try {
            const response = await this.fetchApi('/connections');
            const data = await response.json();
            
            if (data.status === 'success' && data.connections) {
                // Clear existing connections first
                this.clearConnections();
                
                // Add each connection
                data.connections.forEach((connection: Connection) => {
                    this.connections.push(connection);
                    
                    // Find markers
                    const markers = this.mapManager.getMarkers();
                    const sourceMarker = markers.find(m => 
                        (m as MarkerWithData).pinId === connection.sourceId
                    ) as MarkerWithData | undefined;
                    
                    const targetMarker = markers.find(m => 
                        (m as MarkerWithData).pinId === connection.targetId
                    ) as MarkerWithData | undefined;
                    
                    if (sourceMarker && targetMarker) {
                        const line = this.createCurvedLine(
                            sourceMarker.getLatLng(),
                            targetMarker.getLatLng()
                        );
                        
                        // Store connection reference
                        (line as any).options.connection = connection;
                        
                        line.addTo(this.mapManager.getMap());
                        this.connectionLines.push(line);
                        
                        // Add heart to the connection
                        this.addTravelingHeart(line);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading connections:', error);
        }
    }

    public addConnection(connection: Connection) {
        this.connections.push(connection);
        
        // Find markers with proper type checking
        const markers = this.mapManager.getMarkers();
        const sourceMarker = markers.find(m => 
            (m as MarkerWithData).pinId === connection.sourceId
        ) as MarkerWithData | undefined;
        
        const targetMarker = markers.find(m => 
            (m as MarkerWithData).pinId === connection.targetId
        ) as MarkerWithData | undefined;

        if (sourceMarker && targetMarker) {
            const line = this.createCurvedLine(
                sourceMarker.getLatLng(),
                targetMarker.getLatLng()
            );
            
            // Store the connection ID in the line options for reference
            (line as any).options.connection = connection;
            
            line.addTo(this.mapManager.getMap());
            this.connectionLines.push(line);

            // Add traveling heart
            this.addTravelingHeart(line);
        }
    }

    public findConnectionsForPin(pinId: string): Connection[] {
        const connections = this.connections.filter(conn => 
            conn.sourceId === pinId || conn.targetId === pinId
        );
        return connections;
    }

    public async deleteConnection(connection: Connection, pinInfo?: { initiatorPinId: string, initiatorPinName: string, otherPinName: string }) {
        try {
            const response = await this.fetchApi(`/connections/${connection.sourceId}/${connection.targetId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'success') {
                // Add activity for deleted connection with pin names in correct order
                if (pinInfo) {
                    window.app?.activityFeed?.addActivity('connection_deleted', {
                        connection,
                        firstPinName: pinInfo.initiatorPinName,
                        secondPinName: pinInfo.otherPinName
                    });
                } else {
                    window.app?.activityFeed?.addActivity('connection_deleted', { connection });
                }
                
                // Reload all connections to ensure UI is in sync
                await this.loadConnections();
                
                // Update both source and target pin popups
                const sourcePin = window.app?.pinManager?.findPinById(connection.sourceId);
                const targetPin = window.app?.pinManager?.findPinById(connection.targetId);
                
                const markers = this.mapManager.getMarkers();
                const sourceMarker = markers.find(m => (m as MarkerWithData).pinId === connection.sourceId) as MarkerWithData;
                const targetMarker = markers.find(m => (m as MarkerWithData).pinId === connection.targetId) as MarkerWithData;
                
                if (sourcePin && targetPin && sourceMarker && targetMarker) {
                    // Update source pin popup
                    const sourceContent = window.app?.pinManager?.createPopupContent(sourcePin, sourceMarker);
                    if (sourceContent && sourceMarker.getPopup()?.isOpen()) {
                        sourceMarker.getPopup()?.setContent(sourceContent);
                    }
                    
                    // Update target pin popup
                    const targetContent = window.app?.pinManager?.createPopupContent(targetPin, targetMarker);
                    if (targetContent && targetMarker.getPopup()?.isOpen()) {
                        targetMarker.getPopup()?.setContent(targetContent);
                    }
                }
            } else {
                throw new Error(data.message || 'Failed to delete connection');
            }
        } catch (error) {
            console.error('Error deleting connection:', error);
            throw error;
        }
    }

    private addTravelingHeart(line: L.Polyline) {
        // Get the curved points array we stored earlier
        const points = (line as any).curvePoints;
        if (!Array.isArray(points) || points.length < 2) return;

        const map = this.mapManager.getMap();
        if (!map) return;

        const heartEl = document.createElement('div');
        heartEl.className = 'connection-heart';
        heartEl.innerHTML = '❤️';
        const mapContainer = document.querySelector('#map');
        if (!mapContainer) return;
        mapContainer.appendChild(heartEl);

        this.connectionHearts.push(heartEl);

        let currentIndex = 0;
        let reverse = false;

        const updatePosition = () => {
            // Get the current point along the curve
            const position = Math.floor(currentIndex);
            const nextPosition = Math.min(position + 1, points.length - 1);
            const progress = currentIndex - position;

            // Interpolate between current and next point
            const currentPoint = points[position];
            const nextPoint = points[nextPosition];
            
            const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
            const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * progress;
            const currentLatLng = new L.LatLng(lat, lng);

            // Update heart position
            const point = map.latLngToContainerPoint(currentLatLng);
            heartEl.style.left = point.x + 'px';
            heartEl.style.top = point.y + 'px';

            // Update progress along the curve
            if (reverse) {
                currentIndex -= 0.2; // Speed of movement
                if (currentIndex <= 0) {
                    currentIndex = 0;
                    reverse = false;
                }
            } else {
                currentIndex += 0.2; // Speed of movement
                if (currentIndex >= points.length - 1) {
                    currentIndex = points.length - 1;
                    reverse = true;
                }
            }

            requestAnimationFrame(updatePosition);
        };

        requestAnimationFrame(updatePosition);
    }

    private createCurvedLine(start: L.LatLng, end: L.LatLng): L.Polyline {
        // Calculate distance and angle between points
        const dx = end.lng - start.lng;
        const dy = end.lat - start.lat;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate midpoint
        const midPoint = new L.LatLng(
            (start.lat + end.lat) / 2,
            (start.lng + end.lng) / 2
        );
        
        // Calculate control point offset (30% of distance for more pronounced curve)
        const offset = distance * 0.3;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        
        // Create control point perpendicular to the line
        const controlPoint = new L.LatLng(
            midPoint.lat + offset * Math.sin(angle),
            midPoint.lng + offset * Math.cos(angle)
        );
        
        // Create points for the curved line
        const points = [];
        const segments = 100; // More segments for smoother curve
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            // Quadratic Bezier curve formula
            const lat = (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * controlPoint.lat + t * t * end.lat;
            const lng = (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * controlPoint.lng + t * t * end.lng;
            points.push(new L.LatLng(lat, lng));
        }
        
        // Create the curved line and store points
        const line = L.polyline(points, {
            color: '#e74c3c',
            weight: 3,
            opacity: 0.8,
            smoothFactor: 1
        });

        // Store points for animation
        (line as any).curvePoints = points;
        
        return line;
    }

    public clearConnections() {
        // Remove all lines
        this.connectionLines.forEach(line => {
            if (line && line.remove) {
                line.remove();
            }
        });
        
        // Remove all hearts
        this.connectionHearts.forEach(heart => {
            heart.remove();
        });
        
        // Clear arrays
        this.connectionLines = [];
        this.connectionHearts = [];
        this.connections = [];
    }
}

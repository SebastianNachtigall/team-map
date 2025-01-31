import L from 'leaflet';
import { MapManager } from './map';
import { MarkerWithData } from './types';
import { config } from './config';

import { Connection } from './types';

export class ConnectionManager {
    private highlightMarker(marker: MarkerWithData) {
        const icon = marker.getIcon() as L.Icon;
        marker.setOpacity(0.8);
    }

    private resetMarker(marker: MarkerWithData) {
        marker.setOpacity(1);
    }

    private mapManager: MapManager;
    private connections: Map<string, Connection> = new Map();
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

    private async handleMarkerClick(marker: MarkerWithData) {
        if (!this.sourceMarker) {
            // First click - set source marker
            this.sourceMarker = marker;
            this.highlightMarker(marker);
            return;
        }

        if (this.sourceMarker === marker) {
            // Clicked same marker twice - deselect
            this.resetMarker(marker);
            this.sourceMarker = null;
            return;
        }

        // Second click - create connection
        const targetMarker = marker;

        // Check if connection already exists
        const existingConnection = this.findConnection(this.sourceMarker.pinId, targetMarker.pinId);
        if (existingConnection) {
            console.log('Connection already exists');
            this.resetMarker(this.sourceMarker);
            this.sourceMarker = null;
            return;
        }

        try {
            const data = await this.fetchApi(config.api.connections, {
                method: 'POST',
                body: JSON.stringify({
                    sourceId: this.sourceMarker.pinId,
                    targetId: targetMarker.pinId
                })
            });

            if (data.status === 'success' && data.connection) {
                // Draw the new connection
                this.drawConnection(data.connection);

                // Update both pins' popups
                if (window.app?.pinManager) {
                    const sourcePin = window.app.pinManager.findPinById(this.sourceMarker.pinId);
                    const targetPin = window.app.pinManager.findPinById(targetMarker.pinId);
                    
                    if (sourcePin && this.sourceMarker) {
                        const sourceContent = window.app.pinManager.createPopupContent(sourcePin, this.sourceMarker);
                        this.sourceMarker.getPopup()?.setContent(sourceContent);
                    }
                    
                    if (targetPin) {
                        const targetContent = window.app.pinManager.createPopupContent(targetPin, targetMarker);
                        targetMarker.getPopup()?.setContent(targetContent);
                    }
                }

                // Reset source marker
                if (this.sourceMarker) {
                    this.resetMarker(this.sourceMarker);
                    this.sourceMarker = null;
                }

                // Add activity
                if (window.app?.activityFeed) {
                    window.app.activityFeed.addActivity('connection_created', {
                        connection: data.connection
                    });
                }
            }
        } catch (error) {
            console.error('Error creating connection:', error);
            if (this.sourceMarker) {
                this.resetMarker(this.sourceMarker);
                this.sourceMarker = null;
            }
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
            console.log('Loading connections...');
            const response = await this.fetchApi(config.api.connections);
            if (response.status === 'success' && Array.isArray(response.connections)) {
                console.log('Connections loaded:', response.connections);
                this.drawConnections(response.connections);
            } else {
                console.error('Invalid response format:', response);
            }
        } catch (error) {
            console.error('Error loading connections:', error);
            throw error;
        }
    }

    public findConnectionsForPin(pinId: string): Connection[] {
        const connections: Connection[] = [];
        for (const connection of this.connections.values()) {
            if (connection.sourceId === pinId || connection.targetId === pinId) {
                connections.push(connection);
            }
        }
        return connections;
    }

    private findConnection(sourceId: string, targetId: string): Connection | undefined {
        // Find connection in existing connections
        const connections = this.connections.values();
        for (const connection of connections) {
            if (connection.sourceId === sourceId && connection.targetId === targetId) {
                return connection;
            }
        }
        return undefined;
    }

    private drawConnections(connections: Connection[]) {
        connections.forEach(connection => {
            this.drawConnection(connection);
        });
    }

    private drawConnection(connection: Connection) {
        // Store the connection in our map
        const connectionId = `${connection.sourceId}-${connection.targetId}`;
        this.connections.set(connectionId, connection);

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

    public async deleteConnection(connection: Connection, metadata?: {
        initiatorPinId: string;
        initiatorPinName: string;
        otherPinName: string;
    }): Promise<void> {
        try {
            const response = await this.fetchApi(
                `${config.api.connections}/${connection.sourceId}/${connection.targetId}`,
                { method: 'DELETE' }
            );

            if (response.status === 'success') {
                // Remove the connection line and heart
                const connectionId = `${connection.sourceId}-${connection.targetId}`;
                const lineIndex = this.connectionLines.findIndex(line => {
                    const conn = (line as any).options.connection;
                    return conn && conn.sourceId === connection.sourceId && conn.targetId === connection.targetId;
                });

                if (lineIndex !== -1) {
                    const line = this.connectionLines[lineIndex];
                    line.remove();
                    this.connectionLines.splice(lineIndex, 1);

                    if (this.connectionHearts[lineIndex]) {
                        this.connectionHearts[lineIndex].remove();
                        this.connectionHearts.splice(lineIndex, 1);
                    }
                }

                // Remove from connections map
                this.connections.delete(connectionId);

                // Update both pins' popups
                if (window.app?.pinManager) {
                    // Find both markers
                    const markers = this.mapManager.getMarkers();
                    const sourceMarker = markers.find(m => 
                        (m as MarkerWithData).pinId === connection.sourceId
                    ) as MarkerWithData | undefined;
                    
                    const targetMarker = markers.find(m => 
                        (m as MarkerWithData).pinId === connection.targetId
                    ) as MarkerWithData | undefined;

                    // Update source pin popup
                    if (sourceMarker) {
                        const sourcePin = window.app.pinManager.findPinById(connection.sourceId);
                        if (sourcePin) {
                            const sourceContent = window.app.pinManager.createPopupContent(sourcePin, sourceMarker);
                            sourceMarker.getPopup()?.setContent(sourceContent);
                        }
                    }

                    // Update target pin popup
                    if (targetMarker) {
                        const targetPin = window.app.pinManager.findPinById(connection.targetId);
                        if (targetPin) {
                            const targetContent = window.app.pinManager.createPopupContent(targetPin, targetMarker);
                            targetMarker.getPopup()?.setContent(targetContent);
                        }
                    }
                }

                // Add to activity feed
                if (window.app?.activityFeed) {
                    window.app.activityFeed.addActivity('connection_deleted', {
                        connection: {
                            id: connection.id,
                            sourceId: connection.sourceId,
                            targetId: connection.targetId,
                            timestamp: connection.timestamp
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error deleting connection:', error);
            throw error;
        }
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
        
        // Clear arrays and map
        this.connectionLines = [];
        this.connectionHearts = [];
        this.connections.clear();
    }
}

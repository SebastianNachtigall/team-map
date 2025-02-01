import { Pin, Connection } from '../types';

export class SnapshotGenerator {
    private pins: Pin[];
    private connections: Connection[];
    private mapState: {
        center: [number, number];
        zoom: number;
    };

    constructor(pins: Pin[], connections: Connection[], map: L.Map) {
        this.pins = pins;
        this.connections = connections;
        this.mapState = {
            center: [map.getCenter().lat, map.getCenter().lng],
            zoom: map.getZoom()
        };
    }

    private findPinById(id: string): Pin | undefined {
        return this.pins.find(pin => pin.id === id);
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private generatePinsJs(): string {
        return this.pins.map(pin => `
            (function() {
                const marker = L.marker([${pin.lat}, ${pin.lng}], {
                    title: "${this.escapeHtml(pin.name)}"
                });

                const popup = L.popup({
                    minWidth: 220,
                    maxWidth: 220
                }).setContent(\`
                    <div class="popup-content">
                        <h3>${this.escapeHtml(pin.name)}</h3>
                        ${pin.imageUrl ? `
                            <img 
                                src="${this.escapeHtml(pin.imageUrl)}" 
                                alt="${this.escapeHtml(pin.name)}'s image" 
                                class="popup-gif"
                                onload="this.closest('.leaflet-popup-content-wrapper').style.width = '220px'"
                            />
                        ` : ''}
                        ${pin.location ? `<p>${this.escapeHtml(pin.location)}</p>` : ''}
                    </div>
                \`);

                marker.bindPopup(popup).addTo(map);
            })();
        `).join('\n');
    }

    private generateConnectionsJs(): string {
        return this.connections.map(conn => {
            const sourcePin = this.findPinById(conn.sourceId);
            const targetPin = this.findPinById(conn.targetId);
            
            if (!sourcePin || !targetPin) return '';
            
            return `
            (function() {
                try {
                    const source = [${sourcePin.lat}, ${sourcePin.lng}];
                    const target = [${targetPin.lat}, ${targetPin.lng}];
                    const points = [];
                    
                    // Calculate control point
                    const midLat = (source[0] + target[0]) / 2;
                    const midLng = (source[1] + target[1]) / 2;
                    const latOffset = Math.abs(source[1] - target[1]) * 0.2;
                    const controlPoint = [midLat, midLng + latOffset];
                    
                    // Generate curve points
                    for (let t = 0; t <= 1; t += 0.05) {
                        const lat = Math.pow(1-t, 2) * source[0] + 
                                  2 * (1-t) * t * controlPoint[0] + 
                                  Math.pow(t, 2) * target[0];
                        const lng = Math.pow(1-t, 2) * source[1] + 
                                  2 * (1-t) * t * controlPoint[1] + 
                                  Math.pow(t, 2) * target[1];
                        points.push([lat, lng]);
                    }
                    
                    // Draw the connection line
                    const line = L.polyline(points, {
                        color: '#ff69b4',
                        weight: 2,
                        smoothFactor: 1
                    }).addTo(map);

                    // Add flying heart
                    const heart = document.createElement('div');
                    heart.className = 'connection-heart';
                    heart.innerHTML = '❤️';
                    document.querySelector('#map').appendChild(heart);

                    let progress = 0;
                    let direction = 1;

                    function updateHeartPosition() {
                        // Calculate position along the curve
                        const t = progress;
                        const lat = Math.pow(1-t, 2) * source[0] + 
                                  2 * (1-t) * t * controlPoint[0] + 
                                  Math.pow(t, 2) * target[0];
                        const lng = Math.pow(1-t, 2) * source[1] + 
                                  2 * (1-t) * t * controlPoint[1] + 
                                  Math.pow(t, 2) * target[1];

                        // Convert to pixel coordinates
                        const point = map.latLngToContainerPoint([lat, lng]);
                        heart.style.left = point.x + 'px';
                        heart.style.top = point.y + 'px';

                        // Update progress
                        progress += 0.005 * direction;
                        if (progress >= 1) {
                            direction = -1;
                        } else if (progress <= 0) {
                            direction = 1;
                        }

                        requestAnimationFrame(updateHeartPosition);
                    }

                    requestAnimationFrame(updateHeartPosition);
                } catch (error) {
                    console.error('Failed to draw connection:', error);
                }
            })();`;
        }).join('\n');
    }

    private generateStyles(): string {
        return `
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                }
                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    z-index: 1000;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header img {
                    height: 30px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 1.5em;
                    color: #333;
                }
                #map {
                    height: calc(100vh - 50px);
                    width: 100%;
                    margin-top: 50px;
                }
                .leaflet-popup-content {
                    margin: 0;
                    padding: 0;
                }
                .popup-content {
                    text-align: center;
                    padding: 10px;
                    width: 220px;
                    box-sizing: border-box;
                }
                .popup-content h3 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                    word-break: break-word;
                }
                .popup-gif {
                    width: 100%;
                    height: auto;
                    margin: 10px 0;
                    border-radius: 4px;
                    display: block;
                }
                .connection-heart {
                    position: absolute;
                    font-size: 20px;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    z-index: 1000;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.2); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
            </style>`;
    }

    generateSnapshot(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Map Snapshot</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    ${this.generateStyles()}
    <style>
        #loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        #loading.hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="https://logos-world.net/wp-content/uploads/2024/07/TUI-Symbol.png" alt="TUI Logo">
        <h1>People of TUI.com</h1>
    </div>
    <div id="loading">Loading map...</div>
    <div id="map"></div>
    <script>
        window.L = window.L || {};

        function loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(\`Failed to load script: \${src}\`));
                document.head.appendChild(script);
            });
        }

        async function initializeMap() {
            try {
                // Load Leaflet first
                await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
                
                // Wait to ensure Leaflet is fully initialized
                if (typeof window.L !== 'object' || !window.L.map) {
                    throw new Error('Leaflet failed to initialize properly');
                }

                // Initialize map
                const map = L.map('map', {
                    center: [${this.mapState.center[0]}, ${this.mapState.center[1]}],
                    zoom: ${this.mapState.zoom},
                    zoomControl: true,
                    attributionControl: true
                });

                // Add OpenStreetMap tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);

                // Add pins
                ${this.generatePinsJs()}

                // Add connections
                try {
                    ${this.generateConnectionsJs()}
                    console.log('Successfully added connections');
                } catch (error) {
                    console.error('Failed to draw connections:', error);
                    document.getElementById('loading').innerHTML = 
                        'Warning: Some connection lines could not be drawn.';
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                // Hide loading indicator
                document.getElementById('loading').classList.add('hidden');
            } catch (error) {
                document.getElementById('loading').innerHTML = 
                    'Failed to load map. Please check your internet connection and try again.';
                console.error('Map initialization failed:', error);
            }
        }

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeMap);
        } else {
            initializeMap();
        }
    </script>
</body>
</html>`;
    }

    downloadSnapshot() {
        const html = this.generateSnapshot();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-map-snapshot-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

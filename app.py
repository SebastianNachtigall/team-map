from flask import Flask, request, jsonify, Response, make_response, send_from_directory
import json
import os
import queue
import threading
import time
import uuid
import logging
from collections import deque
from threading import Lock
import requests
from datetime import datetime
from dotenv import load_dotenv

app = Flask(__name__, static_folder='dist', static_url_path='')

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Get Giphy API key from environment
GIPHY_API_KEY = os.getenv('GIPHY_API_KEY')

# Directory to store individual pin files
PINS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pins')
os.makedirs(PINS_DIR, exist_ok=True)
logger.info(f"Using pins directory: {PINS_DIR}")

# Cache for reverse geocoding and pins
location_cache = {}
pins_cache = {}  # In-memory cache for pins
last_cache_update = 0
CACHE_DURATION = 60  # Seconds before refreshing cache

def get_nearest_city(lat, lon):
    # Check cache first
    cache_key = f"{lat},{lon}"
    if cache_key in location_cache:
        return location_cache[cache_key]
    
    # Add a small delay to respect Nominatim's usage policy
    time.sleep(1)
    
    try:
        # Using Nominatim for reverse geocoding
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&zoom=10"
        headers = {
            'User-Agent': 'TUI Map Application/1.0'
        }
        logger.info(f"Geocoding request for {lat}, {lon}")
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()  # Raise exception for bad status codes
        data = response.json()
        logger.info(f"Geocoding response: {data}")
        
        # Extract city or nearest named place
        location = None
        address = data.get('address', {})
        
        # Try different address components in order of preference
        for key in ['city', 'town', 'village', 'suburb', 'county', 'state']:
            if key in address:
                location = address[key]
                logger.info(f"Found location {location} using key {key}")
                break
        
        if not location and 'display_name' in data:
            # Fallback to first part of display name
            location = data['display_name'].split(',')[0]
            logger.info(f"Using fallback location: {location}")
        
        # Cache the result
        location = location or "Unknown location"
        location_cache[cache_key] = location
        return location
        
    except Exception as e:
        logger.error(f"Error in reverse geocoding: {e}")
        return "Unknown location"

# Broadcast system for SSE
class Broadcaster:
    def __init__(self):
        self.clients = set()
        self.messages = deque(maxlen=100)  # Keep last 100 messages
        self.lock = Lock()
    
    def register(self, queue):
        with self.lock:
            self.clients.add(queue)
            # Send recent messages to new client
            for msg in self.messages:
                queue.put(msg)
        logger.info(f"Client registered. Total clients: {len(self.clients)}")
    
    def unregister(self, queue):
        with self.lock:
            self.clients.remove(queue)
        logger.info(f"Client unregistered. Total clients: {len(self.clients)}")
    
    def broadcast(self, msg):
        with self.lock:
            self.messages.append(msg)
            dead_clients = set()
            for client_queue in self.clients:
                try:
                    client_queue.put(msg)
                except:
                    dead_clients.add(client_queue)
            # Clean up dead clients
            for dead in dead_clients:
                self.clients.remove(dead)
        logger.info(f"Broadcasted message to {len(self.clients)} clients")

broadcaster = Broadcaster()

def load_locations():
    pins = []
    try:
        for filename in os.listdir(PINS_DIR):
            if filename.endswith('.json'):
                with open(os.path.join(PINS_DIR, filename), 'r') as f:
                    pin_data = json.load(f)
                    # Add the pin ID to the data
                    pin_data['id'] = filename.replace('.json', '')
                    pins.append(pin_data)
        
        # Sort pins by timestamp if available
        pins.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return {'status': 'success', 'pins': pins}
        
    except Exception as e:
        logger.error(f"Error loading locations: {e}")
        return {'status': 'error', 'message': str(e)}

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/pins', methods=['GET', 'POST'])
def handle_pins():
    if request.method == 'GET':
        try:
            logger.info('GET /pins - Fetching all pins')
            pins = []
            for filename in os.listdir(PINS_DIR):
                if filename.endswith('.json'):
                    with open(os.path.join(PINS_DIR, filename), 'r') as f:
                        pin_data = json.load(f)
                        # Add the pin ID to the data
                        pin_data['id'] = filename.replace('.json', '')
                        pins.append(pin_data)
            
            # Sort pins by timestamp if available
            pins.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            logger.info(f'GET /pins - Returning {len(pins)} pins')
            return jsonify({'status': 'success', 'pins': pins})
            
        except Exception as e:
            logger.error(f"Error getting pins: {str(e)}")
            return jsonify({'status': 'error', 'message': str(e)})
    
    elif request.method == 'POST':
        try:
            logger.info('POST /pins - Creating new pin')
            logger.debug(f'Request data: {request.data}')
            data = request.json
            logger.info(f'Parsed JSON data: {data}')
            
            # Create pin data
            pin_data = {
                'lat': float(data['lat']),
                'lng': float(data['lng']),
                'name': data['name'],
                'imageUrl': data.get('imageUrl', ''),
                'timestamp': datetime.now().isoformat()
            }
            logger.info(f'Created pin data: {pin_data}')
            
            # Get location name using reverse geocoding
            location_name = get_nearest_city(pin_data['lat'], pin_data['lng'])
            if location_name:
                pin_data['location'] = location_name
                logger.info(f'Added location: {location_name}')
            
            # Generate unique ID
            pin_id = str(uuid.uuid4())
            pin_data['id'] = pin_id
            
            # Save pin data
            pin_file = os.path.join(PINS_DIR, f'{pin_id}.json')
            with open(pin_file, 'w') as f:
                json.dump(pin_data, f, indent=2)
            logger.info(f'Saved pin to file: {pin_file}')
            
            # Broadcast update
            broadcaster.broadcast(json.dumps({
                'type': 'pin_added',
                'pin': pin_data
            }))
            logger.info('Broadcasted pin update')
            
            return jsonify({
                'status': 'success',
                'pin': pin_data
            })
            
        except Exception as e:
            logger.error(f"Error creating pin: {str(e)}", exc_info=True)
            return jsonify({'status': 'error', 'message': str(e)})

@app.route('/pins/<pin_id>', methods=['DELETE'])
def delete_pin(pin_id):
    try:
        pin_file = os.path.join(PINS_DIR, f"{pin_id}.json")
        if os.path.exists(pin_file):
            os.remove(pin_file)
            logger.info(f"Pin deleted: {pin_id}")
            return jsonify({'status': 'success', 'message': 'Pin deleted successfully'})
        else:
            logger.warning(f"Pin not found: {pin_id}")
            return jsonify({'status': 'error', 'message': 'Pin not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting pin: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/pins/<pin_id>/connections', methods=['POST'])
def create_connection(pin_id):
    try:
        # Get the pin file
        pin_file = os.path.join(PINS_DIR, f'{pin_id}.json')
        if not os.path.exists(pin_file):
            return jsonify({'status': 'error', 'message': 'Source pin not found'})
        
        # Load pin data
        with open(pin_file, 'r') as f:
            pin_data = json.load(f)
        
        # Get connection data
        connection_data = request.json
        target_pin_id = connection_data.get('targetPinId')
        
        # Validate target pin exists
        target_pin_file = os.path.join(PINS_DIR, f'{target_pin_id}.json')
        if not os.path.exists(target_pin_file):
            return jsonify({'status': 'error', 'message': 'Target pin not found'})
        
        # Initialize connections list if it doesn't exist
        if 'connections' not in pin_data:
            pin_data['connections'] = []
        
        # Check for duplicate connection
        for conn in pin_data['connections']:
            if conn['targetPinId'] == target_pin_id:
                return jsonify({'status': 'error', 'message': 'Connection already exists'})
        
        # Add new connection
        pin_data['connections'].append({
            'targetPinId': target_pin_id,
            'label': connection_data.get('label', ''),
            'timestamp': connection_data.get('timestamp', '')
        })
        
        # Save updated pin data
        with open(pin_file, 'w') as f:
            json.dump(pin_data, f, indent=2)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"Error creating connection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/pins/<pin_id>/connections', methods=['GET'])
def get_connections(pin_id):
    try:
        # Get the pin file
        pin_file = os.path.join(PINS_DIR, f'{pin_id}.json')
        if not os.path.exists(pin_file):
            return jsonify({'status': 'error', 'message': 'Pin not found'})
        
        # Load pin data
        with open(pin_file, 'r') as f:
            pin_data = json.load(f)
        
        # Return connections
        return jsonify({
            'status': 'success',
            'connections': pin_data.get('connections', [])
        })
        
    except Exception as e:
        print(f"Error getting connections: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/pins/<pin_id>/connections/<target_pin_id>', methods=['DELETE'])
def delete_connection(pin_id, target_pin_id):
    try:
        # Get the pin file
        pin_file = os.path.join(PINS_DIR, f'{pin_id}.json')
        if not os.path.exists(pin_file):
            return jsonify({'status': 'error', 'message': 'Pin not found'})
        
        # Load pin data
        with open(pin_file, 'r') as f:
            pin_data = json.load(f)
        
        # Remove connection
        pin_data['connections'] = [
            conn for conn in pin_data.get('connections', [])
            if conn['targetPinId'] != target_pin_id
        ]
        
        # Save updated pin data
        with open(pin_file, 'w') as f:
            json.dump(pin_data, f, indent=2)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"Error deleting connection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/stream')
def stream():
    def event_stream():
        # Create a queue for this client
        client_queue = queue.Queue()
        client_id = str(uuid.uuid4())
        logger.info(f"New client connected: {client_id}")
        
        try:
            # Register client
            broadcaster.register(client_queue)
            
            while True:
                # Get message from queue
                message = client_queue.get()
                
                if message is None:  # Shutdown signal
                    break
                    
                # Send message to client
                yield f"data: {message}\n\n"
                
        except GeneratorExit:
            logger.info(f"Client disconnected: {client_id}")
        finally:
            broadcaster.unregister(client_queue)
            client_queue.put(None)  # Signal to exit
    
    return Response(event_stream(), mimetype='text/event-stream')

@app.route('/generate-light-map')
def generate_light_map():
    # Get all pins
    pins = []
    if os.path.exists(PINS_DIR):
        for pin_file in os.listdir(PINS_DIR):
            if pin_file.endswith('.json'):
                with open(os.path.join(PINS_DIR, pin_file), 'r') as f:
                    pin = json.load(f)
                    pins.append(pin)
    
    # Sort pins by timestamp
    pins.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    # Generate HTML template
    html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUI Map Snapshot</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background-color: white;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            gap: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
            color: #333;
        }
        
        #map {
            flex: 1;
            position: relative;
        }
        
        .connection-heart {
            font-size: 14px;
            position: absolute;
            transform-origin: center;
            pointer-events: none;
            text-shadow: 0 0 3px white;
            z-index: 1001;
        }
        
        @supports (offset-path: path('M 0 0 L 100 100')) {
            .connection-heart {
                animation: moveHeart 4s linear infinite;
            }
            
            @keyframes moveHeart {
                0% {
                    offset-distance: 0%;
                    offset-rotate: 0deg;
                }
                50% {
                    offset-distance: 100%;
                    offset-rotate: 0deg;
                }
                100% {
                    offset-distance: 0%;
                    offset-rotate: 0deg;
                }
            }
        }
        
        .connect-btn {
            position: absolute;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: white;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            transition: all 0.2s ease;
        }
        
        .connect-btn:hover {
            background: #f4f4f4;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        
        .connect-btn.active {
            background: #e8e8e8;
            transform: translateY(1px);
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        
        .leaflet-popup-content {
            text-align: center;
        }
        
        .popup-image {
            max-width: 200px;
            max-height: 200px;
            margin: 10px 0;
            border-radius: 8px;
        }
        
        .marker-label {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 12px;
            white-space: nowrap;
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.2s ease;
            transform: translate(-50%, -10px);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .marker-label:hover {
            background: white;
            transform: translate(-50%, -12px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .leaflet-popup {
            min-width: 220px;
        }
        
        .leaflet-popup-content {
            text-align: center;
            width: auto !important;
            min-width: 200px;
        }
        
        .popup-image {
            max-width: 200px;
            max-height: 200px;
            margin: 10px 0;
            border-radius: 8px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="https://logos-world.net/wp-content/uploads/2024/07/TUI-Symbol.png" alt="TUI Logo" style="height: 40px;">
        <h1>People of TUI.com</h1>
    </div>
    
    <div id="map">
        <button id="connectBtn" class="connect-btn" title="Toggle pin connections">❤️</button>
    </div>

    <script>
        // Initialize map
        const map = L.map('map').setView([50.0, 15.0], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: 'OpenStreetMap contributors'
        }).addTo(map);

        // Initialize variables
        const markers = [];
        let connectionLines = [];
        let heartElements = [];
        let showConnections = false;

        // Create red icon for markers
        const redIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        // Function to create curved line
        function createCurvedLine(p1, p2) {
            const controlPoint = [
                (p1.lat + p2.lat) / 2 + (p2.lng - p1.lng) * 0.1,
                (p1.lng + p2.lng) / 2 - (p2.lat - p1.lat) * 0.1
            ];
            
            const curvePoints = [];
            for (let t = 0; t <= 1; t += 0.1) {
                const lat = Math.pow(1-t, 2) * p1.lat + 
                           2 * (1-t) * t * controlPoint[0] + 
                           Math.pow(t, 2) * p2.lat;
                const lng = Math.pow(1-t, 2) * p1.lng + 
                           2 * (1-t) * t * controlPoint[1] + 
                           Math.pow(t, 2) * p2.lng;
                curvePoints.push([lat, lng]);
            }
            
            const line = L.polyline(curvePoints, {
                color: '#666',
                weight: 1,
                dashArray: '5, 10',
                opacity: 0.6,
                className: 'connection-line'
            });
            
            const pathData = curvePoints.reduce((acc, point, i) => {
                const pixel = map.latLngToLayerPoint(L.latLng(point[0], point[1]));
                return acc + (i === 0 ? `M ${pixel.x} ${pixel.y}` : ` L ${pixel.x} ${pixel.y}`);
            }, '');
            
            const heart = document.createElement('div');
            heart.className = 'connection-heart';
            heart.textContent = '❤️';
            heart.style.left = '0';
            heart.style.top = '0';
            
            if (CSS.supports('offset-path', `path('${pathData}')`)) {
                heart.style.offsetPath = `path('${pathData}')`;
            } else {
                const start = map.latLngToLayerPoint(L.latLng(p1.lat, p1.lng));
                heart.style.left = `${start.x}px`;
                heart.style.top = `${start.y}px`;
            }
            
            const mapContainer = document.querySelector('.leaflet-map-pane');
            mapContainer.appendChild(heart);
            heartElements.push(heart);
            
            const updateHeartPath = () => {
                const newPathData = curvePoints.reduce((acc, point, i) => {
                    const pixel = map.latLngToLayerPoint(L.latLng(point[0], point[1]));
                    return acc + (i === 0 ? `M ${pixel.x} ${pixel.y}` : ` L ${pixel.x} ${pixel.y}`);
                }, '');
                
                if (CSS.supports('offset-path', `path('${newPathData}')`)) {
                    heart.style.offsetPath = `path('${newPathData}')`;
                } else {
                    const start = map.latLngToLayerPoint(L.latLng(p1.lat, p1.lng));
                    heart.style.left = `${start.x}px`;
                    heart.style.top = `${start.y}px`;
                }
            };
            
            map.on('move', updateHeartPath);
            map.on('zoom', updateHeartPath);
            
            return line;
        }

        // Function to toggle connections
        function toggleConnections() {
            showConnections = !showConnections;
            
            connectionLines.forEach(line => map.removeLayer(line));
            connectionLines = [];
            heartElements.forEach(heart => heart.remove());
            heartElements = [];
            
            if (showConnections) {
                for (let i = 0; i < markers.length; i++) {
                    for (let j = i + 1; j < markers.length; j++) {
                        const line = createCurvedLine(
                            markers[i].getLatLng(),
                            markers[j].getLatLng()
                        );
                        line.addTo(map);
                        connectionLines.push(line);
                    }
                }
                document.getElementById('connectBtn').classList.add('active');
            } else {
                document.getElementById('connectBtn').classList.remove('active');
            }
        }

        // Add click handler for connect button
        document.getElementById('connectBtn').addEventListener('click', toggleConnections);

        // Function to create a label for a marker
        function createMarkerLabel(marker, name) {
            const labelIcon = L.divIcon({
                className: 'marker-label',
                html: name,
                iconSize: null
            });
            
            const label = L.marker(marker.getLatLng(), {
                icon: labelIcon,
                zIndexOffset: 1000
            });
            
            // Make label clickable
            label.on('click', () => {
                marker.openPopup();
            });
            
            return label;
        }

        // Add pins to map
        const pins = ''' + json.dumps(pins) + ''';
        
        pins.forEach(pin => {
            const marker = L.marker([pin.lat, pin.lng], {
                icon: redIcon,
                riseOnHover: true
            });
            
            const popupContent = `
                <div>
                    <strong>${pin.name}</strong>
                    ${pin.imageUrl ? `<br><img src="${pin.imageUrl}" class="popup-image" alt="${pin.name}" onload="this.parentElement.parentElement._leaflet_popup._updateLayout();">` : ''}
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                minWidth: 220,
                maxWidth: 300,
                autoPanPadding: [50, 50]
            });
            
            // Create and add label
            const label = createMarkerLabel(marker, pin.name);
            label.addTo(map);
            
            marker.addTo(map);
            markers.push(marker);
        });
    </script>
</body>
</html>'''

    # Send as downloadable file
    response = make_response(html_template)
    response.headers['Content-Type'] = 'text/html'
    response.headers['Content-Disposition'] = 'attachment; filename=tui-map-snapshot.html'
    return response

@app.route('/api/random-gif', methods=['GET'])
def get_random_gif():
    logger.info("Random GIF endpoint called")
    try:
        if not GIPHY_API_KEY:
            logger.error("GIPHY_API_KEY environment variable is not set")
            return jsonify({
                'status': 'error',
                'message': 'GIPHY_API_KEY environment variable is not set'
            }), 500

        url = f"https://api.giphy.com/v1/gifs/random?api_key={GIPHY_API_KEY}&rating=g"
        logger.info(f"Making request to Giphy API: {url.replace(GIPHY_API_KEY, '[REDACTED]')}")
        
        response = requests.get(url)
        response.raise_for_status()  # Raise exception for bad status codes
        
        logger.info("Successfully got response from Giphy API")
        data = response.json()
        
        if data.get('data', {}).get('images', {}).get('original', {}).get('url'):
            gif_url = data['data']['images']['original']['url']
            logger.info(f"Successfully got GIF URL: {gif_url}")
            return jsonify({
                'status': 'success',
                'url': gif_url
            })
        else:
            logger.error("Could not fetch GIF from Giphy: No URL in response")
            logger.error(f"Response data: {json.dumps(data)}")
            return jsonify({
                'status': 'error',
                'message': 'Could not fetch GIF from Giphy'
            }), 500
    except requests.RequestException as e:
        logger.error(f"Network error while fetching GIF: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Network error: {str(e)}'
        }), 500
    except Exception as e:
        logger.error(f"Unexpected error while fetching GIF: {str(e)}")
        logger.exception("Full traceback:")
        return jsonify({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }), 500

@app.route('/connections', methods=['POST'])
def create_connection_new():
    try:
        data = request.json
        source_id = data.get('sourceId')
        target_id = data.get('targetId')
        
        if not source_id or not target_id:
            return jsonify({
                'status': 'error',
                'message': 'Source and target IDs are required'
            }), 400
            
        # Load source pin
        source_file = os.path.join(PINS_DIR, f'{source_id}.json')
        if not os.path.exists(source_file):
            return jsonify({
                'status': 'error',
                'message': 'Source pin not found'
            }), 404
            
        # Load target pin
        target_file = os.path.join(PINS_DIR, f'{target_id}.json')
        if not os.path.exists(target_file):
            return jsonify({
                'status': 'error',
                'message': 'Target pin not found'
            }), 404
            
        # Create new connection
        connection_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        source_connection = {
            'id': connection_id,
            'sourceId': source_id,
            'targetId': target_id,
            'timestamp': timestamp
        }
        
        target_connection = {
            'id': connection_id,
            'sourceId': source_id,
            'targetId': target_id,
            'timestamp': timestamp
        }
            
        # Update source pin
        with open(source_file, 'r') as f:
            source_pin = json.load(f)
        if 'connections' not in source_pin:
            source_pin['connections'] = []
        source_pin['connections'].append(source_connection)
        with open(source_file, 'w') as f:
            json.dump(source_pin, f, indent=2)
            
        # Update target pin
        with open(target_file, 'r') as f:
            target_pin = json.load(f)
        if 'connections' not in target_pin:
            target_pin['connections'] = []
        target_pin['connections'].append(target_connection)
        with open(target_file, 'w') as f:
            json.dump(target_pin, f, indent=2)
            
        # Broadcast update
        broadcaster.broadcast(json.dumps({
            'type': 'connection_added',
            'connection': source_connection
        }))
        
        return jsonify({
            'status': 'success',
            'connection': source_connection
        })
        
    except Exception as e:
        logger.error(f"Error creating connection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/connections', methods=['GET'])
def get_connections_new():
    try:
        connections = {}  # Use a dict to deduplicate by connection ID
        # Get connections from all pins
        for filename in os.listdir(PINS_DIR):
            if filename.endswith('.json'):
                with open(os.path.join(PINS_DIR, filename), 'r') as f:
                    pin_data = json.load(f)
                    if 'connections' in pin_data:
                        for connection in pin_data['connections']:
                            connections[connection['id']] = connection
        
        return jsonify({
            'status': 'success',
            'connections': list(connections.values())
        })
        
    except Exception as e:
        logger.error(f"Error getting connections: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/connections/<source_id>/<target_id>', methods=['DELETE'])
def delete_connection_new(source_id, target_id):
    try:
        # Get the source pin file
        source_file = os.path.join(PINS_DIR, f'{source_id}.json')
        if not os.path.exists(source_file):
            return jsonify({'status': 'error', 'message': 'Source pin not found'})
        
        # Get the target pin file
        target_file = os.path.join(PINS_DIR, f'{target_id}.json')
        if not os.path.exists(target_file):
            return jsonify({'status': 'error', 'message': 'Target pin not found'})
        
        # Load source pin data and remove connection
        with open(source_file, 'r') as f:
            source_data = json.load(f)
        
        # Remove all connections between these two pins
        source_data['connections'] = [
            conn for conn in source_data.get('connections', [])
            if not ((conn['sourceId'] == source_id and conn['targetId'] == target_id) or
                   (conn['sourceId'] == target_id and conn['targetId'] == source_id))
        ]
        
        # Save updated source pin data
        with open(source_file, 'w') as f:
            json.dump(source_data, f, indent=2)
        
        # Load target pin data and remove connection
        with open(target_file, 'r') as f:
            target_data = json.load(f)
        
        # Remove all connections between these two pins
        target_data['connections'] = [
            conn for conn in target_data.get('connections', [])
            if not ((conn['sourceId'] == source_id and conn['targetId'] == target_id) or
                   (conn['sourceId'] == target_id and conn['targetId'] == source_id))
        ]
        
        # Save updated target pin data
        with open(target_file, 'w') as f:
            json.dump(target_data, f, indent=2)
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        logger.error(f"Error deleting connection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

@app.after_request
def add_cors_headers(response):
    # Get the request origin or use a default value
    origin = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.route('/options', methods=['OPTIONS'])
def handle_options():
    return '', 204

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=False)

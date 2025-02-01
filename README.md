# Interactive Map Application

A collaborative web application that allows visitors to view and add their locations on an interactive map, create connections between locations, and share GIFs. No authentication required!

## Features
- View all visitor locations on an interactive map
- Add your location by clicking on the map
- Create connections between locations with animated hearts
- Add GIFs to your location (with Giphy integration)
- Real-time updates for all users
- Download standalone map snapshots
- No login required

## Installation Options

### Using Docker (Recommended)

1. Prerequisites:
   - Docker installed on your machine
   - Docker Compose installed

2. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/team-map.git
   cd team-map
   ```

3. Create a `.env` file with your Giphy API key:
   ```bash
   echo "GIPHY_API_KEY=your_api_key_here" > .env
   ```

4. Start the application:
   ```bash
   docker compose up -d
   ```

5. Open your browser and visit `http://localhost:5173`

To stop the application:
```bash
docker compose down
```

### Manual Setup (Development)

1. Prerequisites:
   - Python 3.x
   - Node.js and npm
   - Giphy API key

2. Install dependencies:
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Install Node.js dependencies
   npm install
   ```

3. Create a `.env` file with your Giphy API key:
   ```bash
   echo "GIPHY_API_KEY=your_api_key_here" > .env
   ```

4. Start the backend:
   ```bash
   python app.py
   ```

5. In a new terminal, start the frontend:
   ```bash
   npm run dev
   ```

6. Open your browser and visit `http://localhost:5173`

## How to Use

1. Adding Your Location:
   - Enter your name in the input field
   - (Optional) Add a GIF using the 🍀 button
   - Click anywhere on the map to add your location

2. Creating Connections:
   - Click on any two pins to create a connection
   - Watch the animated heart travel between connected locations

3. Downloading a Snapshot:
   - Click the 💾 button in the map controls
   - Open the downloaded HTML file in any browser
   - Share your map view with others!

## Development Notes

### Local Development
- The application uses Docker Compose for local development
- Hot reloading is enabled for both frontend and backend
- Source maps are available for debugging
- All files are mounted as volumes for instant updates

### Production Deployment
- The application is configured for Railway deployment
- Assets are optimized and properly hashed
- Environment variables must be set in Railway dashboard
- Static files are served by Flask in production

## Troubleshooting

1. If the application doesn't start:
   - Check if ports 5173 and 5002 are available
   - Ensure Docker daemon is running
   - Verify your Giphy API key is set correctly

2. If changes don't appear:
   - Clear your browser cache
   - Restart the Docker containers
   - Check the browser console for errors

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

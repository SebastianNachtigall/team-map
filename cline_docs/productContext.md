# Product Context

## Purpose
This is an interactive team mapping application designed to help teams visualize and track their members' locations across different geographical areas. It serves as a visual collaboration tool that allows team members to mark their locations and create connections with other team members.

## Problems Solved
1. Geographic Team Visualization
   - Helps distributed teams understand where team members are located
   - Provides visual representation of team distribution
   - Makes it easier to identify clusters and geographic patterns

2. Team Connection Management
   - Allows team members to establish and visualize connections
   - Helps track relationships and collaborations between team members
   - Creates a visual network of team relationships

3. Real-time Collaboration
   - Enables real-time updates when team members add or modify locations
   - Facilitates dynamic team mapping without requiring authentication
   - Keeps all team members informed of changes through live updates

## How It Works
1. Map Interface
   - Interactive map centered on Europe by default
   - Users can click anywhere to add their location
   - Supports zooming and panning for easy navigation

2. Pin Management
   - Users can add pins with their name and optional image/GIF
   - Each pin represents a team member's location
   - Pins are displayed with floating name labels
   - Includes reverse geocoding to show location names

3. Connection System
   - Users can create connections between team members
   - Connections are visualized with curved lines and animated hearts
   - Supports bi-directional relationships
   - Real-time updates when connections change

4. Activity Tracking
   - Maintains a feed of recent changes
   - Shows when pins are added or removed
   - Tracks connection creation and deletion
   - Uses Server-Sent Events for live updates
# Product Context

## Purpose
The Interactive Map Application is designed to create a visual representation of TUI team members' locations worldwide. It serves as a collaborative platform where team members can mark their locations and establish connections with others.

## Problems Solved
1. Geographic Visualization: Provides a clear visual representation of where team members are located globally
2. Team Connection: Enables team members to see and connect with colleagues across different locations
3. Community Building: Fosters a sense of community by showing the global distribution of the team
4. Easy Participation: Offers a frictionless way to participate with no authentication required

## Core Functionality
1. Interactive Map
   - View all team member locations on a world map
   - Add new locations by clicking on the map
   - Markers show team member names and optional images

2. Team Member Pins
   - Each pin represents a team member
   - Contains member name and optional image
   - Location is automatically geocoded to nearest city
   - Real-time updates when new pins are added

3. Connections
   - Create connections between team members
   - Visualize relationships with curved lines and animated hearts
   - Manage connections through an intuitive interface

4. Activity Feed
   - Real-time updates of new pins and connections
   - Server-sent events for live updates

5. Snapshot Generation
   - Generate static HTML snapshots of the current map state
   - Downloadable and shareable map views

## User Experience Goals
1. Simplicity: No login required, easy to add locations
2. Engagement: Visual feedback and animations for interactions
3. Discoverability: Clear interface for adding pins and making connections
4. Real-time: Immediate updates when others add locations or connections

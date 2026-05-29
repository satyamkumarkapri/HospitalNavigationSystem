# AI Navigator - City General Hospital

An intelligent, multi-floor hospital navigation web application powered by AI search algorithms. It provides optimal pathfinding, multi-person simultaneous routing, wheelchair accessibility protocols, and real-time congestion avoidance.

## Features
- **Multi-Algorithm Search**: Supports A* (Heuristic), BFS, DFS, UCS, Greedy Best-First, and IDA*.
- **Dynamic Multi-Person Routing**: Calculate independent paths for up to 6 people simultaneously, visualized with parallel offset paths and animated direction flows.
- **Safety Protocols**: Option to strictly route through wheelchair-accessible nodes and bypass congested corridors.
- **Interactive SVG Map**: Full pan, zoom, and tilt (3D) capable SVG map with detailed node information and turn-by-turn directions.
- **Emergency Mode**: One-click routing to the ER.

## Setup & Installation

1. Create a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python3 app.py
   ```
   The application will be available at `http://localhost:5998`

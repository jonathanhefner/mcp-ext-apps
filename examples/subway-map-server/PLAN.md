# BART Subway Map MCP App - Implementation Plan

## Overview
Create an interactive, zoomable San Francisco BART map MCP App that displays real-time simulated train positions with random delays.

## Technology Choices
- **City**: San Francisco BART (50 stations, 5 lines, simple geometry)
- **Zoom**: `svg-pan-zoom` library (438k weekly downloads, scroll wheel + pinch support)
- **Rendering**: Dynamically generated SVG from TypeScript data
- **Framework**: Vanilla TypeScript (following basic-server-vanillajs pattern)
- **Target size**: 600x600 pixels (embedded UI)

## Project Structure
```
examples/subway-map-server/
├── server.ts                 # MCP server + simulation engine
├── src/
│   ├── mcp-app.ts           # Client UI + polling
│   ├── subway-data.ts       # Station/line definitions (hand-coded)
│   ├── mcp-app.css          # Map styling
│   └── global.css           # Theme support
├── mcp-app.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Data Model

### Stations (~50)
```typescript
interface Station {
  id: string;           // e.g., "EMBR"
  name: string;         // e.g., "Embarcadero"
  x: number;            // SVG coordinate (0-600 range)
  y: number;            // SVG coordinate (0-600 range)
  lines: string[];      // e.g., ["red", "yellow", "green", "blue"]
}
```

### Lines (5 main services)
```typescript
interface Line {
  id: string;           // e.g., "red"
  name: string;         // e.g., "Richmond - Millbrae"
  color: string;        // e.g., "#ED1C24"
  stations: string[];   // Ordered station IDs
}
```

### Trains (simulated)
```typescript
interface Train {
  id: string;
  line: string;
  direction: "outbound" | "inbound";
  currentStation: string;
  nextStation: string | null;
  status: "at-station" | "in-transit" | "delayed";
  delayMinutes: number;
  passengers: number;   // Simulated passenger count
}
```

## Map Data Approach

### Source
**Hand-coded from reference.** Station (x, y) coordinates will be manually defined by referencing the official BART schematic map. This approach:
- Works with schematic layout (stylized, not geographic)
- Avoids GTFS complexity (lat/long doesn't work for schematic maps)
- Avoids copyright issues with existing SVGs
- Only ~50 stations, so feasible (~150 lines of typed data)

### Storage
TypeScript file with typed arrays, bundled into the build:
```typescript
// src/subway-data.ts - hand-coded station coordinates
export const stations: Station[] = [
  { id: "EMBR", name: "Embarcadero", x: 300, y: 280, lines: ["red", "yellow", "green", "blue"] },
  { id: "MONT", name: "Montgomery St", x: 300, y: 300, lines: ["red", "yellow", "green", "blue"] },
  // ... ~48 more stations
];

export const lines: Line[] = [
  { id: "red", name: "Richmond - Millbrae", color: "#ED1C24", stations: ["RICH", "DELN", ...] },
  { id: "yellow", name: "Antioch - SF Airport", color: "#FFE800", stations: [...] },
  { id: "green", name: "Berryessa - Daly City", color: "#4AA74F", stations: [...] },
  { id: "blue", name: "Dublin/Pleasanton - Daly City", color: "#0099D8", stations: [...] },
  { id: "orange", name: "Richmond - Berryessa", color: "#F7931E", stations: [...] },
];
```

### Rendering
Dynamically generate SVG elements from data at runtime:
1. **Lines**: For each line, draw `<polyline>` connecting station coordinates in order
2. **Stations**: For each station, draw `<circle>` at (x, y)
3. **Trains**: For each train from poll data, draw `<circle>` positioned at current station (or between stations if in-transit)
4. **Tooltips**: Attach hover/click listeners for station names and train details

## Server Implementation

### Tool: `get_system_status`
Returns current state of all trains + any system alerts.

**Response structure:**
```typescript
interface SystemStatus {
  timestamp: string;
  trains: Train[];
  alerts: Alert[];      // Random delays, service disruptions
}
```

### Simulation Engine
- **Train count**: 2-3 trains per line, each direction (~20-30 total)
- **Update tick**: Advance train positions every 2 seconds
- **Delay injection**: ~10% chance per tick of 1-5 minute delay
- **State persistence**: In-memory (reset on server restart)

### Simulation Logic (per tick)
1. For each train in-transit: Move to next station (or stay if delayed)
2. For each train at-station: Depart after dwell time (30-60 sec simulated)
3. Roll for random delays
4. Generate passenger counts (randomized)

## Client Implementation

### SVG Map Structure
```svg
<svg id="subway-map" viewBox="0 0 600 600">
  <!-- Lines layer (below stations) -->
  <g id="lines">
    <polyline class="line red" points="..." />
    ...
  </g>

  <!-- Stations layer -->
  <g id="stations">
    <circle class="station" data-id="EMBR" cx="300" cy="280" r="6" />
    ...
  </g>

  <!-- Trains layer (on top) -->
  <g id="trains">
    <circle class="train red" cx="..." cy="..." r="8" />
    ...
  </g>
</svg>
```

### Polling Pattern (from system-monitor-server)
- Poll interval: 2 seconds
- Start/stop toggle button
- Status indicator (polling/stopped)
- Last update timestamp

### UI Features
1. **Zoom controls**: svg-pan-zoom with scroll wheel + pinch
2. **Station hover**: Show station name tooltip (labels hidden by default to reduce clutter)
3. **Train click**: Show tooltip with train details (line, status, delay) - tooltip better than panel for 600x600 size
4. **Legend**: Line colors with names (compact, bottom corner)
5. **Alert banner**: Display active delays (thin banner at top)

### Styling
- Light/dark theme support (CSS custom properties)
- Line colors matching official BART colors:
  - Red: #ED1C24
  - Yellow: #FFE800
  - Green: #4AA74F
  - Blue: #0099D8
  - Orange: #F7931E

## Implementation Steps

### Phase 1: Project Setup
1. Create directory structure
2. Copy boilerplate from basic-server-vanillajs
3. Add dependencies: `svg-pan-zoom`
4. Configure Vite build

### Phase 2: BART Data
1. Create station definitions with coordinates (reference official BART map)
2. Create line definitions with station sequences
3. Define official colors

### Phase 3: Server Simulation
1. Implement train state machine
2. Add tick-based position updates
3. Add random delay generation
4. Create `get_system_status` tool
5. Add MCP resource for UI

### Phase 4: Client Map Rendering
1. Generate SVG from station/line data
2. Integrate svg-pan-zoom
3. Add station/train rendering functions
4. Style with BART colors

### Phase 5: Polling + Interactivity
1. Implement polling loop
2. Add train position updates
3. Add tooltips/click handlers
4. Add legend and controls

### Phase 6: Polish
1. Add alert banner for delays
2. Theme support (light/dark)
3. Responsive sizing
4. Testing and refinement

## Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/mcp-app-sdk": "workspace:*",
    "@anthropic-ai/sdk": "^0.52.0",
    "@modelcontextprotocol/sdk": "^1.12.1",
    "express": "^5.1.0",
    "svg-pan-zoom": "^3.6.1",
    "zod": "^3.25.23"
  }
}
```

## Estimated Effort
~800 lines of code, comparable to cohort-heatmap-server complexity.

## Key Reference Files
- `examples/system-monitor-server/` - Polling pattern
- `examples/basic-server-vanillajs/` - Project structure template
- `examples/customer-segmentation-server/` - Data generation patterns

## BART Line Details (Reference)

| Line | Color | Terminals | Key Stations |
|------|-------|-----------|--------------|
| Red | #ED1C24 | Richmond ↔ Millbrae | Downtown SF, SFO connection |
| Yellow | #FFE800 | Antioch ↔ SF Airport | Transbay tube, SFO |
| Green | #4AA74F | Berryessa ↔ Daly City | San Jose extension |
| Blue | #0099D8 | Dublin/Pleasanton ↔ Daly City | East Bay suburbs |
| Orange | #F7931E | Richmond ↔ Berryessa | Cross-system connector |

## Station Count by Area (approximate)
- Downtown SF: 4 stations (shared by most lines)
- Mission/Glen Park: 3 stations
- Peninsula/SFO: 6 stations
- East Bay (Oakland/Berkeley): 12 stations
- East Bay (Fremont/Berryessa): 8 stations
- East Bay (Concord/Antioch): 10 stations
- East Bay (Dublin/Pleasanton): 5 stations
- Richmond line: 7 stations

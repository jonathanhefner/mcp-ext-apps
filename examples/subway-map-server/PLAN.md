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

---

# APPENDIX A: Complete Station Data

## Schematic Layout Strategy (600x600 canvas)

The BART system is roughly Y-shaped:
- SF downtown on the west (left) side
- Transbay tube connects to West Oakland
- System branches east to Richmond (north), Antioch (northeast), Dublin (east), and Fremont/Berryessa (southeast)
- Peninsula extends south from SF to SFO/Millbrae

```
Canvas Layout (600x600):

        Richmond (y=50)
             |
     Antioch-------- (y=100-150)
             \
    SF ---- West Oakland ---- MacArthur (y=250)
    |              |              |    \
Peninsula      Oakland        Dublin (y=300)
    |           core
   SFO           |
  (y=550)    Fremont/Berryessa (y=500-550)
```

## Complete Station Definitions

```typescript
// src/subway-data.ts

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  lines: string[];
}

export interface Line {
  id: string;
  name: string;
  color: string;
  stations: string[];
}

// All 50 BART stations with schematic coordinates
export const stations: Station[] = [
  // ===== SAN FRANCISCO DOWNTOWN (shared trunk) =====
  { id: "EMBR", name: "Embarcadero", x: 120, y: 220, lines: ["red", "yellow", "green", "blue"] },
  { id: "MONT", name: "Montgomery St", x: 120, y: 245, lines: ["red", "yellow", "green", "blue"] },
  { id: "POWL", name: "Powell St", x: 120, y: 270, lines: ["red", "yellow", "green", "blue"] },
  { id: "CIVC", name: "Civic Center/UN Plaza", x: 120, y: 295, lines: ["red", "yellow", "green", "blue"] },

  // ===== MISSION DISTRICT =====
  { id: "16TH", name: "16th St Mission", x: 120, y: 330, lines: ["red", "yellow", "green", "blue"] },
  { id: "24TH", name: "24th St Mission", x: 120, y: 355, lines: ["red", "yellow", "green", "blue"] },

  // ===== GLEN PARK / BALBOA =====
  { id: "GLEN", name: "Glen Park", x: 120, y: 390, lines: ["red", "yellow", "green", "blue"] },
  { id: "BALB", name: "Balboa Park", x: 120, y: 415, lines: ["red", "yellow", "green", "blue"] },

  // ===== DALY CITY (Green/Blue terminus) =====
  { id: "DALY", name: "Daly City", x: 100, y: 450, lines: ["red", "yellow", "green", "blue"] },

  // ===== PENINSULA / SFO (Red/Yellow continue south) =====
  { id: "COLM", name: "Colma", x: 85, y: 480, lines: ["red", "yellow"] },
  { id: "SSAN", name: "South San Francisco", x: 70, y: 505, lines: ["red", "yellow"] },
  { id: "SBRN", name: "San Bruno", x: 55, y: 530, lines: ["red", "yellow"] },
  { id: "MLBR", name: "Millbrae", x: 40, y: 555, lines: ["red", "yellow"] },
  { id: "SFIA", name: "SFO Airport", x: 70, y: 570, lines: ["yellow"] },

  // ===== WEST OAKLAND (Transbay connection) =====
  { id: "WOAK", name: "West Oakland", x: 200, y: 250, lines: ["red", "yellow", "green", "blue"] },

  // ===== OAKLAND DOWNTOWN =====
  { id: "12TH", name: "12th St Oakland City Center", x: 260, y: 250, lines: ["red", "yellow", "green", "blue", "orange"] },
  { id: "19TH", name: "19th St Oakland", x: 260, y: 225, lines: ["red", "yellow", "green", "blue", "orange"] },

  // ===== LAKE MERRITT (Fremont branch splits here) =====
  { id: "LAKE", name: "Lake Merritt", x: 280, y: 290, lines: ["green", "blue", "orange"] },

  // ===== MACARTHUR (Richmond/Antioch branch splits here) =====
  { id: "MCAR", name: "MacArthur", x: 290, y: 195, lines: ["red", "yellow", "orange"] },

  // ===== RICHMOND BRANCH (north from MacArthur) =====
  { id: "ROCK", name: "Rockridge", x: 315, y: 165, lines: ["red", "yellow", "orange"] },
  { id: "ASHB", name: "Ashby", x: 340, y: 135, lines: ["red", "orange"] },
  { id: "DBRK", name: "Downtown Berkeley", x: 365, y: 110, lines: ["red", "orange"] },
  { id: "NBRK", name: "North Berkeley", x: 390, y: 85, lines: ["red", "orange"] },
  { id: "PLZA", name: "El Cerrito Plaza", x: 420, y: 65, lines: ["red", "orange"] },
  { id: "DELN", name: "El Cerrito del Norte", x: 450, y: 50, lines: ["red", "orange"] },
  { id: "RICH", name: "Richmond", x: 485, y: 35, lines: ["red", "orange"] },

  // ===== PITTSBURG/ANTIOCH BRANCH (east from MacArthur) =====
  { id: "ORIN", name: "Orinda", x: 340, y: 175, lines: ["yellow"] },
  { id: "LAFY", name: "Lafayette", x: 380, y: 160, lines: ["yellow"] },
  { id: "WCRK", name: "Walnut Creek", x: 420, y: 145, lines: ["yellow"] },
  { id: "PHIL", name: "Pleasant Hill/Contra Costa Centre", x: 460, y: 130, lines: ["yellow"] },
  { id: "CONC", name: "Concord", x: 495, y: 115, lines: ["yellow"] },
  { id: "NCON", name: "North Concord/Martinez", x: 525, y: 100, lines: ["yellow"] },
  { id: "PITT", name: "Pittsburg/Bay Point", x: 555, y: 85, lines: ["yellow"] },
  { id: "PCTR", name: "Pittsburg Center", x: 575, y: 70, lines: ["yellow"] },
  { id: "ANTC", name: "Antioch", x: 590, y: 55, lines: ["yellow"] },

  // ===== FREMONT BRANCH (south from Lake Merritt) =====
  { id: "FTVL", name: "Fruitvale", x: 305, y: 320, lines: ["green", "blue", "orange"] },
  { id: "COLS", name: "Coliseum", x: 330, y: 350, lines: ["green", "blue", "orange"] },
  { id: "SANL", name: "San Leandro", x: 355, y: 380, lines: ["green", "blue", "orange"] },
  { id: "BAYF", name: "Bay Fair", x: 380, y: 410, lines: ["green", "blue", "orange"] },

  // ===== DUBLIN/PLEASANTON BRANCH (east from Bay Fair) =====
  { id: "CAST", name: "Castro Valley", x: 430, y: 395, lines: ["blue"] },
  { id: "WDUB", name: "West Dublin/Pleasanton", x: 480, y: 380, lines: ["blue"] },
  { id: "DUBL", name: "Dublin/Pleasanton", x: 530, y: 365, lines: ["blue"] },

  // ===== FREMONT CONTINUATION (south from Bay Fair) =====
  { id: "HAYW", name: "Hayward", x: 400, y: 445, lines: ["green", "orange"] },
  { id: "SHAY", name: "South Hayward", x: 420, y: 475, lines: ["green", "orange"] },
  { id: "UCTY", name: "Union City", x: 440, y: 505, lines: ["green", "orange"] },
  { id: "FRMT", name: "Fremont", x: 460, y: 535, lines: ["green", "orange"] },
  { id: "WARM", name: "Warm Springs/South Fremont", x: 480, y: 560, lines: ["green", "orange"] },

  // ===== BERRYESSA EXTENSION =====
  { id: "MLPT", name: "Milpitas", x: 510, y: 545, lines: ["green", "orange"] },
  { id: "BERY", name: "Berryessa/North San Jose", x: 540, y: 530, lines: ["green", "orange"] },

  // ===== OAKLAND AIRPORT CONNECTOR =====
  { id: "OAKL", name: "Oakland International Airport", x: 365, y: 365, lines: ["airport"] },
];

// Line definitions with station order (terminus to terminus)
export const lines: Line[] = [
  {
    id: "red",
    name: "Richmond - Millbrae",
    color: "#ED1C24",
    stations: [
      "RICH", "DELN", "PLZA", "NBRK", "DBRK", "ASHB", "ROCK", "MCAR",
      "19TH", "12TH", "WOAK", "EMBR", "MONT", "POWL", "CIVC",
      "16TH", "24TH", "GLEN", "BALB", "DALY", "COLM", "SSAN", "SBRN", "MLBR"
    ],
  },
  {
    id: "yellow",
    name: "Antioch - SFO Airport",
    color: "#FFE800",
    stations: [
      "ANTC", "PCTR", "PITT", "NCON", "CONC", "PHIL", "WCRK", "LAFY", "ORIN",
      "MCAR", "19TH", "12TH", "WOAK", "EMBR", "MONT", "POWL", "CIVC",
      "16TH", "24TH", "GLEN", "BALB", "DALY", "COLM", "SSAN", "SBRN", "MLBR", "SFIA"
    ],
  },
  {
    id: "green",
    name: "Berryessa - Daly City",
    color: "#4AA74F",
    stations: [
      "BERY", "MLPT", "WARM", "FRMT", "UCTY", "SHAY", "HAYW", "BAYF",
      "SANL", "COLS", "FTVL", "LAKE", "12TH", "19TH", "WOAK",
      "EMBR", "MONT", "POWL", "CIVC", "16TH", "24TH", "GLEN", "BALB", "DALY"
    ],
  },
  {
    id: "blue",
    name: "Dublin/Pleasanton - Daly City",
    color: "#0099D8",
    stations: [
      "DUBL", "WDUB", "CAST", "BAYF", "SANL", "COLS", "FTVL", "LAKE",
      "12TH", "19TH", "WOAK", "EMBR", "MONT", "POWL", "CIVC",
      "16TH", "24TH", "GLEN", "BALB", "DALY"
    ],
  },
  {
    id: "orange",
    name: "Richmond - Berryessa",
    color: "#F7931E",
    stations: [
      "RICH", "DELN", "PLZA", "NBRK", "DBRK", "ASHB", "ROCK", "MCAR",
      "19TH", "12TH", "LAKE", "FTVL", "COLS", "SANL", "BAYF",
      "HAYW", "SHAY", "UCTY", "FRMT", "WARM", "MLPT", "BERY"
    ],
  },
  {
    id: "airport",
    name: "Oakland Airport Connector",
    color: "#6B7280",
    stations: ["COLS", "OAKL"],
  },
];

// Helper to get station by ID
export function getStation(id: string): Station | undefined {
  return stations.find(s => s.id === id);
}

// Helper to get line by ID
export function getLine(id: string): Line | undefined {
  return lines.find(l => l.id === id);
}
```

---

# APPENDIX B: MCP Server Boilerplate

## Complete Server Implementation Pattern

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RESOURCE_URI_META_KEY } from "../../dist/src/app";
import { stations, lines, getStation, getLine } from "./src/subway-data";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DIST_DIR = path.join(import.meta.dirname, "dist");

// ===== SIMULATION STATE =====
interface Train {
  id: string;
  line: string;
  direction: "outbound" | "inbound";
  currentStation: string;
  nextStation: string | null;
  status: "at-station" | "in-transit" | "delayed";
  delayMinutes: number;
  passengers: number;
  departureTime: number; // timestamp when train will depart
}

interface Alert {
  id: string;
  type: "delay" | "disruption";
  line: string;
  message: string;
  timestamp: string;
}

interface SimulationState {
  trains: Train[];
  alerts: Alert[];
  lastTick: number;
}

const state: SimulationState = {
  trains: [],
  alerts: [],
  lastTick: Date.now(),
};

// Initialize trains (2-3 per line, each direction)
function initializeTrains(): void {
  state.trains = [];

  for (const line of lines) {
    if (line.id === "airport") continue; // Skip airport connector

    const stationCount = line.stations.length;
    const trainsPerDirection = 2 + Math.floor(Math.random() * 2); // 2-3 trains

    for (let i = 0; i < trainsPerDirection; i++) {
      // Outbound train
      const outboundIdx = Math.floor((i / trainsPerDirection) * stationCount * 0.8);
      state.trains.push({
        id: `${line.id}-out-${i}`,
        line: line.id,
        direction: "outbound",
        currentStation: line.stations[outboundIdx],
        nextStation: line.stations[outboundIdx + 1] || null,
        status: "at-station",
        delayMinutes: 0,
        passengers: Math.floor(Math.random() * 200) + 50,
        departureTime: Date.now() + Math.random() * 30000,
      });

      // Inbound train
      const inboundIdx = stationCount - 1 - Math.floor((i / trainsPerDirection) * stationCount * 0.8);
      state.trains.push({
        id: `${line.id}-in-${i}`,
        line: line.id,
        direction: "inbound",
        currentStation: line.stations[inboundIdx],
        nextStation: line.stations[inboundIdx - 1] || null,
        status: "at-station",
        delayMinutes: 0,
        passengers: Math.floor(Math.random() * 200) + 50,
        departureTime: Date.now() + Math.random() * 30000,
      });
    }
  }
}

// Advance simulation by one tick
function tickSimulation(): void {
  const now = Date.now();

  for (const train of state.trains) {
    const line = getLine(train.line);
    if (!line) continue;

    const stationList = train.direction === "outbound" ? line.stations : [...line.stations].reverse();
    const currentIdx = stationList.indexOf(train.currentStation);

    if (train.status === "delayed") {
      // Delayed trains wait longer
      if (now > train.departureTime + train.delayMinutes * 60000) {
        train.status = "at-station";
        train.delayMinutes = 0;
      }
      continue;
    }

    if (train.status === "at-station" && now > train.departureTime) {
      // Depart station
      if (currentIdx < stationList.length - 1) {
        train.status = "in-transit";
        train.nextStation = stationList[currentIdx + 1];
      } else {
        // At terminus, reverse direction
        train.direction = train.direction === "outbound" ? "inbound" : "outbound";
        train.departureTime = now + 60000; // 1 minute turnaround
      }
    }

    if (train.status === "in-transit") {
      // Arrive at next station (simplified: instant travel)
      train.currentStation = train.nextStation!;
      train.nextStation = null;
      train.status = "at-station";
      train.departureTime = now + 30000 + Math.random() * 30000; // 30-60 sec dwell
      train.passengers = Math.max(10, train.passengers + Math.floor(Math.random() * 40) - 20);

      // Random delay injection (~5% chance)
      if (Math.random() < 0.05) {
        train.status = "delayed";
        train.delayMinutes = 1 + Math.floor(Math.random() * 5);

        // Add alert
        state.alerts.push({
          id: `alert-${Date.now()}`,
          type: "delay",
          line: train.line,
          message: `${train.delayMinutes} min delay on ${line.name} at ${getStation(train.currentStation)?.name}`,
          timestamp: new Date().toISOString(),
        });

        // Keep only recent alerts
        if (state.alerts.length > 5) {
          state.alerts.shift();
        }
      }
    }
  }

  state.lastTick = now;
}

// Initialize simulation
initializeTrains();

// Run simulation tick every 2 seconds
setInterval(tickSimulation, 2000);

// ===== MCP SERVER =====
const server = new McpServer({
  name: "Subway Map Server",
  version: "1.0.0",
});

// Register the get-system-status tool and its associated UI resource
{
  const resourceUri = "ui://subway-map/mcp-app.html";

  server.registerTool(
    "get-system-status",
    {
      title: "Get Subway System Status",
      description: "Returns current train positions, statuses, and any active alerts.",
      inputSchema: {},
      outputSchema: {
        timestamp: z.string(),
        trains: z.array(z.object({
          id: z.string(),
          line: z.string(),
          direction: z.enum(["outbound", "inbound"]),
          currentStation: z.string(),
          nextStation: z.string().nullable(),
          status: z.enum(["at-station", "in-transit", "delayed"]),
          delayMinutes: z.number(),
          passengers: z.number(),
        })),
        alerts: z.array(z.object({
          id: z.string(),
          type: z.enum(["delay", "disruption"]),
          line: z.string(),
          message: z.string(),
          timestamp: z.string(),
        })),
      },
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async (): Promise<CallToolResult> => {
      const status = {
        timestamp: new Date().toISOString(),
        trains: state.trains,
        alerts: state.alerts,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
        structuredContent: status,
      };
    },
  );

  server.registerResource(
    resourceUri,
    resourceUri,
    { description: "Subway Map UI" },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );

      return {
        contents: [{ uri: resourceUri, mimeType: "text/html+mcp", text: html }],
      };
    },
  );
}

// ===== EXPRESS SERVER =====
const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const httpServer = app.listen(PORT, () => {
  console.log(`Subway Map Server listening on http://localhost:${PORT}/mcp`);
});

function shutdown() {
  console.log("\nShutting down...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

---

# APPENDIX C: Client Implementation Patterns

## svg-pan-zoom Setup

```typescript
// Import svg-pan-zoom (installed via npm)
import svgPanZoom from "svg-pan-zoom";

// Initialize after SVG is rendered in the DOM
function initPanZoom(): SvgPanZoom.Instance {
  const svgElement = document.getElementById("subway-map") as unknown as SVGSVGElement;

  const panZoomInstance = svgPanZoom(svgElement, {
    viewportSelector: "#viewport", // Optional: wrap SVG content in <g id="viewport">
    panEnabled: true,
    zoomEnabled: true,
    dblClickZoomEnabled: true,
    mouseWheelZoomEnabled: true,
    preventMouseEventsDefault: true,
    zoomScaleSensitivity: 0.3,
    minZoom: 0.5,
    maxZoom: 10,
    fit: true,
    center: true,

    // Optional callbacks
    onZoom: (scale) => {
      // Show/hide station labels based on zoom level
      const labels = document.querySelectorAll(".station-label");
      labels.forEach(label => {
        (label as HTMLElement).style.display = scale > 2 ? "block" : "none";
      });
    },
  });

  return panZoomInstance;
}

// Reset view button handler
function resetView(instance: SvgPanZoom.Instance): void {
  instance.resetZoom();
  instance.resetPan();
  instance.center();
}
```

## Tooltip Implementation

```typescript
// Tooltip element (add to HTML)
// <div id="tooltip" class="tooltip hidden"></div>

const tooltip = document.getElementById("tooltip")!;

function showTooltip(content: string, x: number, y: number): void {
  tooltip.innerHTML = content;
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y + 10}px`;
  tooltip.classList.remove("hidden");
}

function hideTooltip(): void {
  tooltip.classList.add("hidden");
}

// Station hover handler
function attachStationListeners(): void {
  const stationCircles = document.querySelectorAll(".station");

  stationCircles.forEach(circle => {
    const stationId = circle.getAttribute("data-id");
    const station = stations.find(s => s.id === stationId);

    circle.addEventListener("mouseenter", (e) => {
      if (!station) return;
      const rect = (e.target as Element).getBoundingClientRect();
      showTooltip(
        `<strong>${station.name}</strong><br/>Lines: ${station.lines.join(", ")}`,
        rect.right,
        rect.top
      );
    });

    circle.addEventListener("mouseleave", hideTooltip);
  });
}

// Train click handler
function attachTrainListeners(trains: Train[]): void {
  const trainCircles = document.querySelectorAll(".train");

  trainCircles.forEach(circle => {
    const trainId = circle.getAttribute("data-id");
    const train = trains.find(t => t.id === trainId);

    circle.addEventListener("click", (e) => {
      if (!train) return;
      const station = stations.find(s => s.id === train.currentStation);
      const line = lines.find(l => l.id === train.line);

      const statusBadge = train.status === "delayed"
        ? `<span class="badge delay">${train.delayMinutes}m delay</span>`
        : `<span class="badge ${train.status}">${train.status}</span>`;

      const rect = (e.target as Element).getBoundingClientRect();
      showTooltip(
        `<strong>${line?.name || train.line}</strong><br/>
         ${statusBadge}<br/>
         At: ${station?.name || train.currentStation}<br/>
         Direction: ${train.direction}<br/>
         Passengers: ~${train.passengers}`,
        rect.right,
        rect.top
      );
    });
  });
}
```

## Tooltip CSS

```css
/* src/mcp-app.css */

.tooltip {
  position: fixed;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 1000;
  max-width: 200px;
}

.tooltip.hidden {
  display: none;
}

.tooltip strong {
  font-weight: 600;
  color: var(--color-text-primary);
}

.tooltip .badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.tooltip .badge.at-station {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.tooltip .badge.in-transit {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.tooltip .badge.delay {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
```

## SVG Map Rendering

```typescript
// Render the subway map from data
function renderMap(): void {
  const svg = document.getElementById("subway-map")!;

  // Create viewport group for pan/zoom
  const viewport = document.createElementNS("http://www.w3.org/2000/svg", "g");
  viewport.id = "viewport";

  // Render lines first (below stations)
  const linesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  linesGroup.id = "lines";

  for (const line of lines) {
    const points = line.stations
      .map(id => stations.find(s => s.id === id))
      .filter(Boolean)
      .map(s => `${s!.x},${s!.y}`)
      .join(" ");

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("class", `line ${line.id}`);
    polyline.setAttribute("stroke", line.color);
    polyline.setAttribute("stroke-width", "4");
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");

    linesGroup.appendChild(polyline);
  }
  viewport.appendChild(linesGroup);

  // Render stations
  const stationsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  stationsGroup.id = "stations";

  for (const station of stations) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(station.x));
    circle.setAttribute("cy", String(station.y));
    circle.setAttribute("r", "6");
    circle.setAttribute("class", "station");
    circle.setAttribute("data-id", station.id);
    circle.setAttribute("fill", "#fff");
    circle.setAttribute("stroke", "#333");
    circle.setAttribute("stroke-width", "2");

    stationsGroup.appendChild(circle);
  }
  viewport.appendChild(stationsGroup);

  // Trains group (populated by updateTrains)
  const trainsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  trainsGroup.id = "trains";
  viewport.appendChild(trainsGroup);

  svg.appendChild(viewport);
}

// Update train positions from poll data
function updateTrains(trains: Train[]): void {
  const trainsGroup = document.getElementById("trains")!;
  trainsGroup.innerHTML = ""; // Clear existing trains

  for (const train of trains) {
    const station = stations.find(s => s.id === train.currentStation);
    const line = lines.find(l => l.id === train.line);
    if (!station || !line) continue;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(station.x));
    circle.setAttribute("cy", String(station.y));
    circle.setAttribute("r", "8");
    circle.setAttribute("class", `train ${train.status}`);
    circle.setAttribute("data-id", train.id);
    circle.setAttribute("fill", line.color);
    circle.setAttribute("stroke", "#fff");
    circle.setAttribute("stroke-width", "2");
    circle.style.cursor = "pointer";

    // Pulse animation for delayed trains
    if (train.status === "delayed") {
      circle.classList.add("delayed-pulse");
    }

    trainsGroup.appendChild(circle);
  }

  // Re-attach event listeners
  attachTrainListeners(trains);
}
```

## Complete Client Entry Point

```typescript
// src/mcp-app.ts
import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import svgPanZoom from "svg-pan-zoom";
import { stations, lines } from "./subway-data";
import "./global.css";
import "./mcp-app.css";

// Types
interface Train {
  id: string;
  line: string;
  direction: "outbound" | "inbound";
  currentStation: string;
  nextStation: string | null;
  status: "at-station" | "in-transit" | "delayed";
  delayMinutes: number;
  passengers: number;
}

interface Alert {
  id: string;
  type: "delay" | "disruption";
  line: string;
  message: string;
  timestamp: string;
}

interface SystemStatus {
  timestamp: string;
  trains: Train[];
  alerts: Alert[];
}

// State
const POLL_INTERVAL = 2000;
let isPolling = false;
let pollIntervalId: number | null = null;
let panZoomInstance: SvgPanZoom.Instance | null = null;

// Create app instance
const app = new App({ name: "Subway Map", version: "1.0.0" });

// ... (include renderMap, updateTrains, tooltip functions from above)

async function fetchStatus(): Promise<void> {
  try {
    const result = await app.callServerTool({
      name: "get-system-status",
      arguments: {},
    });

    const status = result.structuredContent as unknown as SystemStatus;
    updateTrains(status.trains);
    updateAlerts(status.alerts);
    updateStatusIndicator(status.timestamp, true);
  } catch (error) {
    console.error("Failed to fetch status:", error);
    updateStatusIndicator("Error", false, true);
  }
}

function startPolling(): void {
  if (isPolling) return;
  isPolling = true;
  fetchStatus();
  pollIntervalId = window.setInterval(fetchStatus, POLL_INTERVAL);
}

function stopPolling(): void {
  if (!isPolling) return;
  isPolling = false;
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

// Initialize
function init(): void {
  renderMap();
  attachStationListeners();
  panZoomInstance = initPanZoom();

  // Set up controls
  document.getElementById("poll-toggle")?.addEventListener("click", () => {
    if (isPolling) stopPolling(); else startPolling();
  });

  document.getElementById("reset-view")?.addEventListener("click", () => {
    panZoomInstance?.resetZoom();
    panZoomInstance?.center();
  });
}

// Connect and start
app.onerror = console.error;
app.connect(new PostMessageTransport(window.parent));

// Start after short delay
setTimeout(() => {
  init();
  startPolling();
}, 500);
```

---

# APPENDIX D: Package Configuration

## package.json

```json
{
  "name": "subway-map-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "INPUT=mcp-app.html vite build",
    "watch": "INPUT=mcp-app.html vite build --watch",
    "serve": "bun server.ts",
    "start": "NODE_ENV=development npm run build && npm run serve",
    "dev": "NODE_ENV=development concurrently 'npm run watch' 'npm run serve'"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "../..",
    "@modelcontextprotocol/sdk": "^1.22.0",
    "svg-pan-zoom": "^3.6.2",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/svg-pan-zoom": "^3.6.4",
    "concurrently": "^9.2.1",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0"
  }
}
```

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const input = process.env.INPUT || "mcp-app.html";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "esnext",
    rollupOptions: {
      input,
      output: {
        entryFileNames: "[name].js",
      },
    },
    outDir: "dist",
    emptyDirOnce: true,
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
    cssMinify: process.env.NODE_ENV === "production",
  },
});
```

## mcp-app.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BART Subway Map</title>
</head>
<body>
  <div class="app-container">
    <header class="header">
      <h1>BART System Map</h1>
      <div class="controls">
        <button id="poll-toggle" class="btn">Stop</button>
        <button id="reset-view" class="btn btn-secondary">Reset View</button>
        <div class="status">
          <span id="status-indicator" class="indicator polling"></span>
          <span id="status-text">Starting...</span>
        </div>
      </div>
    </header>

    <div id="alert-banner" class="alert-banner hidden"></div>

    <div class="map-container">
      <svg id="subway-map" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
        <!-- Content populated by JavaScript -->
      </svg>
    </div>

    <div class="legend">
      <div class="legend-item"><span class="color-dot" style="background:#ED1C24"></span>Richmond - Millbrae</div>
      <div class="legend-item"><span class="color-dot" style="background:#FFE800"></span>Antioch - SFO</div>
      <div class="legend-item"><span class="color-dot" style="background:#4AA74F"></span>Berryessa - Daly City</div>
      <div class="legend-item"><span class="color-dot" style="background:#0099D8"></span>Dublin - Daly City</div>
      <div class="legend-item"><span class="color-dot" style="background:#F7931E"></span>Richmond - Berryessa</div>
    </div>

    <div id="tooltip" class="tooltip hidden"></div>
  </div>

  <script type="module" src="./src/mcp-app.ts"></script>
</body>
</html>
```

---

# APPENDIX E: CSS Styles

```css
/* src/global.css */
:root {
  --color-bg: #ffffff;
  --color-surface: #f9fafb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
  --color-success: #10b981;
  --color-success-bg: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-bg: #fef3c7;
  --color-info: #3b82f6;
  --color-info-bg: #dbeafe;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-surface: #1f2937;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #374151;
    --color-success-bg: #064e3b;
    --color-warning-bg: #78350f;
    --color-info-bg: #1e3a8a;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 14px;
}
```

```css
/* src/mcp-app.css */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 600px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.header h1 {
  font-size: 14px;
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
}

.btn:hover {
  background: var(--color-border);
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-secondary);
}

.indicator.polling {
  background: var(--color-success);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.alert-banner {
  padding: 6px 12px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: 12px;
}

.alert-banner.hidden {
  display: none;
}

.map-container {
  flex: 1;
  overflow: hidden;
  background: var(--color-surface);
}

#subway-map {
  width: 100%;
  height: 100%;
}

.station {
  cursor: pointer;
  transition: r 0.15s;
}

.station:hover {
  r: 8;
}

.train {
  cursor: pointer;
  transition: r 0.15s;
}

.train:hover {
  r: 10;
}

.train.delayed {
  animation: delayed-pulse 0.8s infinite;
}

@keyframes delayed-pulse {
  0%, 100% { opacity: 1; r: 8; }
  50% { opacity: 0.7; r: 10; }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  font-size: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
}

/* Tooltip styles from Appendix C */
.tooltip {
  position: fixed;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 1000;
  max-width: 200px;
}

.tooltip.hidden {
  display: none;
}
```

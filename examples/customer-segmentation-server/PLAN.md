# Customer Segmentation Explorer - Implementation Plan

## Overview

An interactive scatter/bubble plot visualization that displays customer data with natural clustering. Users can explore segments by changing axes, hovering for details, and clicking to highlight clusters.

**Constraints:**
- 600×600 pixel viewport
- No vertical scrolling (horizontal scroll allowed if natural)
- No large committed datasets (generate in-memory)
- Business-focused demo for enterprise customers

## Architecture

### File Structure

```
examples/customer-segmentation-server/
├── package.json
├── server.ts                 # MCP server with tool + resource
├── tsconfig.json
├── vite.config.ts
├── mcp-app.html              # Entry HTML
├── src/
│   ├── mcp-app.ts            # Main app logic
│   ├── mcp-app.css           # App-specific styles
│   ├── global.css            # Base styles (copy from system-monitor)
│   ├── data-generator.ts     # Customer data generation with clustering
│   └── types.ts              # TypeScript interfaces
└── dist/
    └── mcp-app.html          # Built output
```

### Data Model

**Customer record:**

```typescript
interface Customer {
  id: string;
  name: string;
  segment: string;           // "Enterprise" | "Mid-Market" | "SMB" | "Startup"
  // Numeric metrics (plottable axes):
  annualRevenue: number;     // $10K - $10M
  employeeCount: number;     // 1 - 5000
  accountAge: number;        // months: 1 - 120
  engagementScore: number;   // 0 - 100
  supportTickets: number;    // 0 - 50
  nps: number;               // -100 to 100
}

interface SegmentSummary {
  name: string;
  count: number;
  color: string;
}
```

**Data generation strategy:**

- Generate 200-300 customers
- Use 4 pre-defined cluster centers with Gaussian noise
- Each segment has characteristic ranges for each metric
- Ensures realistic clustering without external datasets

**Cluster centers (approximate):**

| Segment     | Revenue    | Employees | Age (mo) | Engagement | Tickets | NPS  |
|-------------|------------|-----------|----------|------------|---------|------|
| Enterprise  | $2-10M     | 500-5000  | 60-120   | 70-95      | 5-20    | 40-80 |
| Mid-Market  | $500K-2M   | 100-500   | 36-84    | 60-85      | 10-30   | 20-60 |
| SMB         | $50K-500K  | 10-100    | 12-48    | 40-70      | 15-40   | 0-40  |
| Startup     | $10K-200K  | 1-50      | 1-24     | 50-90      | 5-25    | 10-70 |

## UI Layout (600×600, no vertical scroll)

```
┌─────────────────────────────────────────────────────────┐
│ Customer Segmentation Explorer          [Segment: All ▼]│  ~40px header
├─────────────────────────────────────────────────────────┤
│  X: [Revenue     ▼]   Y: [Engagement ▼]   Size: [Off ▼]│  ~36px controls
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                    SCATTER PLOT                         │  ~420px chart
│                    (Chart.js)                           │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ● Enterprise (45)  ● Mid-Market (62)  ● SMB (78) ...  │  ~40px legend
├─────────────────────────────────────────────────────────┤
│  Hover: Acme Corp | $2.4M rev | 89 eng | Enterprise    │  ~44px detail
└─────────────────────────────────────────────────────────┘
```

**Total: ~580px + padding = 600px**

## Segment Color Palette (Business-appropriate)

```typescript
const SEGMENT_COLORS: Record<string, string> = {
  "Enterprise":  "#1e40af", // Deep blue
  "Mid-Market":  "#0d9488", // Teal
  "SMB":         "#059669", // Emerald
  "Startup":     "#6366f1", // Indigo
};
```

## Interactivity Features

1. **Axis Selection** - Dropdown menus to change X and Y axes (6 metrics available)
2. **Size Toggle** - Dropdown to map bubble size to a metric (Off | Revenue | Employees | etc.)
3. **Segment Filter** - Dropdown to show all segments or filter to one
4. **Hover Tooltips** - Show customer name + key metrics on hover
5. **Click Selection** - Click point to pin details in footer panel
6. **Legend Click** - Toggle segment visibility on/off

## Company Name Generation

Generate realistic names by combining patterns:

```typescript
const prefixes = [
  "Apex", "Nova", "Prime", "Vertex", "Atlas", "Quantum", "Summit",
  "Nexus", "Titan", "Pinnacle", "Zenith", "Vanguard", "Horizon"
];

const cores = [
  "Tech", "Data", "Cloud", "Logic", "Sync", "Flow", "Core",
  "Net", "Soft", "Wave", "Link", "Mind", "Byte"
];

const suffixes = [
  "Corp", "Inc", "Solutions", "Systems", "Labs", "Group",
  "Industries", "Dynamics", "Partners", "Ventures"
];

// Examples: "Apex Data Corp", "Nova Cloud Solutions", "Quantum Systems Inc"
```

~100+ unique combinations from small word lists (no external dependency).

## Server Implementation

**Tool: `get-customer-data`**

- Input: `{ segment?: string }` (optional filter)
- Output: `{ customers: Customer[], segments: SegmentSummary[] }`
- Caches dataset in memory on first call; subsequent calls return same data

**Resource: `ui://customer-segmentation/mcp-app.html`**

- Returns bundled HTML from dist/

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "../..",
    "@modelcontextprotocol/sdk": "^1.22.0",
    "chart.js": "^4.4.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "concurrently": "^9.2.1",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0"
  }
}
```

No additional dependencies beyond what system-monitor-server uses.

## Implementation Steps

### 1. Scaffold project structure

- Copy base config files from system-monitor-server (tsconfig.json, vite.config.ts)
- Create package.json with updated name/description
- Create placeholder source files

### 2. Implement data generator (`src/data-generator.ts`)

- Define cluster centers for each segment
- Implement Gaussian noise function (Box-Muller transform)
- Generate company names from word lists
- Create `generateCustomers(count: number)` function
- Validate distribution looks realistic

### 3. Build server (`server.ts`)

- Register `get-customer-data` tool with Zod schemas
- Cache generated data in module-level variable
- Register UI resource pointing to dist/mcp-app.html
- Add optional segment filter to tool

### 4. Create UI HTML structure (`mcp-app.html`)

- Header with title + segment filter dropdown
- Control bar with X/Y axis selectors + size toggle
- Chart container (canvas element)
- Legend row
- Detail panel for hover/click info

### 5. Implement main app (`src/mcp-app.ts`)

- Initialize Chart.js bubble/scatter chart
- Connect to MCP server via PostMessageTransport
- Fetch data on app connect
- Wire up dropdown change handlers to re-render chart
- Implement hover tooltip customization
- Implement click-to-pin detail panel
- Handle segment visibility toggling via legend clicks

### 6. Style the UI (`src/mcp-app.css`)

- Adapt system-monitor patterns (CSS variables, dark mode)
- Ensure 600×600 fixed layout with no overflow
- Style dropdowns, legend, and detail panel
- Theme support (light/dark via prefers-color-scheme)

### 7. Test & Polish

- Verify no vertical scroll at exactly 600×600
- Test with basic-host
- Ensure theme switching works
- Verify all interactions work smoothly
- Polish hover states and transitions

## Design Decisions

1. **Bubble size**: Uniform by default, with toggle to enable sizing by a 3rd metric (Revenue, Employees, etc.)
2. **Customer names**: Realistic fake company names (e.g., "Apex Data Corp", "Nova Cloud Solutions")
3. **Data refresh**: Cache dataset in memory for session consistency (realistic exploration experience)
4. **Segment colors**: Business-appropriate palette (blues, teals, greens, indigo)
5. **Framework**: Vanilla JS (no React) to match system-monitor-server pattern

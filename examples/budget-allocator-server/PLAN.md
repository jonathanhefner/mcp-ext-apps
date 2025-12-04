# Budget Allocator Server — Implementation Plan

## Overview

An interactive budget allocation tool where users distribute a fixed budget across categories using sliders. Changes update a donut chart and summary metrics in real-time. The server provides **historical allocation data** (24 months of trends) and **industry benchmarks** by company stage, enabling users to see how their allocation compares to their past and to peers.

**Target viewport**: 600×600 pixels (responsive down to ~320px)

**Why historical data + benchmarks?**
- Historical data must come from a database (architecturally requires server)
- Benchmarks represent aggregated industry knowledge (cannot be client-side)
- Enables "Am I allocating normally?" insight
- Substantial server→client data flow (~200 data points)

---

## User Experience

### Layout (600×600)
```
┌──────────────────────────────────────────────────────────────┐
│  Budget Allocator                              $100,000 ▼    │
├──────────────────────────────────────────────────────────────┤
│                      ┌─────────┐                             │
│                     /   DONUT   \                            │ 160px
│                    │   CHART    │                            │
│                     \           /                            │
│                      └─────────┘                             │
├──────────────────────────────────────────────────────────────┤
│  Marketing    [sparkline] ████████░░  25.0%  50th           │
│                                        $25K                  │
│  Engineering  [sparkline] ██████████  35.0%  25th           │
│                                        $35K                  │
│  Operations   [sparkline] ████░░░░░░  15.0%  56th           │
│                                        $15K                  │
│  Sales        [sparkline] ███░░░░░░░  15.0%  25th           │
│                                        $15K                  │
│  R&D          [sparkline] ██░░░░░░░░  10.0%  38th           │
│                                        $10K                  │
├──────────────────────────────────────────────────────────────┤
│          Allocated: $100,000 / $100,000 ✓                   │
├──────────────────────────────────────────────────────────────┤
│  vs. Industry: Engineering 5% below avg    Stage: Series A ▼│
└──────────────────────────────────────────────────────────────┘
```

### Slider Row Layout
```
┌────────────┬──────────────┬────────────────┬─────────┬────────────┐
│  Label     │  Sparkline   │    Slider      │ Value   │ Percentile │
│  95px      │  50px        │  minmax(60,1fr)│  56px   │   46px     │
└────────────┴──────────────┴────────────────┴─────────┴────────────┘
```

- **Sparkline**: 50×28px canvas showing 24-month trend with tooltip on hover
- **Slider**: Range input with 16px circular thumb, left-padded to prevent bleeding
- **Percentile badge**: Color-coded indicator (green=normal, blue=high, orange=low)

### Interactions
1. **Drag sliders** to adjust category allocation (free mode with warning)
2. **Donut segments** update in real-time as sliders move
3. **Hover donut segment** to highlight corresponding slider row
4. **Click donut segment** to focus that slider
5. **Budget dropdown** to switch between preset totals ($50K, $100K, $250K, $500K)
6. **Stage dropdown** to switch benchmark comparison (Seed, Series A, Series B, Growth)
7. **Hover sparkline** to see tooltip with trend info

### Responsive Behavior
- **> 500px**: Full layout with sparklines
- **380-500px**: Smaller text/elements, narrower columns
- **< 380px**: Sparklines hidden, simplified layout

---

## Technical Architecture

### Directory Structure
```
examples/budget-allocator-server/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server.ts                 # MCP server + data generation
├── mcp-app.html              # Entry point
├── src/
│   ├── global.css            # Base styles
│   ├── mcp-app.ts            # Main app (vanilla JS + Chart.js)
│   ├── mcp-app.css           # App styles with responsive breakpoints
│   └── vite-env.d.ts
├── dist/
│   └── mcp-app.html          # Built output (single file)
├── PLAN.md
└── README.md
```

### Dependencies
- `@modelcontextprotocol/ext-apps` - MCP App SDK
- `chart.js` - Donut chart rendering
- `zod` - Schema validation
- `express`, `cors` - HTTP server
- `vite`, `vite-plugin-singlefile` - Build tooling

---

## Data Model

### Server Response (`get-budget-data` tool)
```typescript
interface BudgetDataResponse {
  config: {
    categories: Array<{
      id: string;
      name: string;
      color: string;
      defaultPercent: number;
    }>;
    presetBudgets: number[];      // [50000, 100000, 250000, 500000]
    defaultBudget: number;        // 100000
    currency: string;             // "USD"
    currencySymbol: string;       // "$"
  };
  analytics: {
    history: Array<{
      month: string;              // "2024-01"
      allocations: Record<string, number>;  // categoryId -> percentage
    }>;
    benchmarks: Array<{
      stage: string;              // "Seed", "Series A", etc.
      categoryBenchmarks: Record<string, {
        p25: number;
        p50: number;
        p75: number;
      }>;
    }>;
    stages: string[];
    defaultStage: string;
  };
}
```

### Data Volume
- 24 months × 5 categories = **120 historical data points**
- 4 stages × 5 categories × 3 percentiles = **60 benchmark data points**
- Category configs + metadata = **~20 data points**
- **Total: ~200 data points** from server

### Categories
| ID | Name | Color | Default |
|----|------|-------|---------|
| marketing | Marketing | #3b82f6 | 25% |
| engineering | Engineering | #10b981 | 35% |
| operations | Operations | #f59e0b | 15% |
| sales | Sales | #ef4444 | 15% |
| rd | R&D | #8b5cf6 | 10% |

### Benchmark Ranges by Stage
| Stage | Marketing | Engineering | Operations | Sales | R&D |
|-------|-----------|-------------|------------|-------|-----|
| Seed | 15-25% | 40-55% | 8-15% | 10-20% | 5-15% |
| Series A | 20-30% | 35-45% | 10-18% | 15-25% | 8-15% |
| Series B | 22-32% | 30-40% | 12-20% | 18-28% | 8-15% |
| Growth | 25-35% | 25-35% | 15-22% | 20-30% | 5-12% |

---

## Key Implementation Details

### Slider Thumb Bleeding Prevention
The slider thumb (16px) extends 8px past the track edge at 0%. To prevent it from overlapping the sparkline:
```css
:root {
  --slider-thumb-size: 16px;
}

.slider-container {
  padding: 4px 0 4px calc(var(--slider-thumb-size) / 2);
}
```

### Sparkline Tooltips
Each sparkline shows a tooltip on hover with trend information:
```
"Past allocations: 22% +3.3%"
```
- First value: allocation 24 months ago
- Second value: change from then to now

### Percentile Calculation
Percentile is interpolated from p25/p50/p75 benchmarks:
- Value ≤ p25: scales 0-25th percentile
- Value between p25-p50: scales 25th-50th
- Value between p50-p75: scales 50th-75th
- Value > p75: scales 75th-100th

### Chart-Slider Interaction
- Hovering a donut segment adds `.highlighted` class to corresponding slider row
- Clicking a donut segment focuses the slider input
- Slider changes update chart with `chart.update("none")` for instant feedback

---

## CSS Variables
```css
:root {
  --color-bg: #ffffff;
  --color-text: #1f2937;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  --slider-track: #e5e7eb;
  --slider-thumb: #3b82f6;
  --slider-thumb-size: 16px;
  --card-bg: #f9fafb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
    --color-text-muted: #9ca3af;
    --color-border: #374151;
    --slider-track: #374151;
    --slider-thumb: #60a5fa;
    --card-bg: #1f2937;
  }
}
```

---

## Implementation Checklist

### Phase 1: Setup
- [x] Create directory structure
- [x] Set up `package.json` with dependencies
- [x] Configure `tsconfig.json` and `vite.config.ts`
- [x] Create base HTML entry point

### Phase 2: Server
- [x] Implement Express server with MCP endpoint
- [x] Implement `generateHistory()` function for 24-month data
- [x] Define `BENCHMARKS` constant with 4 company stages
- [x] Register `get-budget-data` tool with full analytics
- [x] Register UI resource

### Phase 3: Client Core
- [x] Set up App connection and event handlers
- [x] Fetch and parse config + analytics on load
- [x] Create state management with analytics data
- [x] Populate stage dropdown from server data

### Phase 4: UI Components
- [x] Implement donut chart with Chart.js
- [x] Create slider row generator with sparkline canvas
- [x] Implement `drawSparkline()` function
- [x] Implement percentile badge calculation and rendering
- [x] Implement budget selector dropdown
- [x] Implement stage selector dropdown
- [x] Create status bar with comparison summary

### Phase 5: Interactivity
- [x] Wire slider → chart updates
- [x] Wire slider → percentile badge updates
- [x] Implement chart hover → slider highlight
- [x] Implement chart click → slider focus
- [x] Handle budget total changes
- [x] Handle stage changes → update all percentile badges

### Phase 6: Polish
- [x] Add dark mode CSS support
- [x] Test 600×600 fit with all elements
- [x] Add responsive breakpoints (500px, 380px)
- [x] Fix slider thumb bleeding with container padding
- [x] Add sparkline tooltips
- [x] Write README.md

---

## Running

```bash
# Install dependencies
npm install

# Build UI and start server
npm start

# Or for development with hot reload
npm run dev
```

Server available at `http://localhost:3001/mcp`

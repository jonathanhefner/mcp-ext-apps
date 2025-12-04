# SaaS Scenario Modeler - Implementation Plan

## Overview

An interactive MCP App demo targeting business customers. Users adjust 5 business parameters via sliders and see real-time 12-month projections of revenue, costs, and profitability.

**Why SaaS metrics?**
- Universal business relevance
- Multiple interdependent variables create "aha moments"
- Compelling visualizations
- Familiar to B2B audiences

---

## Constraints

- **Viewport**: 600×600 pixels
- **Scrolling**: No vertical scroll; horizontal scroll only if natural
- **Data**: In-memory generation (no external datasets)
- **Dependencies**: Mature libraries only (Chart.js already in use)

---

## Layout (600×600)

```
+----------------------------------------------------------+ 0px
|  SaaS Scenario Modeler                       [Reset]     |
+----------------------------------------------------------+ 44px
|  PARAMETERS                                              |
|  Starting MRR     [===========o--------] $50K            |
|  Growth Rate      [====o---------------]   5%            |
|  Churn Rate       [==o-----------------]   3%            |
|  Gross Margin     [===============o----]  80%            |
|  Fixed Costs      [=====o--------------] $30K            |
+----------------------------------------------------------+ 194px
|  12-MONTH PROJECTION                                     |
|  +------------------------------------------------------+|
|  |                                                      ||
|  |  [Line Chart]                                        ||
|  |  - MRR (blue area fill)                              ||
|  |  - Gross Profit (green line)                         ||
|  |  - Net Profit (orange line)                          ||
|  |                                                      ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+ 424px
|  KEY METRICS                                             |
|  +----------+  +----------+  +----------+                |
|  | $89K     |  | $786K    |  | $269K    |                |
|  | +79%     |  |          |  |          |                |
|  | Ending   |  | Total    |  | Total    |                |
|  | MRR      |  | Revenue  |  | Profit   |                |
|  +----------+  +----------+  +----------+                |
|  +----------+  +----------+  +----------+                |
|  | $1.07M   |  | 66%      |  | Month 2  |                |
|  | ARR      |  | Avg      |  | Break-   |                |
|  |          |  | Margin   |  | even     |                |
|  +----------+  +----------+  +----------+                |
+----------------------------------------------------------+ 600px
```

### Height Budget

| Section | Height | Details |
|---------|--------|---------|
| Header | 44px | Title + reset button |
| Parameters | 150px | 5 sliders × ~26px + section title + padding |
| Chart | 230px | Chart canvas (~180px) + title + padding |
| Metrics | 160px | 2 rows of 3 metric cards + padding |
| Gaps/Padding | 16px | Distributed spacing |
| **Total** | **600px** | |

---

## Parameters

| Parameter | Type | Min | Max | Default | Step | Unit |
|-----------|------|-----|-----|---------|------|------|
| Starting MRR | slider | 10,000 | 500,000 | 50,000 | 5,000 | $ |
| Monthly Growth Rate | slider | 0 | 20 | 5 | 0.5 | % |
| Monthly Churn Rate | slider | 0 | 15 | 3 | 0.5 | % |
| Gross Margin | slider | 50 | 95 | 80 | 5 | % |
| Fixed Costs | slider | 5,000 | 200,000 | 30,000 | 5,000 | $/mo |

---

## Calculations

### Monthly Projections (Month n, for n = 1 to 12)

```typescript
// Net growth rate (can be negative if churn > growth)
netGrowthRate = (monthlyGrowthRate - monthlyChurnRate) / 100

// MRR with compound growth
MRR[n] = startingMRR × (1 + netGrowthRate)^n

// Profit calculations
grossProfit[n] = MRR[n] × (grossMargin / 100)
netProfit[n] = grossProfit[n] - fixedCosts

// Cumulative
cumulativeRevenue[n] = sum(MRR[1..n])
```

### Summary Metrics

```typescript
endingMRR = MRR[12]
ARR = endingMRR × 12
totalRevenue = sum(MRR[1..12])
totalProfit = sum(netProfit[1..12])
mrrGrowthPct = ((endingMRR - startingMRR) / startingMRR) × 100
avgMargin = totalProfit / totalRevenue × 100
breakEvenMonth = first month where netProfit >= 0 (or null)
```

---

## File Structure

```
examples/scenario-modeler-server/
├── PLAN.md               # This file
├── README.md             # Usage documentation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript config
├── vite.config.ts        # Vite build config
├── server.ts             # MCP server with tool + resource
├── mcp-app.html          # HTML entry template
├── src/
│   ├── mcp-app.ts        # App logic + Chart.js
│   ├── mcp-app.css       # Component styles
│   └── global.css        # Base styles
└── dist/
    └── mcp-app.html      # Built single-file output (generated)
```

---

## Implementation Steps

### Step 1: Project Setup

Create directory and copy config files from `system-monitor-server`:
- `tsconfig.json` (copy exactly)
- `vite.config.ts` (copy exactly)
- `src/global.css` (copy exactly)

Create `package.json`:
```json
{
  "name": "scenario-modeler-server",
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

### Step 2: Server Implementation (`server.ts`)

Key components:
1. Import MCP SDK and dependencies
2. Define `ScenarioInputs` and projection types
3. Implement `calculateProjections()` function
4. Implement `calculateSummary()` function
5. Register `run-scenario` tool with:
   - Input schema (5 parameters with defaults)
   - Output schema (projections array + summary object)
   - `_meta[RESOURCE_URI_META_KEY]` linking to UI
6. Register UI resource serving `dist/mcp-app.html`
7. Express server on port 3002

### Step 3: HTML Template (`mcp-app.html`)

Structure:
```html
<main class="main">
  <header class="header">
    <h1 class="title">SaaS Scenario Modeler</h1>
    <button id="reset-btn" class="btn btn-secondary">Reset</button>
  </header>

  <section class="parameters-section">
    <h2 class="section-title">Parameters</h2>
    <!-- 5 slider rows -->
  </section>

  <section class="chart-section">
    <h2 class="section-title">12-Month Projection</h2>
    <div class="chart-container">
      <canvas id="projection-chart"></canvas>
    </div>
  </section>

  <section class="metrics-section">
    <h2 class="section-title">Key Metrics</h2>
    <div class="metrics-grid">
      <!-- 6 metric cards in 2×3 grid -->
    </div>
  </section>
</main>
```

### Step 4: Styles (`src/mcp-app.css`)

Key CSS features:
- CSS variables for light/dark themes via `prefers-color-scheme`
- Fixed 600×600 layout with `overflow: hidden`
- Compact slider rows (24px height)
- Flex-based chart container
- Grid-based metrics (3 columns, 2 rows)
- Custom slider thumb styling

### Step 5: App Logic (`src/mcp-app.ts`)

Key components:
1. Initialize Chart.js with 3 datasets:
   - MRR (blue area fill)
   - Gross Profit (green line)
   - Net Profit (orange line)
2. Client-side calculation functions (same as server)
3. Slider event listeners → `recalculate()`
4. `recalculate()`: update slider display, chart, and metrics
5. Reset button → restore defaults
6. Theme change listener → rebuild chart
7. Connect to MCP transport

### Step 6: Testing

1. `npm install`
2. `npm run build` — verify `dist/mcp-app.html` exists
3. `npm run start` — server on port 3002
4. Test with `basic-host` example
5. Verify:
   - Slider responsiveness (instant feedback)
   - Chart updates smoothly
   - Metrics calculate correctly
   - Reset button works
   - Light/dark mode transitions

---

## Technical Decisions

### Client-side calculations
All calculations run in the browser for instant slider feedback. The server tool exists for:
- Initial state/validation
- Programmatic LLM access
- Consistency verification

### Chart.js
Already used in `system-monitor-server`. Mature, well-documented, good animation support.

### Vanilla JS (not React)
Follows `system-monitor-server` pattern. Smaller bundle, simpler for this use case.

### Port 3002
Avoids conflict with `system-monitor-server` (port 3001). Allows running both simultaneously.

---

## Reference Patterns

Files to reference from `system-monitor-server`:

| Pattern | File | Lines |
|---------|------|-------|
| Tool registration with UI link | `server.ts` | 73-152 |
| Chart.js initialization | `src/mcp-app.ts` | 117-188 |
| Theme detection + chart rebuild | `src/mcp-app.ts` | 340-361 |
| CSS variable theming | `src/mcp-app.css` | 1-29 |
| Slider styling | (new for this app) | — |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Chart doesn't fit | Reduced height to ~180px, compact legend |
| Sliders feel cramped | 24px row height with optimized spacing |
| Metrics overflow | Abbreviated currency format ($50K, $1.07M) |
| Performance on drag | Client-side calculations, no server calls |
| Dark mode chart issues | Rebuild chart on theme change |
| Negative profit display | Handle sign in formatting |

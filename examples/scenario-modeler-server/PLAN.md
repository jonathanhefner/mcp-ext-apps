# SaaS Scenario Modeler - Implementation Plan

## Overview

An interactive MCP App demo targeting business customers. Users adjust 5 business parameters via sliders and see real-time 12-month projections of revenue, costs, and profitability. The server provides **pre-built scenario templates** representing common business strategies, allowing users to compare their custom scenario against proven patterns.

**Why SaaS metrics?**
- Universal business relevance
- Multiple interdependent variables create "aha moments"
- Compelling visualizations
- Familiar to B2B audiences

**Why scenario templates?**
- Templates represent curated domain expertise (architecturally requires server)
- Enables "What does a bootstrapped SaaS look like?" exploration
- Comparison view adds analytical depth
- Substantial server→client data flow (~200 data points)

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
|  SaaS Scenario Modeler    [Template ▼]           [Reset] |
+----------------------------------------------------------+ 40px
|  PARAMETERS                                              |
|  Starting MRR     [===========o--------] $50K            |
|  Growth Rate      [====o---------------]   5%            |
|  Churn Rate       [==o-----------------]   3%            |  140px
|  Gross Margin     [===============o----]  80%            |
|  Fixed Costs      [=====o--------------] $30K            |
+----------------------------------------------------------+ 180px
|  12-MONTH PROJECTION                                     |
|  +------------------------------------------------------+|
|  |  [Line Chart]                                        ||
|  |  ── Your scenario (solid lines)                      ||  230px
|  |  ┄┄ Template comparison (dashed, when selected)      ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+ 410px
|  YOUR SCENARIO              vs. BOOTSTRAPPED GROWTH      |
|  +--------+ +--------+ +--------+   +--------+ +--------+|
|  | $89K   | | $786K  | | $269K  |   | $72K   | | $195K  ||  150px
|  | End MRR| | Revenue| | Profit |   | End MRR| | Profit ||
|  +--------+ +--------+ +--------+   +--------+ +--------+|
|  | Mo. 2 breakeven    | +79% growth |   vs. template: +24%|
+----------------------------------------------------------+ 600px
```

### Height Budget

| Section | Height | Details |
|---------|--------|---------|
| Header | 40px | Title + template dropdown + reset button |
| Parameters | 140px | 5 sliders × 24px + section title + padding |
| Chart | 230px | Chart canvas (~190px) + title + legend |
| Metrics | 150px | Your metrics (3 cards) + template comparison (2 cards) + summary row |
| Gaps/Padding | 40px | Distributed spacing |
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

## Scenario Templates

The server provides pre-built scenario templates representing common SaaS business strategies. Each template includes parameters, pre-computed 12-month projections, and summary metrics.

### Template Data Model

```typescript
interface ScenarioTemplate {
  id: string;                    // "bootstrapped", "vc-rocketship", etc.
  name: string;                  // "Bootstrapped Growth"
  description: string;           // "Low burn, steady growth, path to profitability"
  icon: string;                  // Emoji or icon identifier
  parameters: ScenarioInputs;    // The 5 slider values
  projections: MonthlyProjection[]; // Pre-computed 12 months
  summary: ScenarioSummary;      // Pre-computed summary metrics
  keyInsight: string;            // "Profitable by month 4, but slower scale"
}

interface ScenarioInputs {
  startingMRR: number;
  monthlyGrowthRate: number;
  monthlyChurnRate: number;
  grossMargin: number;
  fixedCosts: number;
}

interface MonthlyProjection {
  month: number;                 // 1-12
  mrr: number;
  grossProfit: number;
  netProfit: number;
  cumulativeRevenue: number;
}

interface ScenarioSummary {
  endingMRR: number;
  arr: number;
  totalRevenue: number;
  totalProfit: number;
  mrrGrowthPct: number;
  avgMargin: number;
  breakEvenMonth: number | null;
}
```

### Pre-defined Templates

| Template | Starting MRR | Growth | Churn | Margin | Fixed Costs | Character |
|----------|-------------|--------|-------|--------|-------------|-----------|
| **Bootstrapped Growth** | $30K | 4% | 2% | 85% | $20K | Slow & steady, early profit |
| **VC Rocketship** | $100K | 15% | 5% | 70% | $150K | High burn, explosive growth |
| **Cash Cow** | $80K | 2% | 1% | 90% | $40K | Mature, high margin, stable |
| **Turnaround** | $60K | 6% | 8% | 75% | $50K | Fighting churn, rebuilding |
| **Efficient Growth** | $50K | 8% | 3% | 80% | $35K | Balanced approach |

### Data Volume

- 5 templates × (5 params + 12 months × 4 metrics + 7 summary fields + metadata)
- = 5 × (5 + 48 + 7 + 3) = **~315 data points** from server

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
2. Define types: `ScenarioInputs`, `MonthlyProjection`, `ScenarioSummary`, `ScenarioTemplate`
3. Implement `calculateProjections(inputs: ScenarioInputs)` function
4. Implement `calculateSummary(projections: MonthlyProjection[])` function
5. Define `SCENARIO_TEMPLATES` array with 5 pre-built templates (each with params, projections, summary)
6. Register `get-scenario-data` tool:

```typescript
interface GetScenarioDataInput {
  // Optional: if provided, compute projections for custom inputs
  customInputs?: ScenarioInputs;
}

interface GetScenarioDataOutput {
  templates: ScenarioTemplate[];        // All 5 templates with full data
  defaultInputs: ScenarioInputs;        // Default slider values
  customProjections?: MonthlyProjection[]; // If customInputs provided
  customSummary?: ScenarioSummary;         // If customInputs provided
}
```

7. Register UI resource serving `dist/mcp-app.html`
8. Express server on port 3002

### Server Tool Registration

```typescript
server.registerTool(
  "get-scenario-data",
  {
    title: "Get Scenario Data",
    description: "Returns scenario templates and optionally computes custom projections",
    inputSchema: {
      customInputs: z.object({
        startingMRR: z.number(),
        monthlyGrowthRate: z.number(),
        monthlyChurnRate: z.number(),
        grossMargin: z.number(),
        fixedCosts: z.number(),
      }).optional(),
    },
    outputSchema: {
      templates: z.array(ScenarioTemplateSchema),
      defaultInputs: ScenarioInputsSchema,
      customProjections: z.array(MonthlyProjectionSchema).optional(),
      customSummary: ScenarioSummarySchema.optional(),
    },
    _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
  },
  async (args): Promise<CallToolResult> => {
    const result: GetScenarioDataOutput = {
      templates: SCENARIO_TEMPLATES,
      defaultInputs: DEFAULT_INPUTS,
    };

    if (args.customInputs) {
      result.customProjections = calculateProjections(args.customInputs);
      result.customSummary = calculateSummary(result.customProjections);
    }

    return {
      content: [{ type: "text", text: formatScenarioSummary(result) }],
      structuredContent: result,
    };
  }
);
```

### Step 3: HTML Template (`mcp-app.html`)

Structure:
```html
<main class="main">
  <header class="header">
    <h1 class="title">SaaS Scenario Modeler</h1>
    <div class="header-controls">
      <select id="template-select" class="template-select">
        <option value="">Compare to template...</option>
        <!-- Populated from server data -->
      </select>
      <button id="reset-btn" class="btn btn-secondary">Reset</button>
    </div>
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
    <div class="chart-legend">
      <span class="legend-item legend-yours">── Your scenario</span>
      <span class="legend-item legend-template" id="template-legend" hidden>┄┄ Template</span>
    </div>
  </section>

  <section class="metrics-section">
    <div class="metrics-comparison">
      <div class="metrics-column metrics-yours">
        <h3 class="metrics-title">Your Scenario</h3>
        <div class="metrics-grid">
          <!-- 3 metric cards: Ending MRR, Total Revenue, Total Profit -->
        </div>
      </div>
      <div class="metrics-column metrics-template" id="template-metrics" hidden>
        <h3 class="metrics-title" id="template-name">vs. Template</h3>
        <div class="metrics-grid">
          <!-- 2 metric cards: Ending MRR, Total Profit -->
        </div>
      </div>
    </div>
    <div class="metrics-summary">
      <!-- Summary row: breakeven, growth %, comparison delta -->
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

**State Management:**
```typescript
interface AppState {
  templates: ScenarioTemplate[];      // From server
  selectedTemplateId: string | null;  // Currently compared template
  currentInputs: ScenarioInputs;      // Current slider values
  // Client-computed (for instant slider feedback):
  currentProjections: MonthlyProjection[];
  currentSummary: ScenarioSummary;
}
```

**Initialization:**
1. Connect to MCP transport
2. On tool result, receive templates + default inputs from server
3. Populate template dropdown with template names
4. Initialize sliders with default inputs
5. Initialize Chart.js with 6 datasets (3 solid for user, 3 dashed for template)

**Chart Configuration:**
```typescript
datasets: [
  // User scenario (solid lines)
  { label: "MRR", borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)", fill: true },
  { label: "Gross Profit", borderColor: "#10b981", borderDash: [] },
  { label: "Net Profit", borderColor: "#f59e0b", borderDash: [] },
  // Template comparison (dashed lines, initially hidden)
  { label: "Template MRR", borderColor: "#3b82f6", borderDash: [5, 5], hidden: true },
  { label: "Template Gross Profit", borderColor: "#10b981", borderDash: [5, 5], hidden: true },
  { label: "Template Net Profit", borderColor: "#f59e0b", borderDash: [5, 5], hidden: true },
]
```

**Event Handlers:**
1. Slider input → `recalculate()` (client-side, instant)
2. Template dropdown change → `selectTemplate(templateId)`
3. Reset button → restore default inputs, clear template selection
4. Theme change → rebuild chart

**Template Selection:**
```typescript
function selectTemplate(templateId: string | null): void {
  state.selectedTemplateId = templateId;

  if (templateId) {
    const template = state.templates.find(t => t.id === templateId);
    // Show template datasets on chart
    chart.data.datasets[3].data = template.projections.map(p => p.mrr);
    chart.data.datasets[4].data = template.projections.map(p => p.grossProfit);
    chart.data.datasets[5].data = template.projections.map(p => p.netProfit);
    chart.data.datasets[3].hidden = false;
    chart.data.datasets[4].hidden = false;
    chart.data.datasets[5].hidden = false;
    // Show template metrics panel
    showTemplateMetrics(template);
  } else {
    // Hide template datasets
    chart.data.datasets[3].hidden = true;
    chart.data.datasets[4].hidden = true;
    chart.data.datasets[5].hidden = true;
    hideTemplateMetrics();
  }
  chart.update();
}
```

**"Load Template" Feature (optional):**
- Clicking a "Load" button next to template name copies template params to sliders
- Allows users to start from a template and modify

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
   - **Template dropdown populated with 5 templates**
   - **Selecting template shows dashed comparison lines on chart**
   - **Template metrics panel appears when template selected**
   - **Comparison delta (your scenario vs template) displays correctly**
   - **Clearing template selection hides comparison elements**

---

## Technical Decisions

### Client-side calculations for sliders
All projection calculations run in the browser for instant slider feedback. The server tool exists for:
- Providing scenario templates (curated domain knowledge)
- Initial state/validation
- Programmatic LLM access

### Server-side templates (architectural justification)
Templates must come from the server because they represent:
- Curated business strategy patterns (domain expertise)
- In production: could be learned from real company cohort data
- Pre-computed projections ensure consistency with server-side logic

This is **not contrived** — a real SaaS planning tool would source strategy templates from a backend with industry knowledge.

### Chart.js
Already used in `system-monitor-server`. Mature, well-documented, good animation support. Dashed line support for template comparison is built-in.

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
| Chart doesn't fit | Reduced height to ~190px, compact legend |
| Sliders feel cramped | 24px row height with optimized spacing |
| Metrics overflow | Abbreviated currency format ($50K, $1.07M) |
| Performance on drag | Client-side calculations, no server calls |
| Dark mode chart issues | Rebuild chart on theme change |
| Negative profit display | Handle sign in formatting |
| Template comparison clutters chart | Use dashed lines with lower opacity; limit to 3 metrics |
| Metrics section too wide with comparison | Side-by-side layout; template shows only 2 key metrics |
| Template dropdown too long | 5 templates max; truncate names if needed |

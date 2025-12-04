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

### Layout Strategy

Uses **flex layout** with proportional sizing rather than fixed pixel heights:

| Section | Flex | Details |
|---------|------|---------|
| Header | `flex-shrink: 0` | Fixed 40px height |
| Parameters | `flex-shrink: 0` | Fixed height (5 sliders × 24px + padding) |
| Chart | `flex: 2` | Takes 2/3 of remaining space |
| Metrics | `flex: 1` | Takes 1/3 of remaining space |

**Key CSS pattern**: Use `min-height: 0` on flex children to allow them to shrink below their content size. This is essential for fitting content within the 600×600 constraint.

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
├── mcp-app.html          # HTML entry template (React mount point)
├── src/
│   ├── mcp-app.tsx       # Main App component
│   ├── components/
│   │   ├── SliderRow.tsx     # Reusable parameter slider
│   │   ├── MetricCard.tsx    # Reusable metric display card
│   │   └── ProjectionChart.tsx # Chart.js wrapper component
│   ├── hooks/
│   │   └── useTheme.ts       # Theme detection hook
│   ├── lib/
│   │   ├── calculations.ts   # Projection/summary calculation functions
│   │   └── formatters.ts     # Currency/percent formatting utilities
│   ├── types.ts          # TypeScript interfaces
│   ├── mcp-app.css       # Component styles
│   └── global.css        # Base styles
└── dist/
    └── mcp-app.html      # Built single-file output (generated)
```

---

## Implementation Steps

### Step 1: Project Setup

Create directory and copy config files from `basic-server-react`:
- `tsconfig.json` (copy exactly — includes JSX support)
- `vite.config.ts` (copy exactly — includes React plugin)
- `src/global.css` (copy from `system-monitor-server`)

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
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
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
8. Express server on port 3001

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

Minimal React mount point:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SaaS Scenario Modeler</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./src/mcp-app.tsx"></script>
</body>
</html>
```

All UI structure is defined in React components.

### Step 4: Styles (`src/mcp-app.css`)

Key CSS features:
- CSS variables for light/dark themes via `prefers-color-scheme`
- Fixed 600×600 main container with `overflow: hidden`
- **Flex-based vertical layout** with `flex: 2` for chart, `flex: 1` for metrics
- **`min-height: 0`** on flex children to allow shrinking below content size
- Compact slider rows (24px height)
- Grid-based metrics with `grid-auto-rows: 1fr` for equal heights
- Custom slider thumb styling
- `flex-shrink: 0` on fixed-height sections (header, parameters, summary)

### Step 5: React Components (`src/`)

**Main App Component (`mcp-app.tsx`):**
```tsx
import { useState, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { McpClientProvider, useToolResult } from "@anthropic/ext-app-sdk/react";
import { SliderRow } from "./components/SliderRow";
import { MetricCard } from "./components/MetricCard";
import { ProjectionChart } from "./components/ProjectionChart";
import { calculateProjections, calculateSummary } from "./lib/calculations";
import { formatCurrency, formatPercent } from "./lib/formatters";
import type { ScenarioInputs, ScenarioTemplate } from "./types";
import "./global.css";
import "./mcp-app.css";

const DEFAULT_INPUTS: ScenarioInputs = {
  startingMRR: 50000,
  monthlyGrowthRate: 5,
  monthlyChurnRate: 3,
  grossMargin: 80,
  fixedCosts: 30000,
};

function App() {
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);

  // Receive templates from server on tool result
  useToolResult((result) => {
    if (result.structuredContent?.templates) {
      setTemplates(result.structuredContent.templates);
    }
  });

  // Derived state — recalculates automatically when inputs change
  const projections = useMemo(() => calculateProjections(inputs), [inputs]);
  const summary = useMemo(() => calculateSummary(projections), [projections]);

  // Selected template (if any)
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // Handlers
  const handleInputChange = useCallback((key: keyof ScenarioInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setSelectedTemplateId(null);
  }, []);

  const handleLoadTemplate = useCallback((template: ScenarioTemplate) => {
    setInputs(template.parameters);
    setSelectedTemplateId(null); // Clear comparison after loading
  }, []);

  return (
    <main className="main">
      <Header
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        onReset={handleReset}
      />

      <ParametersSection inputs={inputs} onChange={handleInputChange} />

      <ProjectionChart
        userProjections={projections}
        templateProjections={selectedTemplate?.projections ?? null}
        templateName={selectedTemplate?.name}
      />

      <MetricsSection
        userSummary={summary}
        templateSummary={selectedTemplate?.summary ?? null}
        templateName={selectedTemplate?.name}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <McpClientProvider>
    <App />
  </McpClientProvider>
);
```

**Reusable Components:**

`SliderRow.tsx` — Used 5 times for parameter inputs:
```tsx
interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;  // e.g., formatCurrency or formatPercent
  onChange: (value: number) => void;
}

export function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <div className="slider-row">
      <label className="slider-label">{label}</label>
      <input
        type="range"
        className="slider-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{format(value)}</span>
    </div>
  );
}
```

`MetricCard.tsx` — Used for displaying summary metrics:
```tsx
interface MetricCardProps {
  label: string;
  value: string;
  variant?: "default" | "positive" | "negative";
}

export function MetricCard({ label, value, variant = "default" }: MetricCardProps) {
  return (
    <div className={`metric-card metric-card--${variant}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
```

`ProjectionChart.tsx` — Chart.js wrapper with imperative updates:
```tsx
import { useRef, useEffect } from "react";
import { Chart, registerables } from "chart.js";
import { useTheme } from "../hooks/useTheme";
import type { MonthlyProjection } from "../types";

Chart.register(...registerables);

interface ProjectionChartProps {
  userProjections: MonthlyProjection[];
  templateProjections: MonthlyProjection[] | null;
  templateName?: string;
}

export function ProjectionChart({ userProjections, templateProjections, templateName }: ProjectionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const theme = useTheme();

  // Create chart on mount, rebuild on theme change
  useEffect(() => {
    if (!canvasRef.current) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: Array.from({ length: 12 }, (_, i) => `M${i + 1}`),
        datasets: [
          // User scenario (solid lines)
          { label: "MRR", borderColor: "#3b82f6", data: [], fill: false },
          { label: "Gross Profit", borderColor: "#10b981", data: [] },
          { label: "Net Profit", borderColor: "#f59e0b", data: [] },
          // Template comparison (dashed lines)
          { label: "Template MRR", borderColor: "#3b82f6", borderDash: [5, 5], data: [], hidden: true },
          { label: "Template Gross", borderColor: "#10b981", borderDash: [5, 5], data: [], hidden: true },
          { label: "Template Net", borderColor: "#f59e0b", borderDash: [5, 5], data: [], hidden: true },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: theme === "dark" ? "#9ca3af" : "#6b7280" } },
          x: { ticks: { color: theme === "dark" ? "#9ca3af" : "#6b7280" } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [theme]);

  // Update data when projections change
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    chart.data.datasets[0].data = userProjections.map((p) => p.mrr);
    chart.data.datasets[1].data = userProjections.map((p) => p.grossProfit);
    chart.data.datasets[2].data = userProjections.map((p) => p.netProfit);

    if (templateProjections) {
      chart.data.datasets[3].data = templateProjections.map((p) => p.mrr);
      chart.data.datasets[4].data = templateProjections.map((p) => p.grossProfit);
      chart.data.datasets[5].data = templateProjections.map((p) => p.netProfit);
      chart.data.datasets[3].hidden = false;
      chart.data.datasets[4].hidden = false;
      chart.data.datasets[5].hidden = false;
    } else {
      chart.data.datasets[3].hidden = true;
      chart.data.datasets[4].hidden = true;
      chart.data.datasets[5].hidden = true;
    }

    chart.update();
  }, [userProjections, templateProjections]);

  return (
    <section className="chart-section">
      <h2 className="section-title">12-Month Projection</h2>
      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>
      <div className="chart-legend">
        <span className="legend-item legend-yours">── Your scenario</span>
        {templateProjections && (
          <span className="legend-item legend-template">┄┄ {templateName}</span>
        )}
      </div>
    </section>
  );
}
```

**Conditional Template Comparison:**

The template metrics panel only renders when a template is selected:
```tsx
function MetricsSection({ userSummary, templateSummary, templateName }) {
  return (
    <section className="metrics-section">
      <div className="metrics-comparison">
        <div className="metrics-column">
          <h3>Your Scenario</h3>
          <MetricCard label="End MRR" value={formatCurrency(userSummary.endingMRR)} />
          <MetricCard label="Revenue" value={formatCurrency(userSummary.totalRevenue)} />
          <MetricCard label="Profit" value={formatCurrency(userSummary.totalProfit)} />
        </div>

        {templateSummary && (
          <div className="metrics-column metrics-template">
            <h3>vs. {templateName}</h3>
            <MetricCard label="End MRR" value={formatCurrency(templateSummary.endingMRR)} />
            <MetricCard label="Profit" value={formatCurrency(templateSummary.totalProfit)} />
          </div>
        )}
      </div>
    </section>
  );
}
```

**"Load Template" Feature (optional):**
- Add a "Load" button in the template dropdown
- Clicking calls `handleLoadTemplate(template)` to copy params to sliders

### Step 6: Testing

1. `npm install`
2. `npm run build` — verify `dist/mcp-app.html` exists
3. `npm run start` — server on port 3001
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
Already used in `system-monitor-server`. Mature, well-documented, good animation support. Dashed line support for template comparison is built-in. Wrapped in a React component with refs for imperative updates.

### React (not Vanilla JS)
Chosen over vanilla JS for this demo because:
- **5 controlled slider inputs** — React's controlled component pattern is purpose-built for form state
- **Derived state clarity** — `useMemo` makes the dependency chain explicit: inputs → projections → summary
- **Conditional template comparison** — `{templateSummary && ...}` is cleaner than manual `.hidden` toggles across multiple elements
- **Component reuse** — `<SliderRow>` (×5) and `<MetricCard>` (×5+) reduce boilerplate significantly
- **Maintainability** — Future extensions (e.g., "Load Template" feature) are trivial to add

Follows `basic-server-react` pattern.

---

## Reference Patterns

Files to reference from `basic-server-react`:

| Pattern | File |
|---------|------|
| React + Vite config | `vite.config.ts`, `tsconfig.json` |
| McpClientProvider setup | `src/mcp-app.tsx` |
| useToolResult hook | `src/mcp-app.tsx` |

Files to reference from `system-monitor-server`:

| Pattern | File |
|---------|------|
| Tool registration with UI link | `server.ts` |
| Chart.js initialization | `src/mcp-app.ts` |
| Theme detection | `src/mcp-app.ts` |
| CSS variable theming | `src/mcp-app.css` |
| global.css base styles | `src/global.css` |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Content doesn't fit 600×600 | **Flex layout with `min-height: 0`** allows sections to shrink; chart uses `flex: 2`, metrics uses `flex: 1` |
| Chart doesn't fit | Flex-based height with `min-height: 0`; compact "M1"-"M12" x-axis labels |
| Sliders feel cramped | 24px row height with optimized spacing |
| Metrics overflow | Abbreviated currency format ($50K, $1.07M); `grid-auto-rows: 1fr` for equal card heights |
| Performance on drag | Client-side calculations via useMemo, no server calls |
| Dark mode chart issues | useTheme hook triggers chart rebuild via useEffect dependency |
| Negative profit display | Handle sign in formatting utilities |
| Template comparison clutters chart | Use dashed lines with lower opacity; limit to 3 metrics |
| Metrics section too wide with comparison | Side-by-side layout; template shows only 2 key metrics |
| Template dropdown too long | 5 templates max; truncate names if needed |
| Chart.js + React integration | Isolate in ProjectionChart component with refs; separate creation and update effects |

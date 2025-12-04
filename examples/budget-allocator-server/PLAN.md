# Budget Allocator Server — Implementation Plan

## Overview

An interactive budget allocation tool where users distribute a fixed budget across categories using sliders. Changes update a donut chart and summary metrics in real-time. The server provides **historical allocation data** (24 months of trends) and **industry benchmarks** by company stage, enabling users to see how their allocation compares to their past and to peers.

**Target viewport**: 600×600 pixels (no vertical scroll)

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
│  Budget Allocator                              $100,000 ▼    │ 40px
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                      ┌─────────┐                             │
│                     /   DONUT   \                            │ 220px
│                    │   CHART    │                            │ (reduced)
│                     \           /                            │
│                      └─────────┘                             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Marketing    [~~24mo~~] ████████░░  $32K  ● 75th %ile      │
│  Engineering  [~~trend~~] ██████████  $40K  ● 60th %ile      │ 200px
│  Operations   [~~trend~~] ████░░░░░░  $15K  ▼ 25th %ile      │ (5 rows)
│  Sales        [~~trend~~] ███░░░░░░░  $13K  ● 50th %ile      │
│  R&D          [~~trend~~] ██░░░░░░░░   $0K  ▼ 10th %ile      │
├──────────────────────────────────────────────────────────────┤
│  Allocated: $100K / $100K ✓    Stage: [Series A ▼]          │ 36px
├──────────────────────────────────────────────────────────────┤
│  vs. Industry: ~similar overall | Marketing ▲ +8% above avg │ 32px
└──────────────────────────────────────────────────────────────┘
```

### Layout Details

**Slider Row Breakdown** (per row, ~36px height):
```
┌────────────┬──────────────┬────────────────┬─────────┬────────────┐
│  Label     │  Sparkline   │    Slider      │ Amount  │ Percentile │
│  90px      │  50px        │    180px       │  50px   │   60px     │
└────────────┴──────────────┴────────────────┴─────────┴────────────┘
```

- **Sparkline**: 24-month trend visualization (tiny area chart)
- **Percentile badge**: Color-coded indicator showing where current allocation ranks vs. benchmarks
  - Green (●): 40th-60th percentile (normal)
  - Blue (▲): Above 60th percentile (high)
  - Orange (▼): Below 40th percentile (low)

### Interactions
1. **Drag sliders** to adjust category allocation
2. **Constraint**: Total must equal budget (sliders proportionally adjust others, or show warning)
3. **Donut segments** update in real-time as sliders move
4. **Hover donut segment** to highlight corresponding slider
5. **Click donut segment** to focus that slider
6. **Budget dropdown** to switch between preset totals ($50K, $100K, $250K, $500K)
7. **Stage dropdown** to switch benchmark comparison (Seed, Series A, Series B, Growth)
8. **Hover sparkline** to see historical value at that point
9. **Percentile badges** update when stage changes (different benchmarks per stage)

### Constraint Mode Options
- **Proportional rebalance**: Adjusting one slider proportionally adjusts others to maintain 100%
- **Free mode with warning**: Allow over/under allocation, show red warning if ≠100%

**Recommendation**: Free mode with warning (simpler to implement, more intuitive)

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
│   ├── mcp-app.ts            # Main app (vanilla JS)
│   ├── mcp-app.css           # App styles
│   └── vite-env.d.ts
├── dist/
│   └── mcp-app.html          # Built output
├── PLAN.md
└── README.md
```

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "../..",
    "@modelcontextprotocol/sdk": "^1.22.0",
    "zod": "^3.25.0",
    "chart.js": "^4.4.0"
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

**Why vanilla JS**: Simpler for this use case; no React overhead needed for slider+chart sync.

---

## Historical & Benchmark Data Model

### Data Structures

```typescript
interface HistoricalMonth {
  month: string;                          // "2023-01", "2023-02", etc.
  allocations: Record<string, number>;    // categoryId -> percentage
}

interface BenchmarkPercentiles {
  p25: number;    // 25th percentile
  p50: number;    // Median
  p75: number;    // 75th percentile
}

interface StageBenchmark {
  stage: string;                                      // "Seed", "Series A", etc.
  categoryBenchmarks: Record<string, BenchmarkPercentiles>;  // categoryId -> percentiles
}

interface BudgetAnalytics {
  // Historical allocations (24 months)
  history: HistoricalMonth[];

  // Industry benchmarks by company stage
  benchmarks: StageBenchmark[];

  // Available stages for dropdown
  stages: string[];
  defaultStage: string;
}
```

### Generated Historical Data

24 months of realistic allocation trends with gradual drift:

```typescript
// Example: Marketing allocation over time
// Starts at 22%, drifts to 28% with small monthly variations
function generateHistory(categories: BudgetCategory[]): HistoricalMonth[] {
  const months: HistoricalMonth[] = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const allocations: Record<string, number> = {};
    for (const cat of categories) {
      // Start from default, add trend + noise
      const trend = (23 - i) * cat.trendPerMonth;  // e.g., +0.2% per month
      const noise = (Math.random() - 0.5) * 2;      // ±1% random
      allocations[cat.id] = Math.max(0, Math.min(100, cat.defaultPercent + trend + noise));
    }

    // Normalize to 100%
    const total = Object.values(allocations).reduce((a, b) => a + b, 0);
    for (const id of Object.keys(allocations)) {
      allocations[id] = (allocations[id] / total) * 100;
    }

    months.push({ month: monthStr, allocations });
  }

  return months;
}
```

### Benchmark Data

Industry benchmarks by company stage:

| Stage | Marketing | Engineering | Operations | Sales | R&D |
|-------|-----------|-------------|------------|-------|-----|
| **Seed** | 15-25% | 40-55% | 8-15% | 10-20% | 5-15% |
| **Series A** | 20-30% | 35-45% | 10-18% | 15-25% | 8-15% |
| **Series B** | 22-32% | 30-40% | 12-20% | 18-28% | 8-15% |
| **Growth** | 25-35% | 25-35% | 15-22% | 20-30% | 5-12% |

```typescript
const BENCHMARKS: StageBenchmark[] = [
  {
    stage: "Seed",
    categoryBenchmarks: {
      marketing:   { p25: 15, p50: 20, p75: 25 },
      engineering: { p25: 40, p50: 47, p75: 55 },
      operations:  { p25: 8,  p50: 12, p75: 15 },
      sales:       { p25: 10, p50: 15, p75: 20 },
      rd:          { p25: 5,  p50: 10, p75: 15 },
    },
  },
  // ... Series A, Series B, Growth
];
```

### Data Volume

- 24 months × 5 categories = **120 historical data points**
- 4 stages × 5 categories × 3 percentiles = **60 benchmark data points**
- Category configs + metadata = **~20 data points**
- **Total: ~200 data points** from server

---

## Server Implementation

### Tool: `get-budget-data`

Returns budget configuration, historical allocation data, and industry benchmarks.

```typescript
// server.ts

interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  defaultPercent: number;  // Default allocation percentage
  minPercent: number;      // Minimum allowed (0 for most)
  maxPercent: number;      // Maximum allowed (100 for most)
}

interface BudgetConfig {
  categories: BudgetCategory[];
  presetBudgets: number[];      // [50000, 100000, 250000, 500000]
  defaultBudget: number;        // 100000
  currency: string;             // "USD"
  currencySymbol: string;       // "$"
}

// Full response includes analytics
interface BudgetDataResponse {
  config: BudgetConfig;
  analytics: BudgetAnalytics;
}

// Default categories with business-realistic defaults
const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "marketing",    name: "Marketing",    color: "#3b82f6", defaultPercent: 25, minPercent: 0, maxPercent: 100 },
  { id: "engineering",  name: "Engineering",  color: "#10b981", defaultPercent: 35, minPercent: 0, maxPercent: 100 },
  { id: "operations",   name: "Operations",   color: "#f59e0b", defaultPercent: 15, minPercent: 0, maxPercent: 100 },
  { id: "sales",        name: "Sales",        color: "#ef4444", defaultPercent: 15, minPercent: 0, maxPercent: 100 },
  { id: "rd",           name: "R&D",          color: "#8b5cf6", defaultPercent: 10, minPercent: 0, maxPercent: 100 },
];

server.registerTool(
  "get-budget-data",
  {
    title: "Get Budget Data",
    description: "Returns budget configuration with historical allocations and industry benchmarks",
    inputSchema: {},
    outputSchema: {
      config: z.object({
        categories: z.array(BudgetCategorySchema),
        presetBudgets: z.array(z.number()),
        defaultBudget: z.number(),
        currency: z.string(),
        currencySymbol: z.string(),
      }),
      analytics: z.object({
        history: z.array(z.object({
          month: z.string(),
          allocations: z.record(z.string(), z.number()),
        })),
        benchmarks: z.array(z.object({
          stage: z.string(),
          categoryBenchmarks: z.record(z.string(), z.object({
            p25: z.number(),
            p50: z.number(),
            p75: z.number(),
          })),
        })),
        stages: z.array(z.string()),
        defaultStage: z.string(),
      }),
    },
    _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
  },
  async (): Promise<CallToolResult> => {
    const response: BudgetDataResponse = {
      config: {
        categories: DEFAULT_CATEGORIES,
        presetBudgets: [50000, 100000, 250000, 500000],
        defaultBudget: 100000,
        currency: "USD",
        currencySymbol: "$",
      },
      analytics: {
        history: generateHistory(DEFAULT_CATEGORIES),
        benchmarks: BENCHMARKS,
        stages: ["Seed", "Series A", "Series B", "Growth"],
        defaultStage: "Series A",
      },
    };
    return {
      content: [{ type: "text", text: formatBudgetSummary(response) }],
      structuredContent: response,
    };
  }
);
```

### Resource Registration

```typescript
const resourceUri = "ui://budget-allocator/mcp-app.html";

server.registerResource(
  resourceUri,
  resourceUri,
  { description: "Interactive Budget Allocator UI" },
  async (): Promise<ReadResourceResult> => {
    const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
    return {
      contents: [{ uri: resourceUri, mimeType: "text/html+mcp", text: html }],
    };
  }
);
```

---

## Client Implementation

### State Management

```typescript
interface AppState {
  config: BudgetConfig | null;
  analytics: BudgetAnalytics | null;
  totalBudget: number;
  allocations: Map<string, number>;  // categoryId -> percentage (0-100)
  selectedStage: string;              // Current benchmark comparison stage
  chart: Chart<"doughnut"> | null;
  sparklines: Map<string, HTMLCanvasElement>;  // categoryId -> sparkline canvas
}
```

### Initialization Flow

```typescript
// 1. Connect to host
const app = new App({ name: "Budget Allocator", version: "1.0.0" });
app.connect(new PostMessageTransport(window.parent));

// 2. Fetch full data on load
app.ontoolresult = (result) => {
  const data = result.structuredContent as BudgetDataResponse;
  initializeUI(data.config, data.analytics);
};

// 3. Also support manual refresh
async function loadData() {
  const result = await app.callServerTool({ name: "get-budget-data", arguments: {} });
  const data = result.structuredContent as BudgetDataResponse;
  initializeUI(data.config, data.analytics);
}

// 4. Initialize with analytics
function initializeUI(config: BudgetConfig, analytics: BudgetAnalytics): void {
  state.config = config;
  state.analytics = analytics;
  state.selectedStage = analytics.defaultStage;

  // Populate stage dropdown
  populateStageDropdown(analytics.stages, analytics.defaultStage);

  // Create slider rows with sparklines
  for (const category of config.categories) {
    const historyData = analytics.history.map(h => h.allocations[category.id]);
    createSliderRowWithSparkline(category, historyData);
  }

  // Initialize donut chart
  initChart(config.categories, state.allocations);

  // Update percentile badges based on selected stage
  updatePercentileBadges();
}
```

### Chart.js Configuration

```typescript
function initChart(categories: BudgetCategory[], allocations: Map<string, number>): Chart<"doughnut"> {
  const ctx = document.getElementById("budget-chart") as HTMLCanvasElement;

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: categories.map(c => c.name),
      datasets: [{
        data: categories.map(c => allocations.get(c.id) ?? c.defaultPercent),
        backgroundColor: categories.map(c => c.color),
        borderWidth: 2,
        borderColor: "var(--color-bg)",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "60%",  // Donut hole size
      plugins: {
        legend: { display: false },  // We use custom slider labels instead
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ctx.parsed;
              const amt = (pct / 100) * state.totalBudget;
              return `${ctx.label}: ${pct}% (${formatCurrency(amt)})`;
            },
          },
        },
      },
      onClick: (_event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          focusSlider(categories[index].id);
        }
      },
      onHover: (_event, elements) => {
        if (elements.length > 0) {
          highlightSlider(categories[elements[0].index].id);
        } else {
          clearSliderHighlight();
        }
      },
    },
  });
}
```

### Slider Generation with Sparkline

```typescript
function createSliderRowWithSparkline(
  category: BudgetCategory,
  historyData: number[],
  allocation: number
): HTMLElement {
  const row = document.createElement("div");
  row.className = "slider-row";
  row.dataset.categoryId = category.id;

  row.innerHTML = `
    <label class="slider-label" style="--category-color: ${category.color}">
      <span class="color-dot"></span>
      ${category.name}
    </label>
    <canvas class="sparkline" data-category-id="${category.id}" width="50" height="24"></canvas>
    <input
      type="range"
      class="slider"
      min="0"
      max="100"
      value="${allocation}"
      data-category-id="${category.id}"
    />
    <span class="slider-value">
      <span class="percent">${allocation}%</span>
      <span class="amount">${formatCurrency((allocation / 100) * state.totalBudget)}</span>
    </span>
    <span class="percentile-badge" data-category-id="${category.id}"></span>
  `;

  // Initialize sparkline
  const sparklineCanvas = row.querySelector(".sparkline") as HTMLCanvasElement;
  drawSparkline(sparklineCanvas, historyData, category.color);

  const slider = row.querySelector("input") as HTMLInputElement;
  slider.addEventListener("input", () => handleSliderChange(category.id, parseInt(slider.value)));

  return row;
}
```

### Sparkline Rendering

```typescript
function drawSparkline(canvas: HTMLCanvasElement, data: number[], color: string): void {
  const ctx = canvas.getContext("2d")!;
  const width = canvas.width;
  const height = canvas.height;
  const padding = 2;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) return;

  // Calculate min/max for scaling
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  // Draw area fill
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);

  data.forEach((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    ctx.lineTo(x, y);
  });

  ctx.lineTo(width - padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = `${color}20`;  // 12.5% opacity
  ctx.fill();

  // Draw line
  ctx.beginPath();
  data.forEach((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
```

### Percentile Badge Calculation

```typescript
function updatePercentileBadges(): void {
  if (!state.analytics || !state.config) return;

  const stageBenchmark = state.analytics.benchmarks.find(b => b.stage === state.selectedStage);
  if (!stageBenchmark) return;

  for (const category of state.config.categories) {
    const currentAllocation = state.allocations.get(category.id) ?? category.defaultPercent;
    const benchmarks = stageBenchmark.categoryBenchmarks[category.id];

    const badge = document.querySelector(`.percentile-badge[data-category-id="${category.id}"]`)!;
    const percentile = calculatePercentile(currentAllocation, benchmarks);

    badge.className = `percentile-badge ${getPercentileClass(percentile)}`;
    badge.textContent = formatPercentileBadge(percentile);
  }
}

function calculatePercentile(value: number, benchmarks: BenchmarkPercentiles): number {
  // Interpolate percentile based on value position relative to p25, p50, p75
  if (value <= benchmarks.p25) return 25 * (value / benchmarks.p25);
  if (value <= benchmarks.p50) return 25 + 25 * ((value - benchmarks.p25) / (benchmarks.p50 - benchmarks.p25));
  if (value <= benchmarks.p75) return 50 + 25 * ((value - benchmarks.p50) / (benchmarks.p75 - benchmarks.p50));
  return 75 + 25 * Math.min(1, (value - benchmarks.p75) / (benchmarks.p75 - benchmarks.p50));
}

function getPercentileClass(percentile: number): string {
  if (percentile >= 40 && percentile <= 60) return "percentile-normal";
  if (percentile > 60) return "percentile-high";
  return "percentile-low";
}

function formatPercentileBadge(percentile: number): string {
  const rounded = Math.round(percentile);
  if (percentile >= 40 && percentile <= 60) return `● ${rounded}th`;
  if (percentile > 60) return `▲ ${rounded}th`;
  return `▼ ${rounded}th`;
}
```

### Stage Selector

```typescript
function populateStageDropdown(stages: string[], defaultStage: string): void {
  const select = document.getElementById("stage-select") as HTMLSelectElement;

  stages.forEach(stage => {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage;
    option.selected = stage === defaultStage;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    state.selectedStage = select.value;
    updatePercentileBadges();
    updateComparisonSummary();
  });
}
```

### Allocation Update Logic

```typescript
function handleSliderChange(categoryId: string, newPercent: number): void {
  state.allocations.set(categoryId, newPercent);

  // Update UI
  updateSliderDisplay(categoryId, newPercent);
  updateChart();
  updateStatusBar();
}

function updateChart(): void {
  if (!state.chart || !state.config) return;

  const data = state.config.categories.map(c => state.allocations.get(c.id) ?? 0);
  state.chart.data.datasets[0].data = data;
  state.chart.update("none");  // "none" = no animation for real-time feel
}

function updateStatusBar(): void {
  const total = Array.from(state.allocations.values()).reduce((sum, v) => sum + v, 0);
  const allocated = (total / 100) * state.totalBudget;

  const statusEl = document.getElementById("status-bar")!;
  const isBalanced = Math.abs(total - 100) < 0.01;

  statusEl.innerHTML = `
    Allocated: ${formatCurrency(allocated)} / ${formatCurrency(state.totalBudget)}
    <span class="status-icon ${isBalanced ? "balanced" : "unbalanced"}">
      ${isBalanced ? "✓" : total > 100 ? "↑ Over" : "↓ Under"}
    </span>
  `;
  statusEl.className = isBalanced ? "status-balanced" : "status-warning";
}
```

### Budget Preset Selector

```typescript
function createBudgetSelector(presets: number[], defaultBudget: number): HTMLElement {
  const select = document.createElement("select");
  select.id = "budget-selector";
  select.className = "budget-select";

  presets.forEach(amount => {
    const option = document.createElement("option");
    option.value = amount.toString();
    option.textContent = formatCurrency(amount);
    option.selected = amount === defaultBudget;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    state.totalBudget = parseInt(select.value);
    updateAllSliderAmounts();
    updateStatusBar();
  });

  return select;
}
```

---

## Styling

### CSS Variables (Dark Mode Support)

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1f2937;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --slider-track: #e5e7eb;
  --slider-thumb: #3b82f6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
    --color-text-muted: #9ca3af;
    --color-border: #374151;
    --slider-track: #374151;
    --slider-thumb: #60a5fa;
  }
}
```

### Layout Structure

```css
.app-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-height: 600px;
  overflow: hidden;  /* No vertical scroll */
  padding: 16px;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.chart-container {
  flex: 0 0 280px;  /* Fixed height for chart */
  display: flex;
  justify-content: center;
  align-items: center;
}

.sliders-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;  /* Prevent overflow */
}

.status-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 6px;
  text-align: center;
  font-weight: 500;
}
```

### Slider Styling

```css
.slider-row {
  display: grid;
  grid-template-columns: 90px 50px 1fr 50px 60px;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  height: 36px;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--category-color);
  flex-shrink: 0;
}

.sparkline {
  width: 50px;
  height: 24px;
  border-radius: 4px;
  background: var(--color-border);
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--slider-track);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--slider-thumb);
  cursor: pointer;
  transition: transform 0.1s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.slider-value .percent {
  font-weight: 600;
}

.slider-value .amount {
  font-size: 10px;
  color: var(--color-text-muted);
  display: block;
}

/* Percentile badges */
.percentile-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
  white-space: nowrap;
}

.percentile-normal {
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.1);
}

.percentile-high {
  color: var(--color-info);
  background: rgba(59, 130, 246, 0.1);
}

.percentile-low {
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.1);
}
```

### Comparison Summary Bar

```css
.comparison-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.comparison-highlight {
  font-weight: 600;
  color: var(--color-text);
}

.stage-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 12px;
}
```

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Create directory structure
- [ ] Set up `package.json` with dependencies
- [ ] Configure `tsconfig.json` and `vite.config.ts`
- [ ] Create base HTML entry point

### Phase 2: Server
- [ ] Implement Express server with MCP endpoint
- [ ] Implement `generateHistory()` function for 24-month data
- [ ] Define `BENCHMARKS` constant with 4 company stages
- [ ] Register `get-budget-data` tool with full analytics
- [ ] Register UI resource
- [ ] Test server returns ~200 data points

### Phase 3: Client Core
- [ ] Set up App connection and event handlers
- [ ] Fetch and parse config + analytics on load
- [ ] Create state management with analytics data
- [ ] Populate stage dropdown from server data

### Phase 4: UI Components
- [ ] Implement donut chart with Chart.js
- [ ] Create slider row generator with sparkline canvas
- [ ] Implement `drawSparkline()` function
- [ ] Implement percentile badge calculation and rendering
- [ ] Implement budget selector dropdown
- [ ] Implement stage selector dropdown
- [ ] Create status bar with comparison summary

### Phase 5: Interactivity
- [ ] Wire slider → chart updates
- [ ] Wire slider → percentile badge updates
- [ ] Implement chart hover → slider highlight
- [ ] Implement chart click → slider focus
- [ ] Handle budget total changes
- [ ] Handle stage changes → update all percentile badges

### Phase 6: Polish
- [ ] Add dark mode CSS (including sparkline colors)
- [ ] Test 600×600 fit with all elements
- [ ] Verify sparklines render correctly at small size
- [ ] Add smooth transitions
- [ ] Write README.md

---

## Estimated Complexity

| Component | Lines of Code | Difficulty |
|-----------|---------------|------------|
| server.ts | ~150 | Low-Medium (history generation, benchmark data) |
| mcp-app.ts | ~350 | Medium (sparklines, percentile calc, stage switching) |
| mcp-app.css | ~200 | Low |
| **Total** | **~700** | **Medium** |

### Complexity Notes

- **Sparkline rendering**: Custom canvas drawing, but straightforward path operations
- **Percentile calculation**: Simple interpolation math
- **History generation**: Deterministic with seeded randomness for consistency
- **Benchmark data**: Static constants, no complex logic

---

## Technical Decisions

### Server-side historical data (architectural justification)
Historical allocation data **must** come from the server because:
- In a real app, this would be stored in a database
- Cannot be fabricated client-side without being contrived
- Represents actual past decisions — classic backend data

### Server-side benchmarks (architectural justification)
Industry benchmarks **must** come from the server because:
- Aggregated from industry surveys/databases
- Represents collective knowledge across many companies
- Would require periodic updates from authoritative sources

This is **architecturally honest** — a real budget planning tool would source both historical data and industry benchmarks from a backend.

### Canvas-based sparklines (not Chart.js)
Using raw canvas for sparklines because:
- Chart.js is overkill for 50×24px mini-charts
- Custom drawing gives precise control over tiny space
- Avoids additional Chart.js instances per category

### Percentile calculation approach
Using linear interpolation between p25/p50/p75:
- Simple, predictable behavior
- Easy to verify visually
- Sufficient accuracy for comparative display

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Sparklines too small to read | 50×24px minimum, high-contrast colors |
| Percentile badges overflow | Fixed width column, truncated text |
| Stage dropdown confusion | Clear label "Stage:" prefix |
| Historical data looks random | Seeded RNG for reproducible trends |
| Too many elements per row | Grid layout with precise column widths |
| Dark mode sparkline visibility | Use category colors that work in both themes |

---

## Future Enhancements (Out of Scope)

- Save/load allocation presets
- Export allocation as JSON/CSV
- Undo/redo support
- Animated transitions between presets
- Comparison mode (before/after)
- Sparkline hover tooltip showing historical value

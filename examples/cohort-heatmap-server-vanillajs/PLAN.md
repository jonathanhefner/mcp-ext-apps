# Cohort Retention Heatmap Server — Implementation Plan

## Overview

An interactive cohort retention analysis heatmap showing customer retention over time by signup month. Hover for details, click to drill down, with realistic generated retention data.

**Target viewport**: 600×600 pixels (no vertical scroll, horizontal scroll allowed for extended time periods)

---

## User Experience

### Layout (600×600)
```
┌────────────────────────────────────────────────────────────────┐
│  Cohort Retention Analysis       [Metric ▼] [Period ▼]         │  ← Header + controls
├────────────────────────────────────────────────────────────────┤
│        │ M0   M1   M2   M3   M4   M5   M6   M7   M8  →scroll   │  ← Period columns
├────────┼───────────────────────────────────────────────────────┤
│ Jan 24 │ ██   ██   ██   ▓▓   ▓▓   ░░   ░░   ░░   ░░           │  ← Cohort rows
│ Feb 24 │ ██   ██   ▓▓   ▓▓   ░░   ░░   ░░   ░░                │     Color = retention %
│ Mar 24 │ ██   ██   ▓▓   ▓▓   ░░   ░░   ░░                     │
│ Apr 24 │ ██   ▓▓   ▓▓   ░░   ░░   ░░                          │
│ May 24 │ ██   ▓▓   ▓▓   ░░   ░░                               │
│ Jun 24 │ ██   ▓▓   ░░   ░░                                    │
│ Jul 24 │ ██   ▓▓   ░░                                         │
│ Aug 24 │ ██   ▓▓                                               │
│ Sep 24 │ ██                                                    │
├────────┴───────────────────────────────────────────────────────┤
│  Legend: ██ 80-100%  ▓▓ 50-79%  ░░ 20-49%  ·· 0-19%           │
├────────────────────────────────────────────────────────────────┤
│  ┌─ Tooltip ──────────────────┐                                │
│  │ Feb 2024 Cohort, Month 3   │                                │
│  │ Retention: 67.2%           │                                │
│  │ Users: 1,847 / 2,750       │                                │
│  └────────────────────────────┘                                │
└────────────────────────────────────────────────────────────────┘
```

### Interactions

1. **Hover cell** → Show tooltip with cohort, period, retention %, absolute numbers
2. **Click cell** → Highlight entire row (cohort) and column (period)
3. **Metric dropdown** → Switch between: Retention %, Revenue Retention, Active Users
4. **Period dropdown** → Switch between: Monthly, Weekly
5. **Horizontal scroll** → View additional periods (natural timeline scroll)

### Data Visualization

- **Color scale**: Green (high retention) → Yellow → Red (low retention)
- **Cell values**: Optionally show percentage inside cells
- **Triangular shape**: Natural cohort pattern (newer cohorts have fewer data points)

---

## Technical Architecture

### Directory Structure
```
examples/cohort-heatmap-server/
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

**Note**: No Chart.js needed — heatmap is implemented with CSS Grid for better control and simpler code.

---

## Server Implementation

### Data Generation Algorithm

Realistic retention curves follow exponential decay with some noise:

```typescript
// Retention decay model
// retention(t) = baseRetention * e^(-decayRate * t) + floor + noise

interface RetentionParams {
  baseRetention: number;   // Starting retention after M0 (e.g., 0.85)
  decayRate: number;       // How fast it drops (e.g., 0.15)
  floor: number;           // Minimum retention floor (e.g., 0.10)
  noise: number;           // Random variation (e.g., 0.05)
}

function generateRetention(period: number, params: RetentionParams): number {
  if (period === 0) return 1.0;  // M0 is always 100%

  const { baseRetention, decayRate, floor, noise } = params;
  const base = baseRetention * Math.exp(-decayRate * (period - 1)) + floor;
  const variation = (Math.random() - 0.5) * 2 * noise;

  return Math.max(0, Math.min(1, base + variation));
}
```

### Tool: `get-cohort-data`

```typescript
interface CohortCell {
  cohortIndex: number;      // Row index (0 = oldest cohort)
  periodIndex: number;      // Column index (0 = M0)
  retention: number;        // 0.0 - 1.0
  usersRetained: number;    // Absolute count
  usersOriginal: number;    // Original cohort size
}

interface CohortRow {
  cohortId: string;         // "2024-01"
  cohortLabel: string;      // "Jan 2024"
  originalUsers: number;    // Starting cohort size
  cells: CohortCell[];      // Retention data per period
}

interface CohortData {
  cohorts: CohortRow[];
  periods: string[];        // ["M0", "M1", "M2", ...]
  periodLabels: string[];   // ["Month 0", "Month 1", ...]
  metric: string;           // "retention" | "revenue" | "active"
  periodType: string;       // "monthly" | "weekly"
  generatedAt: string;      // ISO timestamp
}

server.registerTool(
  "get-cohort-data",
  {
    title: "Get Cohort Retention Data",
    description: "Returns cohort retention heatmap data",
    inputSchema: {
      metric: z.enum(["retention", "revenue", "active"]).optional().default("retention"),
      periodType: z.enum(["monthly", "weekly"]).optional().default("monthly"),
      cohortCount: z.number().min(3).max(24).optional().default(12),
      maxPeriods: z.number().min(3).max(24).optional().default(12),
    },
    outputSchema: {
      cohorts: z.array(z.object({
        cohortId: z.string(),
        cohortLabel: z.string(),
        originalUsers: z.number(),
        cells: z.array(z.object({
          cohortIndex: z.number(),
          periodIndex: z.number(),
          retention: z.number(),
          usersRetained: z.number(),
          usersOriginal: z.number(),
        })),
      })),
      periods: z.array(z.string()),
      periodLabels: z.array(z.string()),
      metric: z.string(),
      periodType: z.string(),
      generatedAt: z.string(),
    },
    _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
  },
  async (args): Promise<CallToolResult> => {
    const { metric, periodType, cohortCount, maxPeriods } = args;
    const data = generateCohortData(metric, periodType, cohortCount, maxPeriods);

    return {
      content: [{ type: "text", text: formatCohortSummary(data) }],
      structuredContent: data,
    };
  }
);
```

### Data Generation Implementation

```typescript
function generateCohortData(
  metric: string,
  periodType: string,
  cohortCount: number,
  maxPeriods: number
): CohortData {
  const now = new Date();
  const cohorts: CohortRow[] = [];
  const periods: string[] = [];
  const periodLabels: string[] = [];

  // Generate period headers
  for (let i = 0; i < maxPeriods; i++) {
    periods.push(`M${i}`);
    periodLabels.push(i === 0 ? "Month 0" : `Month ${i}`);
  }

  // Retention parameters vary slightly by metric type
  const params: RetentionParams = {
    retention: { baseRetention: 0.75, decayRate: 0.12, floor: 0.08, noise: 0.04 },
    revenue:   { baseRetention: 0.70, decayRate: 0.10, floor: 0.15, noise: 0.06 },
    active:    { baseRetention: 0.60, decayRate: 0.18, floor: 0.05, noise: 0.05 },
  }[metric] ?? { baseRetention: 0.75, decayRate: 0.12, floor: 0.08, noise: 0.04 };

  // Generate cohorts (oldest first)
  for (let c = 0; c < cohortCount; c++) {
    const cohortDate = new Date(now);
    cohortDate.setMonth(cohortDate.getMonth() - (cohortCount - 1 - c));

    const cohortId = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;
    const cohortLabel = cohortDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    // Random cohort size: 1000-5000 users
    const originalUsers = Math.floor(1000 + Math.random() * 4000);

    // Number of periods this cohort has data for
    // (newer cohorts have fewer periods)
    const periodsAvailable = cohortCount - c;

    const cells: CohortCell[] = [];
    let previousRetention = 1.0;

    for (let p = 0; p < Math.min(periodsAvailable, maxPeriods); p++) {
      // Retention must decrease or stay same (with small exceptions for noise)
      let retention = generateRetention(p, params);
      retention = Math.min(retention, previousRetention + 0.02);  // Allow tiny increase for realism
      previousRetention = retention;

      cells.push({
        cohortIndex: c,
        periodIndex: p,
        retention,
        usersRetained: Math.round(originalUsers * retention),
        usersOriginal: originalUsers,
      });
    }

    cohorts.push({ cohortId, cohortLabel, originalUsers, cells });
  }

  return {
    cohorts,
    periods,
    periodLabels,
    metric,
    periodType,
    generatedAt: new Date().toISOString(),
  };
}

function formatCohortSummary(data: CohortData): string {
  const avgRetention = data.cohorts
    .flatMap(c => c.cells)
    .filter(cell => cell.periodIndex > 0)
    .reduce((sum, cell, _, arr) => sum + cell.retention / arr.length, 0);

  return `Cohort Analysis: ${data.cohorts.length} cohorts, ${data.periods.length} periods
Average retention: ${(avgRetention * 100).toFixed(1)}%
Metric: ${data.metric}, Period: ${data.periodType}`;
}
```

---

## Client Implementation

### State Management

```typescript
interface AppState {
  data: CohortData | null;
  selectedMetric: "retention" | "revenue" | "active";
  selectedPeriodType: "monthly" | "weekly";
  highlightedCohort: number | null;
  highlightedPeriod: number | null;
  tooltipData: TooltipData | null;
}

interface TooltipData {
  x: number;
  y: number;
  cohortLabel: string;
  periodLabel: string;
  retention: number;
  usersRetained: number;
  usersOriginal: number;
}
```

### Heatmap Rendering (CSS Grid)

```typescript
function renderHeatmap(data: CohortData): void {
  const container = document.getElementById("heatmap-container")!;
  container.innerHTML = "";

  // Create grid container
  const grid = document.createElement("div");
  grid.className = "heatmap-grid";
  grid.style.gridTemplateColumns = `120px repeat(${data.periods.length}, 48px)`;

  // Header row: empty corner + period labels
  const cornerCell = document.createElement("div");
  cornerCell.className = "heatmap-header corner";
  grid.appendChild(cornerCell);

  data.periods.forEach((period, i) => {
    const headerCell = document.createElement("div");
    headerCell.className = "heatmap-header period";
    headerCell.textContent = period;
    headerCell.dataset.periodIndex = i.toString();
    grid.appendChild(headerCell);
  });

  // Data rows
  data.cohorts.forEach((cohort, cohortIndex) => {
    // Row label
    const labelCell = document.createElement("div");
    labelCell.className = "heatmap-label";
    labelCell.innerHTML = `
      <span class="cohort-name">${cohort.cohortLabel}</span>
      <span class="cohort-size">${formatNumber(cohort.originalUsers)}</span>
    `;
    grid.appendChild(labelCell);

    // Data cells
    for (let p = 0; p < data.periods.length; p++) {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.dataset.cohortIndex = cohortIndex.toString();
      cell.dataset.periodIndex = p.toString();

      const cellData = cohort.cells.find(c => c.periodIndex === p);

      if (cellData) {
        const color = getRetentionColor(cellData.retention);
        cell.style.backgroundColor = color;
        cell.textContent = `${Math.round(cellData.retention * 100)}`;
        cell.addEventListener("mouseenter", (e) => showTooltip(e, cohort, cellData, data.periodLabels[p]));
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("click", () => selectCell(cohortIndex, p));
      } else {
        cell.className += " empty";
      }

      grid.appendChild(cell);
    }
  });

  container.appendChild(grid);
}
```

### Color Scale Function

```typescript
function getRetentionColor(retention: number): string {
  // Green (high) -> Yellow (medium) -> Red (low)
  // Using HSL for smooth interpolation

  // retention 1.0 -> hue 120 (green)
  // retention 0.5 -> hue 60 (yellow)
  // retention 0.0 -> hue 0 (red)

  const hue = retention * 120;  // 0-120 range
  const saturation = 70;
  const lightness = 45 + (1 - retention) * 15;  // Lighter for lower values

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Alternative: discrete color bands
function getRetentionColorDiscrete(retention: number): string {
  if (retention >= 0.8) return "var(--color-retention-high)";
  if (retention >= 0.5) return "var(--color-retention-medium)";
  if (retention >= 0.2) return "var(--color-retention-low)";
  return "var(--color-retention-critical)";
}
```

### Tooltip Implementation

```typescript
function showTooltip(event: MouseEvent, cohort: CohortRow, cell: CohortCell, periodLabel: string): void {
  const tooltip = document.getElementById("tooltip")!;

  tooltip.innerHTML = `
    <div class="tooltip-header">${cohort.cohortLabel} — ${periodLabel}</div>
    <div class="tooltip-row">
      <span class="tooltip-label">Retention:</span>
      <span class="tooltip-value">${(cell.retention * 100).toFixed(1)}%</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Users:</span>
      <span class="tooltip-value">${formatNumber(cell.usersRetained)} / ${formatNumber(cell.usersOriginal)}</span>
    </div>
  `;

  // Position tooltip near cursor
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const containerRect = document.getElementById("app-container")!.getBoundingClientRect();

  let left = rect.right + 8;
  let top = rect.top;

  // Keep tooltip within container
  if (left + 200 > containerRect.right) {
    left = rect.left - 208;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add("visible");
}

function hideTooltip(): void {
  document.getElementById("tooltip")!.classList.remove("visible");
}
```

### Row/Column Highlighting

```typescript
function selectCell(cohortIndex: number, periodIndex: number): void {
  // Clear previous highlights
  document.querySelectorAll(".heatmap-cell.highlighted, .heatmap-label.highlighted, .heatmap-header.highlighted")
    .forEach(el => el.classList.remove("highlighted"));

  // Highlight entire row
  document.querySelectorAll(`[data-cohort-index="${cohortIndex}"]`)
    .forEach(el => el.classList.add("highlighted"));

  // Highlight entire column
  document.querySelectorAll(`[data-period-index="${periodIndex}"]`)
    .forEach(el => el.classList.add("highlighted"));

  state.highlightedCohort = cohortIndex;
  state.highlightedPeriod = periodIndex;
}
```

### Dropdown Controls

```typescript
function createControls(): void {
  const controlsContainer = document.getElementById("controls")!;

  // Metric selector
  const metricSelect = document.createElement("select");
  metricSelect.id = "metric-select";
  metricSelect.innerHTML = `
    <option value="retention">Retention %</option>
    <option value="revenue">Revenue Retention</option>
    <option value="active">Active Users</option>
  `;
  metricSelect.addEventListener("change", () => {
    state.selectedMetric = metricSelect.value as typeof state.selectedMetric;
    fetchData();
  });

  // Period selector
  const periodSelect = document.createElement("select");
  periodSelect.id = "period-select";
  periodSelect.innerHTML = `
    <option value="monthly">Monthly</option>
    <option value="weekly">Weekly</option>
  `;
  periodSelect.addEventListener("change", () => {
    state.selectedPeriodType = periodSelect.value as typeof state.selectedPeriodType;
    fetchData();
  });

  controlsContainer.appendChild(createLabeledControl("Metric:", metricSelect));
  controlsContainer.appendChild(createLabeledControl("Period:", periodSelect));
}

async function fetchData(): Promise<void> {
  const result = await app.callServerTool({
    name: "get-cohort-data",
    arguments: {
      metric: state.selectedMetric,
      periodType: state.selectedPeriodType,
      cohortCount: 12,
      maxPeriods: 12,
    },
  });

  state.data = result.structuredContent as CohortData;
  renderHeatmap(state.data);
}
```

---

## Styling

### CSS Variables

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1f2937;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;

  /* Retention colors */
  --color-retention-high: #22c55e;      /* 80-100% */
  --color-retention-medium: #eab308;    /* 50-79% */
  --color-retention-low: #f97316;       /* 20-49% */
  --color-retention-critical: #ef4444;  /* 0-19% */

  --color-highlight: rgba(59, 130, 246, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
    --color-text-muted: #9ca3af;
    --color-border: #374151;
    --color-highlight: rgba(96, 165, 250, 0.25);
  }
}
```

### Layout

```css
.app-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-height: 600px;
  overflow: hidden;
  padding: 16px;
  gap: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.controls {
  display: flex;
  gap: 16px;
}

.heatmap-wrapper {
  flex: 1;
  overflow-x: auto;    /* Horizontal scroll for many periods */
  overflow-y: hidden;  /* No vertical scroll */
}

.heatmap-grid {
  display: grid;
  gap: 2px;
  width: max-content;  /* Allow horizontal expansion */
}

.legend {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 12px;
}
```

### Heatmap Cells

```css
.heatmap-cell {
  width: 48px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.heatmap-cell:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.heatmap-cell.empty {
  background-color: var(--color-border);
  cursor: default;
}

.heatmap-cell.highlighted {
  outline: 2px solid var(--color-text);
  outline-offset: 1px;
}

.heatmap-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-right: 8px;
}

.heatmap-label .cohort-name {
  font-weight: 600;
  font-size: 13px;
}

.heatmap-label .cohort-size {
  font-size: 11px;
  color: var(--color-text-muted);
}

.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}
```

### Tooltip

```css
.tooltip {
  position: fixed;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 100;
  min-width: 180px;
}

.tooltip.visible {
  opacity: 1;
}

.tooltip-header {
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 4px;
}

.tooltip-label {
  color: var(--color-text-muted);
}

.tooltip-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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
- [ ] Implement retention curve generator
- [ ] Create `get-cohort-data` tool
- [ ] Register UI resource
- [ ] Test data generation produces realistic curves

### Phase 3: Client Core
- [ ] Set up App connection
- [ ] Fetch data on load
- [ ] Implement state management

### Phase 4: Heatmap Rendering
- [ ] Create CSS Grid layout
- [ ] Implement color scale function
- [ ] Render cohort labels and period headers
- [ ] Render data cells with colors

### Phase 5: Interactivity
- [ ] Implement tooltip on hover
- [ ] Implement row/column highlighting on click
- [ ] Wire dropdown controls to data refresh
- [ ] Add horizontal scroll behavior

### Phase 6: Polish
- [ ] Add dark mode support
- [ ] Create color legend
- [ ] Test 600×600 fit
- [ ] Write README.md

---

## Estimated Complexity

| Component | Lines of Code | Difficulty |
|-----------|---------------|------------|
| server.ts | ~120 | Medium |
| mcp-app.ts | ~250 | Medium |
| mcp-app.css | ~180 | Low |
| **Total** | **~550** | **Medium** |

---

## Future Enhancements (Out of Scope)

- Export data as CSV
- Click cohort to see user list
- Comparison between time periods
- Trend lines overlay
- Custom date range selection
- Animation on data load

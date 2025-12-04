# Cohort Retention Heatmap Server — Implementation Plan

## Overview

An interactive cohort retention analysis heatmap showing customer retention over time by signup month. Hover for details, click to drill down, with realistic generated retention data.

**Framework**: React with `useApp` hook from `@modelcontextprotocol/ext-apps/react`

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
│   ├── mcp-app.tsx           # Main React app
│   ├── mcp-app.module.css    # CSS modules for app styles
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
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.2.1",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0"
  }
}
```

**Note**: No Chart.js needed — heatmap is implemented with CSS Grid for better control and simpler code. Uses React with the `useApp` hook from `@modelcontextprotocol/ext-apps/react`.

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
```

### mcp-app.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cohort Retention Heatmap</title>
  <link rel="stylesheet" href="/src/global.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/mcp-app.tsx"></script>
</body>
</html>
```

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

### React App Structure

```tsx
import type { App } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

// Entry point
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CohortHeatmapApp />
  </StrictMode>,
);
```

### State Management (React Hooks)

```tsx
interface TooltipData {
  x: number;
  y: number;
  cohortLabel: string;
  periodLabel: string;
  retention: number;
  usersRetained: number;
  usersOriginal: number;
}

function CohortHeatmapApp() {
  const { app, error } = useApp({
    appInfo: { name: "Cohort Heatmap", version: "1.0.0" },
    capabilities: {},
  });

  if (error) return <div className={styles.error}>ERROR: {error.message}</div>;
  if (!app) return <div className={styles.loading}>Connecting...</div>;

  return <CohortHeatmapInner app={app} />;
}

function CohortHeatmapInner({ app }: { app: App }) {
  const [data, setData] = useState<CohortData | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"retention" | "revenue" | "active">("retention");
  const [selectedPeriodType, setSelectedPeriodType] = useState<"monthly" | "weekly">("monthly");
  const [highlightedCohort, setHighlightedCohort] = useState<number | null>(null);
  const [highlightedPeriod, setHighlightedPeriod] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  // Fetch data when metric or period type changes
  useEffect(() => {
    fetchData();
  }, [selectedMetric, selectedPeriodType]);

  const fetchData = useCallback(async () => {
    const result = await app.callServerTool({
      name: "get-cohort-data",
      arguments: {
        metric: selectedMetric,
        periodType: selectedPeriodType,
        cohortCount: 12,
        maxPeriods: 12,
      },
    });
    setData(result.structuredContent as CohortData);
  }, [app, selectedMetric, selectedPeriodType]);

  const handleCellClick = useCallback((cohortIndex: number, periodIndex: number) => {
    setHighlightedCohort(cohortIndex);
    setHighlightedPeriod(periodIndex);
  }, []);

  return (
    <main className={styles.container}>
      <Header
        selectedMetric={selectedMetric}
        selectedPeriodType={selectedPeriodType}
        onMetricChange={setSelectedMetric}
        onPeriodTypeChange={setSelectedPeriodType}
      />
      {data && (
        <HeatmapGrid
          data={data}
          highlightedCohort={highlightedCohort}
          highlightedPeriod={highlightedPeriod}
          onCellClick={handleCellClick}
          onCellHover={setTooltipData}
        />
      )}
      <Legend />
      {tooltipData && <Tooltip {...tooltipData} />}
    </main>
  );
}
```

### Heatmap Component (CSS Grid)

```tsx
interface HeatmapGridProps {
  data: CohortData;
  highlightedCohort: number | null;
  highlightedPeriod: number | null;
  onCellClick: (cohortIndex: number, periodIndex: number) => void;
  onCellHover: (tooltip: TooltipData | null) => void;
}

function HeatmapGrid({ data, highlightedCohort, highlightedPeriod, onCellClick, onCellHover }: HeatmapGridProps) {
  const gridStyle = useMemo(() => ({
    gridTemplateColumns: `120px repeat(${data.periods.length}, 48px)`,
  }), [data.periods.length]);

  return (
    <div className={styles.heatmapWrapper}>
      <div className={styles.heatmapGrid} style={gridStyle}>
        {/* Header row: empty corner + period labels */}
        <div className={styles.headerCorner} />
        {data.periods.map((period, i) => (
          <div
            key={period}
            className={`${styles.headerPeriod} ${highlightedPeriod === i ? styles.highlighted : ""}`}
          >
            {period}
          </div>
        ))}

        {/* Data rows */}
        {data.cohorts.map((cohort, cohortIndex) => (
          <CohortRow
            key={cohort.cohortId}
            cohort={cohort}
            cohortIndex={cohortIndex}
            periodCount={data.periods.length}
            periodLabels={data.periodLabels}
            isHighlighted={highlightedCohort === cohortIndex}
            highlightedPeriod={highlightedPeriod}
            onCellClick={onCellClick}
            onCellHover={onCellHover}
          />
        ))}
      </div>
    </div>
  );
}

function CohortRow({ cohort, cohortIndex, periodCount, periodLabels, isHighlighted, highlightedPeriod, onCellClick, onCellHover }: CohortRowProps) {
  return (
    <>
      <div className={`${styles.label} ${isHighlighted ? styles.highlighted : ""}`}>
        <span className={styles.cohortName}>{cohort.cohortLabel}</span>
        <span className={styles.cohortSize}>{formatNumber(cohort.originalUsers)}</span>
      </div>
      {Array.from({ length: periodCount }, (_, p) => {
        const cellData = cohort.cells.find(c => c.periodIndex === p);
        const isCellHighlighted = isHighlighted || highlightedPeriod === p;

        if (!cellData) {
          return <div key={p} className={styles.cellEmpty} />;
        }

        return (
          <HeatmapCell
            key={p}
            cellData={cellData}
            cohort={cohort}
            periodLabel={periodLabels[p]}
            isHighlighted={isCellHighlighted}
            onClick={() => onCellClick(cohortIndex, p)}
            onHover={onCellHover}
          />
        );
      })}
    </>
  );
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

### HeatmapCell Component

```tsx
interface HeatmapCellProps {
  cellData: CohortCell;
  cohort: CohortRow;
  periodLabel: string;
  isHighlighted: boolean;
  onClick: () => void;
  onHover: (tooltip: TooltipData | null) => void;
}

function HeatmapCell({ cellData, cohort, periodLabel, isHighlighted, onClick, onHover }: HeatmapCellProps) {
  const backgroundColor = useMemo(() => getRetentionColor(cellData.retention), [cellData.retention]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHover({
      x: rect.right + 8,
      y: rect.top,
      cohortLabel: cohort.cohortLabel,
      periodLabel,
      retention: cellData.retention,
      usersRetained: cellData.usersRetained,
      usersOriginal: cellData.usersOriginal,
    });
  }, [cellData, cohort, periodLabel, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  return (
    <div
      className={`${styles.cell} ${isHighlighted ? styles.highlighted : ""}`}
      style={{ backgroundColor }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {Math.round(cellData.retention * 100)}
    </div>
  );
}
```

### Tooltip Component

```tsx
function Tooltip({ x, y, cohortLabel, periodLabel, retention, usersRetained, usersOriginal }: TooltipData) {
  // Adjust position to keep tooltip in viewport
  const style = useMemo(() => {
    let left = x;
    if (left + 200 > window.innerWidth) {
      left = x - 216;  // Flip to left side of cell
    }
    return { left, top: y };
  }, [x, y]);

  return (
    <div className={styles.tooltip} style={style}>
      <div className={styles.tooltipHeader}>{cohortLabel} — {periodLabel}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Retention:</span>
        <span className={styles.tooltipValue}>{(retention * 100).toFixed(1)}%</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Users:</span>
        <span className={styles.tooltipValue}>{formatNumber(usersRetained)} / {formatNumber(usersOriginal)}</span>
      </div>
    </div>
  );
}
```

### Header & Controls Component

```tsx
interface HeaderProps {
  selectedMetric: "retention" | "revenue" | "active";
  selectedPeriodType: "monthly" | "weekly";
  onMetricChange: (metric: "retention" | "revenue" | "active") => void;
  onPeriodTypeChange: (periodType: "monthly" | "weekly") => void;
}

function Header({ selectedMetric, selectedPeriodType, onMetricChange, onPeriodTypeChange }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Cohort Retention Analysis</h1>
      <div className={styles.controls}>
        <label className={styles.control}>
          <span>Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => onMetricChange(e.target.value as typeof selectedMetric)}
          >
            <option value="retention">Retention %</option>
            <option value="revenue">Revenue Retention</option>
            <option value="active">Active Users</option>
          </select>
        </label>
        <label className={styles.control}>
          <span>Period:</span>
          <select
            value={selectedPeriodType}
            onChange={(e) => onPeriodTypeChange(e.target.value as typeof selectedPeriodType)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>
    </header>
  );
}
```

### Legend Component

```tsx
function Legend() {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={styles.legendColor} style={{ backgroundColor: getRetentionColor(0.9) }} />
        80-100%
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendColor} style={{ backgroundColor: getRetentionColor(0.65) }} />
        50-79%
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendColor} style={{ backgroundColor: getRetentionColor(0.35) }} />
        20-49%
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendColor} style={{ backgroundColor: getRetentionColor(0.1) }} />
        0-19%
      </span>
    </div>
  );
}

// Utility function
function formatNumber(n: number): string {
  return n.toLocaleString();
}
```

---

## Styling

### global.css (Base Styles)

```css
* {
  box-sizing: border-box;
}

html, body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 1rem;
  margin: 0;
  padding: 0;
}
```

### mcp-app.module.css (CSS Modules)

```css
/* CSS Variables for theming */
.container {
  --color-bg: #ffffff;
  --color-text: #1f2937;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;

  /* Retention colors */
  --color-retention-high: #22c55e;
  --color-retention-medium: #eab308;
  --color-retention-low: #f97316;
  --color-retention-critical: #ef4444;

  --color-highlight: rgba(59, 130, 246, 0.2);
}

@media (prefers-color-scheme: dark) {
  .container {
    --color-bg: #111827;
    --color-text: #f9fafb;
    --color-text-muted: #9ca3af;
    --color-border: #374151;
    --color-highlight: rgba(96, 165, 250, 0.25);
  }
}

/* Layout */
.container {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-height: 600px;
  overflow: hidden;
  padding: 16px;
  gap: 12px;
  background: var(--color-bg);
  color: var(--color-text);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.controls {
  display: flex;
  gap: 16px;
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  select {
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: inherit;
  }
}

/* Heatmap Grid */
.heatmapWrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.heatmapGrid {
  display: grid;
  gap: 2px;
  width: max-content;
}

.headerCorner {
  width: 120px;
}

.headerPeriod {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  height: 24px;
}

.headerPeriod.highlighted {
  background: var(--color-highlight);
  border-radius: 4px;
}

/* Row Labels */
.label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-right: 8px;
  width: 120px;
}

.label.highlighted {
  background: var(--color-highlight);
  border-radius: 4px;
}

.cohortName {
  font-weight: 600;
  font-size: 13px;
}

.cohortSize {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* Data Cells */
.cell {
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

.cell:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.cell.highlighted {
  outline: 2px solid var(--color-text);
  outline-offset: 1px;
}

.cellEmpty {
  width: 48px;
  height: 36px;
  background-color: var(--color-border);
  border-radius: 4px;
  opacity: 0.3;
}

/* Legend */
.legend {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.legendItem {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legendColor {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

/* Tooltip */
.tooltip {
  position: fixed;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 100;
  min-width: 180px;
}

.tooltipHeader {
  font-weight: 600;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.tooltipRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 4px;
}

.tooltipLabel {
  color: var(--color-text-muted);
}

.tooltipValue {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Loading/Error states */
.loading, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
}

.error {
  color: var(--color-retention-critical);
}
```

---

## Implementation Checklist

### Phase 1: Setup
- [ ] Create directory structure
- [ ] Set up `package.json` with React dependencies
- [ ] Configure `tsconfig.json` and `vite.config.ts` (with React plugin)
- [ ] Create `mcp-app.html` entry point with root div

### Phase 2: Server
- [ ] Implement retention curve generator
- [ ] Create `get-cohort-data` tool
- [ ] Register UI resource
- [ ] Test data generation produces realistic curves

### Phase 3: React App Core
- [ ] Set up React entry point with `createRoot`
- [ ] Create `CohortHeatmapApp` component with `useApp` hook
- [ ] Create `CohortHeatmapInner` component with state hooks
- [ ] Implement data fetching with `useEffect`/`useCallback`

### Phase 4: React Components
- [ ] Create `HeatmapGrid` component (CSS Grid layout)
- [ ] Create `CohortRow` component
- [ ] Create `HeatmapCell` component with color scale
- [ ] Create `Header` component with dropdowns
- [ ] Create `Legend` component
- [ ] Create `Tooltip` component

### Phase 5: Interactivity
- [ ] Implement tooltip on hover via state
- [ ] Implement row/column highlighting via state
- [ ] Wire dropdown controls to re-fetch data
- [ ] Add horizontal scroll behavior

### Phase 6: Polish
- [ ] Add dark mode support via CSS variables
- [ ] Test 600×600 fit
- [ ] Write README.md

---

## Estimated Complexity

| Component | Lines of Code | Difficulty |
|-----------|---------------|------------|
| server.ts | ~120 | Medium |
| mcp-app.tsx | ~280 | Medium |
| mcp-app.module.css | ~200 | Low |
| global.css | ~15 | Low |
| **Total** | **~615** | **Medium** |

---

## Future Enhancements (Out of Scope)

- Export data as CSV
- Click cohort to see user list
- Comparison between time periods
- Trend lines overlay
- Custom date range selection
- Animation on data load

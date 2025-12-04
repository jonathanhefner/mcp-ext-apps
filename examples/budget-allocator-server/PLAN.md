# Budget Allocator Server — Implementation Plan

## Overview

An interactive budget allocation tool where users distribute a fixed budget across categories using sliders. Changes update a donut chart and summary metrics in real-time.

**Target viewport**: 600×600 pixels (no vertical scroll)

---

## User Experience

### Layout (600×600)
```
┌─────────────────────────────────────────┐
│  Budget Allocator          $100,000 ▼   │  ← Header + total budget dropdown
├─────────────────────────────────────────┤
│                                         │
│            ┌─────────┐                  │
│           /   DONUT   \                 │  ← 280px donut chart
│          │   CHART    │                 │     Center shows remaining/total
│           \           /                 │
│            └─────────┘                  │
│                                         │
├─────────────────────────────────────────┤
│  Marketing        ████████░░  $32,000   │  ← Slider rows
│  Engineering      ██████████  $40,000   │     Each: label + slider + amount
│  Operations       ████░░░░░░  $15,000   │
│  Sales            ███░░░░░░░  $13,000   │
│  R&D              ░░░░░░░░░░  $0        │
├─────────────────────────────────────────┤
│  Allocated: $100,000 / $100,000  ✓      │  ← Status bar
└─────────────────────────────────────────┘
```

### Interactions
1. **Drag sliders** to adjust category allocation
2. **Constraint**: Total must equal budget (sliders proportionally adjust others, or show warning)
3. **Donut segments** update in real-time as sliders move
4. **Hover donut segment** to highlight corresponding slider
5. **Click donut segment** to focus that slider
6. **Budget dropdown** to switch between preset totals ($50K, $100K, $250K, $500K)

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

## Server Implementation

### Tool: `get-budget-config`

Returns initial budget configuration with categories and default allocations.

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

// Default categories with business-realistic defaults
const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "marketing",    name: "Marketing",    color: "#3b82f6", defaultPercent: 25, minPercent: 0, maxPercent: 100 },
  { id: "engineering",  name: "Engineering",  color: "#10b981", defaultPercent: 35, minPercent: 0, maxPercent: 100 },
  { id: "operations",   name: "Operations",   color: "#f59e0b", defaultPercent: 15, minPercent: 0, maxPercent: 100 },
  { id: "sales",        name: "Sales",        color: "#ef4444", defaultPercent: 15, minPercent: 0, maxPercent: 100 },
  { id: "rd",           name: "R&D",          color: "#8b5cf6", defaultPercent: 10, minPercent: 0, maxPercent: 100 },
];

server.registerTool(
  "get-budget-config",
  {
    title: "Get Budget Configuration",
    description: "Returns budget categories and configuration for the allocator",
    inputSchema: {},
    outputSchema: {
      categories: z.array(z.object({
        id: z.string(),
        name: z.string(),
        color: z.string(),
        defaultPercent: z.number(),
        minPercent: z.number(),
        maxPercent: z.number(),
      })),
      presetBudgets: z.array(z.number()),
      defaultBudget: z.number(),
      currency: z.string(),
      currencySymbol: z.string(),
    },
    _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
  },
  async (): Promise<CallToolResult> => {
    const config: BudgetConfig = {
      categories: DEFAULT_CATEGORIES,
      presetBudgets: [50000, 100000, 250000, 500000],
      defaultBudget: 100000,
      currency: "USD",
      currencySymbol: "$",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
      structuredContent: config,
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
  totalBudget: number;
  allocations: Map<string, number>;  // categoryId -> percentage (0-100)
  chart: Chart<"doughnut"> | null;
}
```

### Initialization Flow

```typescript
// 1. Connect to host
const app = new App({ name: "Budget Allocator", version: "1.0.0" });
app.connect(new PostMessageTransport(window.parent));

// 2. Fetch config on load
app.ontoolresult = (result) => {
  const config = result.structuredContent as BudgetConfig;
  initializeUI(config);
};

// 3. Also support manual refresh
async function loadConfig() {
  const result = await app.callServerTool({ name: "get-budget-config", arguments: {} });
  initializeUI(result.structuredContent as BudgetConfig);
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

### Slider Generation

```typescript
function createSliderRow(category: BudgetCategory, allocation: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "slider-row";
  row.dataset.categoryId = category.id;

  row.innerHTML = `
    <label class="slider-label" style="--category-color: ${category.color}">
      <span class="color-dot"></span>
      ${category.name}
    </label>
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
  `;

  const slider = row.querySelector("input") as HTMLInputElement;
  slider.addEventListener("input", () => handleSliderChange(category.id, parseInt(slider.value)));

  return row;
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
  grid-template-columns: 120px 1fr 100px;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--category-color);
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--slider-track);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--slider-thumb);
  cursor: pointer;
  transition: transform 0.1s;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.slider-value .percent {
  font-weight: 600;
}

.slider-value .amount {
  font-size: 12px;
  color: var(--color-text-muted);
  display: block;
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
- [ ] Register `get-budget-config` tool
- [ ] Register UI resource
- [ ] Test server responds correctly

### Phase 3: Client Core
- [ ] Set up App connection and event handlers
- [ ] Fetch and parse config on load
- [ ] Create state management

### Phase 4: UI Components
- [ ] Implement donut chart with Chart.js
- [ ] Create slider row generator
- [ ] Implement budget selector dropdown
- [ ] Create status bar

### Phase 5: Interactivity
- [ ] Wire slider → chart updates
- [ ] Implement chart hover → slider highlight
- [ ] Implement chart click → slider focus
- [ ] Handle budget total changes

### Phase 6: Polish
- [ ] Add dark mode CSS
- [ ] Test 600×600 fit
- [ ] Add smooth transitions
- [ ] Write README.md

---

## Estimated Complexity

| Component | Lines of Code | Difficulty |
|-----------|---------------|------------|
| server.ts | ~80 | Low |
| mcp-app.ts | ~200 | Medium |
| mcp-app.css | ~150 | Low |
| **Total** | **~430** | **Low-Medium** |

---

## Future Enhancements (Out of Scope)

- Save/load allocation presets
- Export allocation as JSON/CSV
- Undo/redo support
- Animated transitions between presets
- Comparison mode (before/after)

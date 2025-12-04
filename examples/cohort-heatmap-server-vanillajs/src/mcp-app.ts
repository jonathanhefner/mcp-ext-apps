/**
 * @file Cohort Retention Heatmap App - displays cohort retention data with interactive heatmap
 */
import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import "./global.css";
import "./mcp-app.css";

const log = {
  info: console.log.bind(console, "[APP]"),
  error: console.error.bind(console, "[APP]"),
};

// Types matching server response
interface CohortCell {
  cohortIndex: number;
  periodIndex: number;
  retention: number;
  usersRetained: number;
  usersOriginal: number;
}

interface CohortRow {
  cohortId: string;
  cohortLabel: string;
  originalUsers: number;
  cells: CohortCell[];
}

interface CohortData {
  cohorts: CohortRow[];
  periods: string[];
  periodLabels: string[];
  metric: string;
  periodType: string;
  generatedAt: string;
}

// App state
interface AppState {
  data: CohortData | null;
  selectedMetric: "retention" | "revenue" | "active";
  selectedPeriodType: "monthly" | "weekly";
  highlightedCohort: number | null;
  highlightedPeriod: number | null;
}

const state: AppState = {
  data: null,
  selectedMetric: "retention",
  selectedPeriodType: "monthly",
  highlightedCohort: null,
  highlightedPeriod: null,
};

// DOM references
const controlsContainer = document.getElementById("controls")!;
const heatmapContainer = document.getElementById("heatmap-container")!;
const tooltip = document.getElementById("tooltip")!;
const appContainer = document.getElementById("app-container")!;

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

// Get color based on retention percentage using HSL interpolation
function getRetentionColor(retention: number): string {
  // retention 1.0 -> hue 120 (green)
  // retention 0.5 -> hue 60 (yellow)
  // retention 0.0 -> hue 0 (red)
  const hue = retention * 120;
  const saturation = 70;
  const lightness = 45 + (1 - retention) * 15;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Render the heatmap grid
function renderHeatmap(data: CohortData): void {
  heatmapContainer.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "heatmap-grid";
  grid.style.gridTemplateColumns = `140px repeat(${data.periods.length}, 48px)`;

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
    labelCell.dataset.cohortIndex = cohortIndex.toString();
    labelCell.innerHTML = `
      <span class="cohort-name">${cohort.cohortLabel}</span>
      <span class="cohort-size">${formatNumber(cohort.originalUsers)} users</span>
    `;
    grid.appendChild(labelCell);

    // Data cells
    for (let p = 0; p < data.periods.length; p++) {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.dataset.cohortIndex = cohortIndex.toString();
      cell.dataset.periodIndex = p.toString();

      const cellData = cohort.cells.find((c) => c.periodIndex === p);

      if (cellData) {
        const color = getRetentionColor(cellData.retention);
        cell.style.backgroundColor = color;
        cell.textContent = `${Math.round(cellData.retention * 100)}`;
        cell.addEventListener("mouseenter", (e) =>
          showTooltip(e, cohort, cellData, data.periodLabels[p]),
        );
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("click", () => selectCell(cohortIndex, p));
      } else {
        cell.classList.add("empty");
      }

      grid.appendChild(cell);
    }
  });

  heatmapContainer.appendChild(grid);
}

// Show tooltip on hover
function showTooltip(
  event: MouseEvent,
  cohort: CohortRow,
  cell: CohortCell,
  periodLabel: string,
): void {
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
  const containerRect = appContainer.getBoundingClientRect();

  let left = rect.right + 8;
  let top = rect.top;

  // Keep tooltip within container
  if (left + 200 > containerRect.right) {
    left = rect.left - 208;
  }
  if (top + 100 > containerRect.bottom) {
    top = containerRect.bottom - 100;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add("visible");
}

// Hide tooltip
function hideTooltip(): void {
  tooltip.classList.remove("visible");
}

// Select cell and highlight row/column
function selectCell(cohortIndex: number, periodIndex: number): void {
  // Clear previous highlights
  document
    .querySelectorAll(
      ".heatmap-cell.highlighted, .heatmap-label.highlighted, .heatmap-header.highlighted",
    )
    .forEach((el) => el.classList.remove("highlighted"));

  // Toggle selection if clicking same cell
  if (
    state.highlightedCohort === cohortIndex &&
    state.highlightedPeriod === periodIndex
  ) {
    state.highlightedCohort = null;
    state.highlightedPeriod = null;
    return;
  }

  // Highlight entire row
  document
    .querySelectorAll(`[data-cohort-index="${cohortIndex}"]`)
    .forEach((el) => el.classList.add("highlighted"));

  // Highlight entire column
  document
    .querySelectorAll(`[data-period-index="${periodIndex}"]`)
    .forEach((el) => el.classList.add("highlighted"));

  state.highlightedCohort = cohortIndex;
  state.highlightedPeriod = periodIndex;
}

// Create labeled control element
function createLabeledControl(label: string, control: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "control-group";

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.className = "control-label";

  wrapper.appendChild(labelEl);
  wrapper.appendChild(control);
  return wrapper;
}

// Create dropdown controls
function createControls(): void {
  // Metric selector
  const metricSelect = document.createElement("select");
  metricSelect.id = "metric-select";
  metricSelect.className = "control-select";
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
  periodSelect.className = "control-select";
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

// Create app instance
const app = new App({ name: "Cohort Heatmap", version: "1.0.0" });

// Fetch cohort data from server
async function fetchData(): Promise<void> {
  try {
    heatmapContainer.innerHTML = '<div class="loading">Loading cohort data...</div>';

    const result = await app.callServerTool({
      name: "get-cohort-data",
      arguments: {
        metric: state.selectedMetric,
        periodType: state.selectedPeriodType,
        cohortCount: 12,
        maxPeriods: 12,
      },
    });

    state.data = result.structuredContent as unknown as CohortData;
    log.info("Received cohort data:", state.data);

    // Clear highlights when data changes
    state.highlightedCohort = null;
    state.highlightedPeriod = null;

    renderHeatmap(state.data);
  } catch (error) {
    log.error("Failed to fetch cohort data:", error);
    heatmapContainer.innerHTML =
      '<div class="error">Failed to load cohort data. Please try again.</div>';
  }
}

// Initialize app
function init(): void {
  createControls();

  // Register handlers
  app.onerror = log.error;

  // Handle initial tool result if provided by host
  app.ontoolresult = (result) => {
    log.info("Received initial tool result:", result);
    state.data = result.structuredContent as unknown as CohortData;
    renderHeatmap(state.data);
  };

  // Connect to host
  app.connect(new PostMessageTransport(window.parent));

  // Fetch data after short delay
  setTimeout(fetchData, 300);
}

init();

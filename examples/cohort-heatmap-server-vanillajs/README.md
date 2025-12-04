# Example: Cohort Retention Heatmap

A demo MCP App that displays an interactive cohort retention analysis heatmap with hover tooltips and click-to-highlight functionality.

## Features

- **Cohort Heatmap**: CSS Grid-based visualization showing retention over time by signup cohort
- **Color-Coded Cells**: Green (high retention) to red (low retention) color scale
- **Interactive Tooltips**: Hover any cell to see detailed retention stats
- **Row/Column Highlighting**: Click a cell to highlight the entire cohort row and period column
- **Metric Switching**: Toggle between Retention %, Revenue Retention, and Active Users
- **Period Granularity**: Switch between Monthly and Weekly views
- **Theme Support**: Adapts to light/dark mode preferences

## Running

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build and start the server:

   ```bash
   npm start
   ```

   The server will listen on `http://localhost:3001/mcp`.

3. View using the [`basic-host`](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host) example or another MCP Apps-compatible host.

## Architecture

### Server (`server.ts`)

Exposes a single `get-cohort-data` tool that generates realistic retention data:

- Uses exponential decay model with noise for realistic retention curves
- Supports three metrics: `retention`, `revenue`, `active`
- Supports two period types: `monthly`, `weekly`
- Configurable cohort count and period count (3-24)

The tool is linked to a UI resource via `_meta[RESOURCE_URI_META_KEY]`.

### App (`src/mcp-app.ts`)

- Uses CSS Grid for the heatmap layout (no Chart.js dependency)
- HSL color interpolation for smooth retention-to-color mapping
- Fetches data on load and when filters change
- Manages highlighting state for selected row/column
- Responsive tooltip positioning

### Data Model

Each cohort contains:
- `cohortId`: Identifier (e.g., "2024-01")
- `cohortLabel`: Display name (e.g., "Jan 2024")
- `originalUsers`: Starting cohort size
- `cells`: Array of period data with retention percentages

The heatmap naturally forms a triangular shape as newer cohorts have fewer data points.

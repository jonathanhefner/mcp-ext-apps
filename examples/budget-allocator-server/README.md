# Budget Allocator Server

An interactive budget allocation tool demonstrating real-time data visualization with MCP Apps.

## Features

- **Interactive sliders** - Adjust budget allocation across 5 categories
- **Donut chart** - Real-time visualization of allocation distribution
- **Sparkline trends** - 24-month historical allocation data per category
- **Percentile badges** - Compare your allocation vs. industry benchmarks
- **Stage selector** - Switch between Seed, Series A, Series B, and Growth benchmarks
- **Budget presets** - Quick selection of $50K, $100K, $250K, or $500K totals

## Why Server Data?

This example demonstrates legitimate server-side data that **cannot** be computed client-side:

1. **Historical data** (~120 data points) - 24 months of allocation history that would come from a database in a real application
2. **Industry benchmarks** (~60 data points) - Aggregated percentile data by company stage

Total: ~200 data points from server, showcasing meaningful server→client data flow.

## Running

```bash
# Install dependencies
npm install

# Build UI and start server
npm start

# Or for development with hot reload
npm run dev
```

The server will be available at `http://localhost:3001/mcp`.

## Architecture

```
budget-allocator-server/
├── server.ts          # MCP server with data generation
├── mcp-app.html       # HTML entry point
└── src/
    ├── mcp-app.ts     # Client app (vanilla JS + Chart.js)
    ├── mcp-app.css    # App styles
    └── global.css     # Base styles
```

## Data Model

### Categories
- Marketing, Engineering, Operations, Sales, R&D
- Each with default allocation, color, and historical trend

### Historical Data
- 24 months of allocation percentages per category
- Generated with seeded randomness for reproducibility
- Includes realistic drift trends

### Benchmarks
- Four company stages: Seed, Series A, Series B, Growth
- Three percentiles per category: p25, p50, p75
- Used to compute percentile ranking of current allocation

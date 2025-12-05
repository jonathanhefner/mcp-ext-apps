# System Monitor Server Example

A marketing demo MCP App that displays real-time OS metrics with a stacked area chart and gauges.

**Target size**: ~600×600 pixels

## File Structure

```
examples/system-monitor-server/
├── server.ts           # Express + MCP server with system stats tool
├── mcp-app.html        # HTML entry point
├── src/
│   ├── mcp-app.ts      # App logic with polling and Chart.js
│   ├── mcp-app.css     # Styles with theme support
│   └── global.css      # Base styles (copy from basic-server-vanillajs)
├── package.json        # + chart.js dependency
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Server Implementation

### Single Combined Tool: `get-system-stats`

Returns all metrics in one call to minimize polling overhead:

```typescript
{
  cpu: {
    cores: Array<{ usagePercent: number }>,  // Per-core usage for stacked chart
    model: string,
    count: number
  },
  memory: { usedBytes, totalBytes, usedPercent, freeBytes },
  system: { hostname, platform, arch, uptime, uptimeFormatted },
  timestamp: string
}
```

### CPU Usage Calculation

Requires delta between two samples. Server stores previous per-core snapshots:

- First call returns 0 for all cores (acceptable - accurate by second poll)
- Subsequent calls compute per-core usage from idle/total time diff using `os.cpus()`

### Resource Registration

Single resource `ui://system-monitor/mcp-app.html` linked via `_meta[RESOURCE_URI_META_KEY]`

## UI Implementation

### Layout (~600×600px)

```
┌─────────────────────────────────────────┐
│  System Monitor    [Start] ● 12:34:56   │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ CPU Usage (stacked area chart)    │  │
│  │                                   │  │
│  │  ███▄                      ▄██    │  │
│  │ █████▄▄              ▄▄▄██████    │  │
│  │████████████▄▄▄▄▄▄████████████    │  │
│  │ 0%                         800%   │  │
│  └───────────────────────────────────┘  │
│  Legend: [Core 0] [Core 1] ... [Core 7] │
├─────────────────────────────────────────┤
│  Memory  [████████████░░░░░] 58%        │
│          4.2 GB / 16 GB                 │
├─────────────────────────────────────────┤
│  Hostname: my-server                    │
│  Platform: Linux x64                    │
│  Uptime: 5d 12h 30m                     │
└─────────────────────────────────────────┘
```

### CPU: Stacked Area Chart (Chart.js)

- One dataset per CPU core, each a different color
- Y-axis: 0 to (numCores × 100%) - e.g., 0-800% for 8 cores
- X-axis: Time (sliding window, ~30 data points = 1 minute at 2s intervals)
- Stacked areas show each core's individual contribution
- Smooth animations on update

### Memory: Horizontal Bar Gauge

- Simple progress bar with percentage label
- Shows "used / total" below (e.g., "4.2 GB / 16 GB")
- Color threshold: green (<60%), yellow (60-80%), red (>80%)

### Polling Mechanism

```typescript
const HISTORY_LENGTH = 30; // ~1 minute at 2s intervals
const cpuHistory: number[][] = []; // [timestamp][coreIndex] = usage%

async function fetchStats() {
  const result = await app.callServerTool({
    name: "get-system-stats",
    arguments: {},
  });
  const stats = result.structuredContent;

  // Add to history, trim to window size
  cpuHistory.push(stats.cpu.cores.map((c) => c.usagePercent));
  if (cpuHistory.length > HISTORY_LENGTH) cpuHistory.shift();

  updateChart(cpuHistory);
  updateMemoryBar(stats.memory);
  updateSystemInfo(stats.system);
}
```

### Theme Support

CSS variables with `@media (prefers-color-scheme: dark)`:

- `--color-bg`, `--color-text`, `--color-gauge-bg`
- `--color-success` (green), `--color-warning` (yellow), `--color-danger` (red)
- Chart.js colors will also adapt to theme

## Implementation Steps

1. **Project setup**
   - Create `examples/system-monitor-server/` directory
   - Copy `tsconfig.json`, `vite.config.ts`, `global.css` from basic-server-vanillajs
   - Create `package.json` with `chart.js` dependency added

2. **Server implementation** (`server.ts`)
   - Per-core CPU usage calculation with stored snapshots
   - Memory stats via `os.totalmem()` / `os.freemem()`
   - System info via `os.hostname()`, `os.platform()`, `os.uptime()`, etc.
   - Register `get-system-stats` tool with resource link

3. **HTML structure** (`mcp-app.html`)
   - Header with title, start/stop button, status indicator
   - Canvas element for Chart.js
   - Memory bar gauge section
   - System info section

4. **Styling** (`mcp-app.css`)
   - Theme variables (light/dark)
   - Memory bar gauge styles with color thresholds
   - Layout for ~600×600px

5. **App logic** (`mcp-app.ts`)
   - Chart.js stacked area chart initialization
   - CPU history array management (sliding window)
   - Polling with start/stop toggle
   - UI update functions

6. **Polish**
   - Auto-start polling on connect
   - Error handling with status display
   - README.md

## Reference Files

- [examples/basic-server-vanillajs/server.ts](../basic-server-vanillajs/server.ts) - Server pattern
- [examples/basic-server-vanillajs/src/mcp-app.ts](../basic-server-vanillajs/src/mcp-app.ts) - App SDK usage
- [examples/basic-server-vanillajs/package.json](../basic-server-vanillajs/package.json) - Dependencies

## Dependencies

- **chart.js** - Stacked area chart (~60KB)
- Node.js `os` module (built-in) - System metrics

## Notes

- First CPU poll returns 0% (no baseline yet) - accurate by second poll
- Auto-start polling on connect for better demo experience
- Fully cross-platform (no platform-specific shell commands)

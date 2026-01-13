---
name: Migrate from OpenAI App
description: This skill should be used when the user asks to "migrate from OpenAI Apps SDK", "convert OpenAI App to MCP", "port from window.openai", "migrate from skybridge", "convert openai/outputTemplate", or needs guidance on converting OpenAI Apps SDK applications to MCP Apps SDK. Provides step-by-step migration guidance with API mapping tables.
---

# Migrate OpenAI App to MCP

Migrate existing OpenAI Apps SDK applications to the MCP Apps SDK (`@modelcontextprotocol/ext-apps`). The MCP Apps SDK provides a standardized, open protocol for interactive UIs in conversational clients, with automatic environment detection for both OpenAI and MCP hosts.

## Getting Reference Code

Clone the SDK repository for complete migration documentation and working examples:

```bash
git clone --branch "v$(npm view @modelcontextprotocol/ext-apps version)" --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
```

### Migration Documentation

Read the complete migration reference with exhaustive mapping tables:
- `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` - Full server-side and client-side mappings

### Framework Templates

Adapt from `/tmp/mcp-ext-apps/examples/basic-server-{framework}/`:

| Template | Key Files |
|----------|-----------|
| `basic-server-vanillajs/` | `server.ts`, `src/mcp-app.ts`, `mcp-app.html` |
| `basic-server-react/` | `server.ts`, `src/mcp-app.tsx` (uses `useApp` hook) |
| `basic-server-vue/` | `server.ts`, `src/App.vue` |
| `basic-server-svelte/` | `server.ts`, `src/App.svelte` |
| `basic-server-preact/` | `server.ts`, `src/mcp-app.tsx` |
| `basic-server-solid/` | `server.ts`, `src/mcp-app.tsx` |

### API Reference (Source Files)

Read JSDoc documentation directly from `/tmp/mcp-ext-apps/src/`:

| File | Contents |
|------|----------|
| `src/app.ts` | `App` class, handlers, lifecycle |
| `src/server/index.ts` | `registerAppTool`, `registerAppResource` |
| `src/spec.types.ts` | Type definitions |
| `src/react/useApp.tsx` | `useApp` hook for React apps |

## Server-Side Migration

### 1. Update Imports

```typescript
// Before (OpenAI)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// After (MCP Apps) - add helper imports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
```

### 2. Migrate Tool Metadata

| OpenAI | MCP Apps | Notes |
|--------|----------|-------|
| `_meta["openai/outputTemplate"]` | `_meta.ui.resourceUri` | URI of UI resource |
| `_meta["openai/widgetAccessible"]: true` | `_meta.ui.visibility: ["app", "model"]` | Array format |
| `_meta["openai/visibility"]: "public"` | Include `"model"` in visibility array | |
| `_meta["openai/visibility"]: "private"` | Exclude `"model"` from visibility array | |

```typescript
// Before (OpenAI)
server.registerTool("my-tool", {
  _meta: {
    "openai/outputTemplate": "ui://widget/app.html",
    "openai/widgetAccessible": true,
  },
  // ...
}, handler);

// After (MCP Apps)
registerAppTool(server, "my-tool", {
  _meta: { ui: { resourceUri: "ui://widget/app.html" } },
  // ...
}, handler);
```

### 3. Migrate Resource Registration

```typescript
// Before (OpenAI)
server.registerResource(
  "Widget",
  "ui://widget/app.html",
  { mimeType: "text/html+skybridge" },
  async () => ({
    contents: [{
      uri: "ui://widget/app.html",
      mimeType: "text/html+skybridge",
      text: html,
    }],
  }),
);

// After (MCP Apps)
registerAppResource(
  server,
  "Widget",
  "ui://widget/app.html",
  { description: "Widget UI" },
  async () => ({
    contents: [{
      uri: "ui://widget/app.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: html,
    }],
  }),
);
```

### 4. Migrate CSP Properties

CSP property names change from snake_case to camelCase:

| OpenAI | MCP Apps |
|--------|----------|
| `connect_domains` | `connectDomains` |
| `resource_domains` | `resourceDomains` |

## Client-Side Migration

### 1. Replace Global with App Instance

```typescript
// Before (OpenAI)
applyTheme(window.openai.theme);
console.log("Args:", window.openai.toolInput);
console.log("Result:", window.openai.toolOutput);

// After (MCP Apps)
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "MyApp", version: "1.0.0" });

// Register handlers BEFORE connect
app.ontoolinput = (params) => {
  console.log("Args:", params.arguments);
};

app.ontoolresult = (params) => {
  console.log("Result:", params.structuredContent);
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyTheme(ctx.theme);
};

// Connect (auto-detects OpenAI vs MCP environment)
await app.connect();

// Access initial context
applyTheme(app.getHostContext()?.theme);
```

### 2. Migrate API Calls

| OpenAI | MCP Apps |
|--------|----------|
| `await window.openai.callTool(name, args)` | `await app.callServerTool({ name, arguments: args })` |
| `await window.openai.sendFollowUpMessage({ prompt })` | `await app.sendMessage({ role: "user", content: [{ type: "text", text: prompt }] })` |
| `await window.openai.openExternal({ href })` | `await app.openLink({ url: href })` |
| `await window.openai.requestDisplayMode({ mode })` | `await app.requestDisplayMode({ mode })` |
| `window.openai.notifyIntrinsicHeight(height)` | `app.sendSizeChanged({ width, height })` or `autoResize: true` |

### 3. Migrate Host Context Properties

| OpenAI | MCP Apps |
|--------|----------|
| `window.openai.theme` | `app.getHostContext()?.theme` |
| `window.openai.locale` | `app.getHostContext()?.locale` |
| `window.openai.displayMode` | `app.getHostContext()?.displayMode` |
| `window.openai.maxHeight` | `app.getHostContext()?.viewport?.maxHeight` |
| `window.openai.safeArea` | `app.getHostContext()?.safeAreaInsets` |
| `window.openai.userAgent` | `app.getHostContext()?.userAgent` |

### 4. React Migration

```typescript
// Before (OpenAI) - manual global access
const theme = window.openai.theme;
const toolInput = window.openai.toolInput;

// After (MCP Apps) - hooks
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";

function MyApp() {
  const { app, toolInput, toolResult, hostContext } = useApp({
    appInfo: { name: "MyApp", version: "1.0.0" },
    capabilities: {},
  });

  useHostStyles(app); // Handles theme, styles, fonts

  // Use toolInput.arguments, toolResult.structuredContent, hostContext.theme
}
```

## Common Migration Mistakes

1. **Handlers after connect()** - Register ALL handlers BEFORE calling `app.connect()`. Events may fire immediately after connection.

2. **Wrong MIME type** - Use `RESOURCE_MIME_TYPE` constant or `text/html;profile=mcp-app` (not `text/html+skybridge`).

3. **Parameter name changes** - `href` -> `url` for `openLink()`, `prompt` -> structured content for `sendMessage()`.

4. **Sync vs async mindset** - OpenAI pre-populates properties; MCP uses async callbacks and `getHostContext()`.

5. **Missing structuredContent** - MCP uses `params.structuredContent` in `ontoolresult`, not `toolOutput` directly.

6. **Visibility format** - Use string arrays `["app", "model"]`, not boolean/string values.

## Features Not Yet Available in MCP Apps

These OpenAI features don't have MCP equivalents yet:

| OpenAI Feature | Workaround |
|----------------|------------|
| `_meta["openai/toolInvocation/invoking"]` / `invoked` | Progress indicators not yet available |
| `window.openai.widgetState` / `setWidgetState()` | Use `localStorage` or server-side state |
| `window.openai.uploadFile()` / `getFileDownloadUrl()` | File operations not yet available |
| `window.openai.requestModal()` / `requestClose()` | Modal management not yet available |

## Testing

### Using basic-host

Test the migrated app with the basic-host example:

```bash
# Terminal 1: Build and run your server
npm run build && npm run serve

# Terminal 2: Run basic-host (from cloned repo)
cd /tmp/mcp-ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm run start
# Open http://localhost:8080
```

### Debug with sendLog

Send debug logs to the host application:

```typescript
await app.sendLog({ level: "info", data: "Debug message" });
await app.sendLog({ level: "error", data: { error: err.message } });
```

## Full Migration Reference

For exhaustive mapping tables covering all server-side and client-side properties, consult:
- `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md`

This reference includes detailed mappings for tool metadata, resource metadata, host context properties, event handlers, and all API methods.

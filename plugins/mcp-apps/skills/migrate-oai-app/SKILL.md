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

## Key Conceptual Changes

### Server-Side

Use `registerAppTool()` and `registerAppResource()` helpers instead of raw `server.registerTool()` / `server.registerResource()`. These helpers handle the MCP Apps metadata format automatically.

CSP properties change from snake_case to camelCase (`connect_domains` → `connectDomains`, `resource_domains` → `resourceDomains`).

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for complete server-side mapping tables.

### Client-Side

The fundamental paradigm shift: OpenAI uses a synchronous global object (`window.openai.toolInput`, `window.openai.theme`) that's pre-populated before your code runs. MCP Apps uses an `App` instance with async event handlers.

Key differences:
- Create an `App` instance and register handlers (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`) **before** calling `connect()`. (Events may fire immediately after connection, so handlers must be registered first.)
- Access context via `app.getHostContext()` instead of global properties.

For React apps, the `useApp` hook manages this lifecycle automatically—see `basic-server-react/` for the pattern.

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for complete client-side mapping tables.

## Migration Checklist

These migration-specific changes are easy to miss. Verify each one:

### MIME Type
```typescript
// ❌ OpenAI
mimeType: "text/html+skybridge"

// ✅ MCP
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
mimeType: RESOURCE_MIME_TYPE  // "text/html;profile=mcp-app"
```

### Visibility Format
```typescript
// ❌ OpenAI (boolean/string)
"openai/widgetAccessible": true,
"openai/visibility": "public",

// ✅ MCP (string array)
_meta: { ui: { visibility: ["app", "model"] } }
```

### Tool Result Access
```typescript
// ❌ OpenAI
const data = window.openai.toolOutput;

// ✅ MCP
app.ontoolresult = (params) => {
  const data = params.structuredContent;  // not params.toolOutput
};
```

### API Parameter Names
```typescript
// ❌ OpenAI
await window.openai.openExternal({ href: "https://..." });
await window.openai.sendFollowUpMessage({ prompt: "..." });

// ✅ MCP
await app.openLink({ url: "https://..." });  // href → url
await app.sendMessage({ role: "user", content: [{ type: "text", text: "..." }] });
```

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

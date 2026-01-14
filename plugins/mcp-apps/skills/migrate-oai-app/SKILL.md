---
name: Migrate from OpenAI App
description: This skill should be used when the user asks to "migrate from OpenAI Apps SDK", "convert OpenAI App to MCP", "port from window.openai", "migrate from skybridge", "convert openai/outputTemplate", or needs guidance on converting OpenAI Apps SDK applications to MCP Apps SDK. Provides step-by-step migration guidance with API mapping tables.
---

# Migrate OpenAI App to MCP

Migrate existing OpenAI Apps SDK applications to the MCP Apps SDK (`@modelcontextprotocol/ext-apps`). The MCP Apps SDK provides a standardized, open protocol for interactive UIs in conversational clients, with automatic environment detection for both OpenAI and MCP hosts.

## Best Practices

Use your package manager to add dependencies (e.g., `npm install`, `pnpm add`, `yarn add`) rather than manually writing version numbers. This lets the package manager resolve the latest compatible versions. Never specify version numbers from memory.

## Getting Reference Code

Clone the SDK repository for complete migration documentation and working examples:

```bash
git clone --branch "v$(npm view @modelcontextprotocol/ext-apps version)" --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
```

### Migration Documentation

Read the complete migration reference with exhaustive mapping tables:
- `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` - Full server-side and client-side mappings

### API Reference (Source Files)

Read JSDoc documentation directly from `/tmp/mcp-ext-apps/src/`:

| File | Contents |
|------|----------|
| `src/app.ts` | `App` class, handlers, lifecycle |
| `src/server/index.ts` | `registerAppTool`, `registerAppResource` |
| `src/spec.types.ts` | Type definitions |
| `src/react/useApp.tsx` | `useApp` hook for React apps |
| `src/react/use*.ts*` | Other `use*` hooks for React apps |

### Front-End Framework Examples

See `/tmp/mcp-ext-apps/examples/basic-server-{framework}/` for basic SDK usage examples organized by front-end framework:

| Template | Key Files |
|----------|-----------|
| `basic-server-vanillajs/` | `server.ts`, `src/mcp-app.ts`, `mcp-app.html` |
| `basic-server-react/` | `server.ts`, `src/mcp-app.tsx` (uses `useApp` hook) |
| `basic-server-vue/` | `server.ts`, `src/App.vue` |
| `basic-server-svelte/` | `server.ts`, `src/App.svelte` |
| `basic-server-preact/` | `server.ts`, `src/mcp-app.tsx` |
| `basic-server-solid/` | `server.ts`, `src/mcp-app.tsx` |

## Key Conceptual Changes

### Server-Side

Use `registerAppTool()` and `registerAppResource()` helpers instead of raw `server.registerTool()` / `server.registerResource()`. These helpers handle the MCP Apps metadata format automatically.

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for complete server-side mapping tables.

### Client-Side

The fundamental paradigm shift: OpenAI uses a synchronous global object (`window.openai.toolInput`, `window.openai.theme`) that's pre-populated before your code runs. MCP Apps uses an `App` instance with async event handlers.

Key differences:
- Create an `App` instance and register handlers (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`) **before** calling `connect()`. (Events may fire immediately after connection, so handlers must be registered first.)
- Access tool data via handlers: `app.ontoolinput` for `window.openai.toolInput`, `app.ontoolresult` for `window.openai.toolOutput`.
- Access host environment (theme, locale, etc.) via `app.getHostContext()`.

For React apps, the `useApp` hook manages this lifecycle automatically—see `basic-server-react/` for the pattern.

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for complete client-side mapping tables.

### Features Not Yet Available in MCP Apps

These OpenAI features don't have MCP equivalents yet:

**Server-side:**
| OpenAI Feature | Status/Workaround |
|----------------|-------------------|
| `_meta["openai/toolInvocation/invoking"]` / `_meta["openai/toolInvocation/invoked"]` | Progress indicators not yet available |
| `_meta["openai/widgetDescription"]` | Use `app.updateModelContext()` for dynamic context |

**Client-side:**
| OpenAI Feature | Status/Workaround |
|----------------|-------------------|
| `window.openai.widgetState` / `setWidgetState()` | Use `localStorage` or server-side state |
| `window.openai.uploadFile()` / `getFileDownloadUrl()` | File operations not yet available |
| `window.openai.requestModal()` / `requestClose()` | Modal management not yet available |
| `window.openai.view` | Not yet available |

## CSP Configuration

You **MUST** investigate what origins the app will request at runtime. MCP Apps run in a sandbox that blocks cross-origin requests by default. Trace through your HTML, build config, and source code—note every origin that assets load from, including your own asset server if it's on a different port or host than the HTML.


| If your app... | Then add to CSP |
|----------------|-----------------|
| Loads images from external hosts | Those origins in `resourceDomains` |
| Uses fonts from a CDN | That origin in `resourceDomains` |
| Serves JS/CSS from a separate server or CDN | That origin in `resourceDomains` |
| Calls third-party APIs (maps, auth, etc.) | Those origins in `connectDomains` |

These origins often differ between development and production. Investigate how the codebase handles this (env vars, config files, build flags, etc.) and configure CSP using the same mechanism.

```typescript
registerAppResource(server, name, uri, {
  description: "UI resource for the MCP App",
}, async () => ({
  contents: [{
    uri,
    mimeType: RESOURCE_MIME_TYPE,
    text: html,
    _meta: {
      ui: {
        csp: {
          resourceDomains: [/* origins serving your images/fonts/scripts/styles */],
          connectDomains: [/* origins for API requests */],
        },
      },
    },
  }],
}));
```

## Before Finishing

After applying changes from the migration reference, search for leftover OpenAI patterns:

**Server-side:**
| Pattern | Indicates |
|---------|-----------|
| `"openai/` | Old metadata keys → `_meta.ui.*` |
| `text/html+skybridge` | Old MIME type → `RESOURCE_MIME_TYPE` constant |
| `text/html;profile=mcp-app` | New MIME type, but prefer `RESOURCE_MIME_TYPE` constant |
| `_domains"` or `_domains:` | snake_case CSP → camelCase (`connect_domains` → `connectDomains`) |

**Client-side:**
| Pattern | Indicates |
|---------|-----------|
| `window.openai.toolInput` | Old global → `params.arguments` in `ontoolinput` handler |
| `window.openai.toolOutput` | Old global → `params.structuredContent` in `ontoolresult` |
| `window.openai` | Old global API → `App` instance methods |
| `callTool(` | Old method → `callServerTool()` |
| `openExternal(` | Old method → `openLink({ url: ... })` |
| `sendFollowUpMessage(` | Old method → `sendMessage()` with structured content |
| `notifyIntrinsicHeight(` | Old size API → `sendSizeChanged()` or `autoResize: true` |

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

### Verify Runtime Behavior

Once the app loads in basic-host, confirm:
1. App loads without console errors
2. `ontoolinput` handler fires with tool arguments
3. `ontoolresult` handler fires with `structuredContent`
4. Theme/context changes propagate to the UI

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

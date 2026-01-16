---
name: Migrate from OpenAI App
description: This skill should be used when the user asks to "migrate from OpenAI Apps SDK", "convert OpenAI App to MCP", "port from window.openai", "migrate from skybridge", "convert openai/outputTemplate", or needs guidance on converting OpenAI Apps SDK applications to MCP Apps SDK. Provides step-by-step migration guidance with API mapping tables.
---

# Migrate OpenAI App to MCP

Migrate existing OpenAI Apps SDK applications to the MCP Apps SDK (`@modelcontextprotocol/ext-apps`). The MCP Apps SDK provides a standardized, open protocol for interactive UIs in conversational clients.

## Best Practices

- Re-read this skill when you are done! The migration will be a long process, and you might forget some things. Preemptively add a final todo item with this exact wording: "Re-read the 'Before Finishing' checklist in this skill and address each checkbox individually, stating what you did for each one, before marking this todo complete."
- Use your package manager to add dependencies (e.g., `npm install`, `pnpm add`, `yarn add`) rather than manually writing version numbers. This lets the package manager resolve the latest compatible versions. Never specify version numbers from memory.

## Getting Reference Code

Clone the SDK repository for complete migration documentation and working examples:

```bash
git clone --branch "v$(npm view @modelcontextprotocol/ext-apps version)" --depth 1 https://github.com/modelcontextprotocol/ext-apps.git /tmp/mcp-ext-apps
```

### Migration Reference Guide

Read the migration reference guide with "before/after" mapping tables: `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md`

### API Reference (Source Files)

Read JSDoc documentation directly from `/tmp/mcp-ext-apps/src/*`:

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

## CSP Configuration

Before migrating:

1. Identify which origins your app fetches assets (images/fonts/JS/CSS) from or makes API requests to
2. Identify how your codebase switches between origins for local development vs production (e.g., env vars, config files, build flags, etc.)

MCP Apps run in a sandbox that blocks cross-origin requests by default. You will need to correctly configure CSP for both local development and production; otherwise, your app will not work.

## Key Conceptual Changes

### Server-Side

Use `registerAppTool()` and `registerAppResource()` helpers instead of raw `server.registerTool()` / `server.registerResource()`. These helpers handle the MCP Apps metadata format automatically.

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for server-side mapping tables.

### Client-Side

The fundamental paradigm shift: OpenAI uses a synchronous global object (`window.openai.toolInput`, `window.openai.theme`) that's pre-populated before your code runs. MCP Apps uses an `App` instance with async event handlers.

Key differences:
- Create an `App` instance and register handlers (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`) **before** calling `connect()`. (Events may fire immediately after connection, so handlers must be registered first.)
- Access tool data via handlers: `app.ontoolinput` for `window.openai.toolInput`, `app.ontoolresult` for `window.openai.toolOutput`.
- Access host environment (theme, locale, etc.) via `app.getHostContext()`.

For React apps, the `useApp` hook manages this lifecycle automatically—see `basic-server-react/` for the pattern.

See `/tmp/mcp-ext-apps/docs/migrate_from_openai_apps.md` for client-side mapping tables.

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

## Before Finishing

- [ ] Double-check that you migrated all server-side OpenAI patterns:

    | Pattern | Indicates |
    |---------|-----------|
    | `"openai/` | Old metadata keys → `_meta.ui.*` |
    | `text/html+skybridge` | Old MIME type → `RESOURCE_MIME_TYPE` constant |
    | `text/html;profile=mcp-app` | New MIME type, but prefer `RESOURCE_MIME_TYPE` constant |
    | `_domains"` or `_domains:` | snake_case CSP → camelCase (`connect_domains` → `connectDomains`) |

- [ ] Double-check that you migrated all client-side OpenAI patterns:

    | Pattern | Indicates |
    |---------|-----------|
    | `window.openai.toolInput` | Old global → `params.arguments` in `ontoolinput` handler |
    | `window.openai.toolOutput` | Old global → `params.structuredContent` in `ontoolresult` |
    | `window.openai` | Old global API → `App` instance methods |

- [ ] Double-check that you correctly configured CSP:

    ```typescript
    registerAppResource(server, name, uri, {
      description: "UI resource for your MCP App",
    }, async () => ({
      contents: [{
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: {
          ui: {
            csp: {
              resourceDomains: [/* origins serving images/fonts/JS/CSS */],
              connectDomains: [/* origins for API requests */],
            },
          },
        },
      }],
    }));
    ```

- [ ] In the build config (build scripts, config files, env vars, etc.), search for every setting that affects dev vs prod URLs. Explain out loud how those settings control dev vs prod URLs. Then double-check that each of those settings also controls dev vs prod CSP origins in the same way.

- [ ] In the built files, search for every localhost origin your app needs in development (asset server, API server, etc.). Then double-check that each of those origins are included in the CSP.

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
3. `ontoolresult` handler fires with tool result

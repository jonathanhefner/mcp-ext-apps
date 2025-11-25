import { useEffect, useState } from "react";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { App, McpUiAppCapabilities, PostMessageTransport } from "../app";
export * from "../app";

/**
 * Options for configuring the useApp hook.
 *
 * Note: This interface does NOT expose {@link AppOptions} like `autoResize`.
 * The hook creates the App with default options (autoResize: true). If you need
 * custom App options, create the App manually instead of using this hook.
 */
export interface UseAppOptions {
  /** App identification (name and version) */
  appInfo: Implementation;
  /** Features and capabilities this app provides */
  capabilities: McpUiAppCapabilities;
  /**
   * Called after App is created but before connection.
   *
   * Use this to register request/notification handlers that need to be in place
   * before the initialization handshake completes.
   *
   * @param app - The newly created App instance
   *
   * @example Register a notification handler
   * ```typescript
   * onAppCreated: (app) => {
   *   app.setNotificationHandler(
   *     McpUiToolInputNotificationSchema,
   *     (notification) => {
   *       console.log("Tool input:", notification.params.arguments);
   *     }
   *   );
   * }
   * ```
   */
  onAppCreated?: (app: App) => void;
}

/**
 * State returned by the useApp hook.
 */
export interface AppState {
  /** The connected App instance, null during initialization */
  app: App | null;
  /** Whether initialization completed successfully */
  isConnected: boolean;
  /** Connection error if initialization failed, null otherwise */
  error: Error | null;
}

/**
 * React hook to create and connect an MCP App.
 *
 * This hook manages the complete lifecycle of an App: creation, connection,
 * and cleanup. It automatically creates a PostMessageTransport to window.parent
 * and handles initialization.
 *
 * **Important**: The hook intentionally does NOT re-run when options change
 * to avoid reconnection loops. Options are only used during the initial mount.
 *
 * **Note**: This is part of the optional React integration. The core SDK
 * ({@link App}, {@link PostMessageTransport}) is framework-agnostic and can be
 * used with any UI framework or vanilla JavaScript.
 *
 * @param options - Configuration for the app
 * @returns Current connection state and app instance
 *
 * @example Basic usage
 * ```typescript
 * import { useApp } from '@modelcontextprotocol/ext-apps/react';
 *
 * function MyApp() {
 *   const { app, isConnected, error } = useApp({
 *     appInfo: { name: "MyApp", version: "1.0.0" },
 *     capabilities: {},
 *     onAppCreated: (app) => {
 *       // Register handlers before connection
 *       app.setNotificationHandler(
 *         McpUiToolInputNotificationSchema,
 *         (notification) => {
 *           setToolArgs(notification.params.arguments);
 *         }
 *       );
 *     },
 *   });
 *
 *   if (error) return <ErrorView error={error} />;
 *   if (!isConnected) return <LoadingView />;
 *   return <AppView app={app} />;
 * }
 * ```
 */
export function useApp({
  appInfo,
  capabilities,
  onAppCreated,
}: UseAppOptions): AppState {
  const [app, setApp] = useState<App | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function connect() {
      try {
        const transport = new PostMessageTransport(window.parent);
        const app = new App(appInfo, capabilities);

        // Register handlers BEFORE connecting
        onAppCreated?.(app);

        await app.connect(transport);

        if (mounted) {
          setApp(app);
          setIsConnected(true);
          setError(null);
        }
      } catch (error) {
        if (mounted) {
          setApp(null);
          setIsConnected(false);
          setError(
            error instanceof Error ? error : new Error("Failed to connect"),
          );
        }
      }
    }

    connect();

    return () => {
      mounted = false;
    };
  }, []); // Intentionally not including options to avoid reconnection

  return { app, isConnected, error };
}

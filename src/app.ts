import {
  type RequestOptions,
  Protocol,
  ProtocolOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";

import {
  CallToolRequest,
  CallToolResult,
  CallToolResultSchema,
  Implementation,
  LoggingMessageNotification,
  Notification,
  PingRequestSchema,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";
import {
  LATEST_PROTOCOL_VERSION,
  McpUiAppCapabilities,
  McpUiHostCapabilities,
  McpUiInitializedNotification,
  McpUiInitializeRequest,
  McpUiInitializeResultSchema,
  McpUiMessageRequest,
  McpUiMessageResultSchema,
  McpUiOpenLinkRequest,
  McpUiOpenLinkResultSchema,
  McpUiSizeChangeNotification,
} from "./types";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export { PostMessageTransport } from "./message-transport.js";
export * from "./types";

/**
 * Options for configuring App behavior.
 *
 * Extends ProtocolOptions from the MCP SDK with App-specific configuration.
 *
 * @see ProtocolOptions from @modelcontextprotocol/sdk for inherited options
 */
export type AppOptions = ProtocolOptions & {
  /**
   * Automatically report size changes to the host using ResizeObserver.
   *
   * When enabled, the App monitors `document.body` and `document.documentElement`
   * for size changes and automatically sends `ui/notifications/size-change`
   * notifications to the host.
   *
   * @default true
   */
  autoResize?: boolean;
};

/**
 * Main class for MCP Apps to communicate with their host.
 *
 * The App class provides a framework-agnostic way to build interactive MCP Apps
 * that run inside host applications. It extends the MCP SDK's Protocol class and
 * handles the connection lifecycle, initialization handshake, and bidirectional
 * communication with the host.
 *
 * ## Architecture
 *
 * Guest UIs (Apps) act as MCP clients connecting to the host via PostMessage
 * transport. The host proxies requests to the actual MCP server and forwards
 * responses back to the App.
 *
 * ## Lifecycle
 *
 * 1. **Create**: Instantiate App with info and capabilities
 * 2. **Connect**: Call `connect()` to establish transport and perform handshake
 * 3. **Interactive**: Send requests, receive notifications, call tools
 * 4. **Cleanup**: Host sends teardown request before unmounting
 *
 * ## Inherited Methods
 *
 * As a subclass of Protocol, App inherits key methods for handling communication:
 * - `setRequestHandler()` - Register handlers for requests from host
 * - `setNotificationHandler()` - Register handlers for notifications from host
 *
 * @see {@link Protocol} from @modelcontextprotocol/sdk for all inherited methods
 *
 * @example Basic usage with PostMessageTransport
 * ```typescript
 * import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';
 *
 * const app = new App(
 *   { name: "WeatherApp", version: "1.0.0" },
 *   {} // capabilities
 * );
 *
 * // Register notification handler before connecting
 * app.setNotificationHandler(
 *   McpUiToolInputNotificationSchema,
 *   (notification) => {
 *     const args = notification.params.arguments;
 *     renderWeather(args.location);
 *   }
 * );
 *
 * await app.connect(new PostMessageTransport(window.parent));
 * ```
 *
 * @example Sending a message to the host's chat
 * ```typescript
 * await app.sendMessage({
 *   role: "user",
 *   content: [{ type: "text", text: "Weather updated!" }]
 * });
 * ```
 */
export class App extends Protocol<Request, Notification, Result> {
  private _hostCapabilities?: McpUiHostCapabilities;
  private _hostInfo?: Implementation;

  /**
   * Create a new MCP App instance.
   *
   * @param _appInfo - App identification (name and version)
   * @param _capabilities - Features and capabilities this app provides
   * @param options - Configuration options including autoResize behavior
   *
   * @see {@link AppOptions} for available configuration options
   *
   * @example
   * ```typescript
   * const app = new App(
   *   { name: "MyApp", version: "1.0.0" },
   *   { tools: { listChanged: true } }, // capabilities
   *   { autoResize: true } // options
   * );
   * ```
   */
  constructor(
    private _appInfo: Implementation,
    private _capabilities: McpUiAppCapabilities = {},
    private options: AppOptions = { autoResize: true },
  ) {
    super(options);

    this.setRequestHandler(PingRequestSchema, (request) => {
      console.log("Received ping:", request.params);
      return {};
    });
  }

  /**
   * Verify that the host supports the capability required for the given request method.
   * @internal
   */
  assertCapabilityForMethod(method: Request["method"]): void {
    // TODO
  }

  /**
   * Verify that the app declared the capability required for the given request method.
   * @internal
   */
  assertRequestHandlerCapability(method: Request["method"]): void {
    switch (method) {
      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) {
          throw new Error(
            `Client does not support tool capability (required for ${method})`,
          );
        }
        return;
      case "ping":
        return;
      default:
        throw new Error(`No handler for method ${method} registered`);
    }
  }

  /**
   * Verify that the app supports the capability required for the given notification method.
   * @internal
   */
  assertNotificationCapability(method: Notification["method"]): void {
    // TODO
  }

  /**
   * Call a tool on the originating MCP server (proxied through the host).
   *
   * Apps can call tools to fetch fresh data or trigger server-side actions.
   * The host proxies the request to the actual MCP server and returns the result.
   *
   * @param params - Tool name and arguments
   * @param options - Request options (timeout, etc.)
   * @returns Tool execution result
   *
   * @throws {Error} If the tool call fails or the server returns an error
   *
   * @example Fetch updated weather data
   * ```typescript
   * const result = await app.callServerTool({
   *   name: "get_weather",
   *   arguments: { location: "Tokyo" }
   * });
   * console.log(result.content);
   * ```
   *
   * @see {@link CallToolRequest} for request parameter structure
   * @see {@link CallToolResult} for response structure
   */
  async callServerTool(
    params: CallToolRequest["params"],
    options?: RequestOptions,
  ): Promise<CallToolResult> {
    return await this.request(
      { method: "tools/call", params },
      CallToolResultSchema,
      options,
    );
  }

  /**
   * Send a message to the host's chat interface.
   *
   * Enables the app to add messages to the conversation thread. Useful for
   * user-initiated messages or app-to-conversation communication.
   *
   * @param params - Message role and content
   * @param options - Request options (timeout, etc.)
   * @returns Result indicating success or error (no message content returned)
   *
   * @throws {Error} If the host rejects the message
   *
   * @example Send a text message from user interaction
   * ```typescript
   * await app.sendMessage({
   *   role: "user",
   *   content: [{ type: "text", text: "Show me details for item #42" }]
   * });
   * ```
   *
   * @see {@link McpUiMessageRequest} for request structure
   */
  sendMessage(params: McpUiMessageRequest["params"], options?: RequestOptions) {
    return this.request(
      <McpUiMessageRequest>{
        method: "ui/message",
        params,
      },
      McpUiMessageResultSchema,
      options,
    );
  }

  /**
   * Send log messages to the host for debugging and telemetry.
   *
   * Logs are not added to the conversation but may be recorded by the host
   * for debugging purposes.
   *
   * @param params - Log level and message
   *
   * @example Log app state for debugging
   * ```typescript
   * app.sendLog({
   *   level: "info",
   *   data: "Weather data refreshed",
   *   logger: "WeatherApp"
   * });
   * ```
   *
   * @returns Promise that resolves when the log notification is sent
   *
   * @see {@link LoggingMessageNotification} for notification structure
   */
  sendLog(params: LoggingMessageNotification["params"]) {
    return this.notification(<LoggingMessageNotification>{
      method: "notifications/message",
      params,
    });
  }

  /**
   * Request the host to open an external URL in the default browser.
   *
   * The host may deny this request based on user preferences or security policy.
   * Apps should handle rejection gracefully.
   *
   * @param params - URL to open
   * @param options - Request options (timeout, etc.)
   * @returns Result indicating success or error
   *
   * @throws {Error} If the host denies the request or the URL is invalid
   *
   * @example Open documentation link
   * ```typescript
   * try {
   *   await app.sendOpenLink({ url: "https://docs.example.com" });
   * } catch (error) {
   *   console.error("Failed to open link:", error);
   * }
   * ```
   *
   * @see {@link McpUiOpenLinkRequest} for request structure
   */
  sendOpenLink(
    params: McpUiOpenLinkRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      <McpUiOpenLinkRequest>{
        method: "ui/open-link",
        params,
      },
      McpUiOpenLinkResultSchema,
      options,
    );
  }

  /**
   * Notify the host of UI size changes.
   *
   * Apps can manually report size changes to help the host adjust the container.
   * If `autoResize` is enabled (default), this is called automatically.
   *
   * @param params - New width and height in pixels
   *
   * @example Manually notify host of size change
   * ```typescript
   * app.sendSizeChange({
   *   width: 400,
   *   height: 600
   * });
   * ```
   *
   * @returns Promise that resolves when the notification is sent
   *
   * @see {@link McpUiSizeChangeNotification} for notification structure
   */
  sendSizeChange(params: McpUiSizeChangeNotification["params"]) {
    return this.notification(<McpUiSizeChangeNotification>{
      method: "ui/notifications/size-change",
      params,
    });
  }

  /**
   * Set up automatic size change notifications using ResizeObserver.
   *
   * Observes both `document.documentElement` and `document.body` for size changes
   * and automatically sends `ui/notifications/size-change` notifications to the host.
   * The notifications are debounced using requestAnimationFrame to avoid duplicates.
   *
   * Note: This method is automatically called by `connect()` if the `autoResize`
   * option is true (default). You typically don't need to call this manually unless
   * you disabled autoResize and want to enable it later.
   *
   * @returns Cleanup function to disconnect the observer
   *
   * @example Manual setup for custom scenarios
   * ```typescript
   * const app = new App(appInfo, capabilities, { autoResize: false });
   * await app.connect(transport);
   *
   * // Later, enable auto-resize manually
   * const cleanup = app.setupSizeChangeNotifications();
   *
   * // Clean up when done
   * cleanup();
   * ```
   */
  setupSizeChangeNotifications() {
    const sendBodySizeChange = () => {
      let rafId: number | null = null;

      // Debounce using requestAnimationFrame to avoid duplicate messages
      // when both documentElement and body fire resize events
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        const { body, documentElement: html } = document;

        const bodyStyle = getComputedStyle(body);
        const htmlStyle = getComputedStyle(html);

        const width = body.scrollWidth;
        const height =
          body.scrollHeight +
          (parseFloat(bodyStyle.borderTop) || 0) +
          (parseFloat(bodyStyle.borderBottom) || 0) +
          (parseFloat(htmlStyle.borderTop) || 0) +
          (parseFloat(htmlStyle.borderBottom) || 0);

        this.sendSizeChange({ width, height });
        rafId = null;
      });
    };

    sendBodySizeChange();

    const resizeObserver = new ResizeObserver(sendBodySizeChange);
    // Observe both html and body to catch all size changes
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }

  /**
   * Establish connection with the host and perform initialization handshake.
   *
   * This method performs the following steps:
   * 1. Connects the transport layer
   * 2. Sends `ui/initialize` request with app info and capabilities
   * 3. Receives host capabilities and context in response
   * 4. Sends `ui/notifications/initialized` notification
   * 5. Sets up auto-resize if enabled (default)
   *
   * If initialization fails, the connection is automatically closed and an error
   * is thrown.
   *
   * @param transport - Transport layer (typically PostMessageTransport)
   * @param options - Request options for the initialize request
   *
   * @throws {Error} If initialization fails or connection is lost
   *
   * @example Connect with PostMessageTransport
   * ```typescript
   * const app = new App(
   *   { name: "MyApp", version: "1.0.0" },
   *   {}
   * );
   *
   * try {
   *   await app.connect(new PostMessageTransport(window.parent));
   *   console.log("Connected successfully!");
   * } catch (error) {
   *   console.error("Failed to connect:", error);
   * }
   * ```
   *
   * @see {@link McpUiInitializeRequest} for the initialization request structure
   * @see {@link McpUiInitializedNotification} for the initialized notification
   * @see {@link PostMessageTransport} for the typical transport implementation
   */
  override async connect(
    transport: Transport,
    options?: RequestOptions,
  ): Promise<void> {
    await super.connect(transport);

    try {
      const result = await this.request(
        <McpUiInitializeRequest>{
          method: "ui/initialize",
          params: {
            appCapabilities: this._capabilities,
            appInfo: this._appInfo,
            protocolVersion: LATEST_PROTOCOL_VERSION,
          },
        },
        McpUiInitializeResultSchema,
        options,
      );

      if (result === undefined) {
        throw new Error(`Server sent invalid initialize result: ${result}`);
      }

      this._hostCapabilities = result.hostCapabilities;
      this._hostInfo = result.hostInfo;

      await this.notification(<McpUiInitializedNotification>{
        method: "ui/notifications/initialized",
      });

      if (this.options?.autoResize) {
        this.setupSizeChangeNotifications();
      }
    } catch (error) {
      // Disconnect if initialization fails.
      void this.close();
      throw error;
    }
  }
}

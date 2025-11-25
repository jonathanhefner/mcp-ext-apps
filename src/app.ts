import {
  type RequestOptions,
  Protocol,
  ProtocolOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";

import {
  CallToolRequest,
  CallToolRequestSchema,
  CallToolResult,
  CallToolResultSchema,
  Implementation,
  ListToolsRequest,
  ListToolsRequestSchema,
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
  McpUiHostContextChangedNotification,
  McpUiHostContextChangedNotificationSchema,
  McpUiInitializedNotification,
  McpUiInitializeRequest,
  McpUiInitializeResultSchema,
  McpUiMessageRequest,
  McpUiMessageResultSchema,
  McpUiOpenLinkRequest,
  McpUiOpenLinkResultSchema,
  McpUiSizeChangeNotification,
  McpUiToolInputNotification,
  McpUiToolInputNotificationSchema,
  McpUiToolInputPartialNotification,
  McpUiToolInputPartialNotificationSchema,
  McpUiToolResultNotification,
  McpUiToolResultNotificationSchema,
} from "./types";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export { PostMessageTransport } from "./message-transport.js";
export * from "./types";

/**
 * Metadata key for associating a resource URI with a tool call.
 *
 * MCP servers can include this key in tool call metadata to indicate
 * which UI resource should be displayed for the tool. Hosts use this
 * to resolve and render the appropriate App for the tool invocation.
 *
 * @example Server-side tool definition with resource URI
 * ```typescript
 * // In your MCP server's tool handler:
 * return {
 *   content: [{ type: "text", text: "Result" }],
 *   _meta: {
 *     [RESOURCE_URI_META_KEY]: "ui://weather/forecast"
 *   }
 * };
 * ```
 */
export const RESOURCE_URI_META_KEY = "ui/resourceUri";

/**
 * Options for configuring App behavior.
 *
 * Extends ProtocolOptions from the MCP SDK with App-specific configuration.
 *
 * @see ProtocolOptions from @modelcontextprotocol/sdk for inherited options
 */
type AppOptions = ProtocolOptions & {
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

type RequestHandlerExtra = Parameters<
  Parameters<App["setRequestHandler"]>[1]
>[1];

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
 * ## Notification Setters
 *
 * For common notifications, the App class provides convenient setter properties
 * that simplify handler registration:
 * - `ontoolinput` - Complete tool arguments from host
 * - `ontoolinputpartial` - Streaming partial tool arguments
 * - `ontoolresult` - Tool execution results
 * - `onhostcontextchanged` - Host context changes (theme, viewport, etc.)
 *
 * These setters are convenience wrappers around `setNotificationHandler()`.
 * Both patterns work; use whichever fits your coding style better.
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
 * // Register notification handler using setter (simpler)
 * app.ontoolinput = (params) => {
 *   renderWeather(params.arguments);
 * };
 *
 * // OR using inherited setNotificationHandler (more explicit)
 * app.setNotificationHandler(
 *   McpUiToolInputNotificationSchema,
 *   (notification) => {
 *     renderWeather(notification.params.arguments);
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
   * Get the host's capabilities discovered during initialization.
   *
   * Returns the capabilities that the host advertised during the
   * {@link connect} handshake. Returns `undefined` if called before
   * connection is established.
   *
   * @returns Host capabilities, or `undefined` if not yet connected
   *
   * @example Check host capabilities after connection
   * ```typescript
   * await app.connect(transport);
   * const caps = app.getHostCapabilities();
   * if (caps?.tools) {
   *   console.log("Host supports tools");
   * }
   * ```
   *
   * @see {@link connect} for the initialization handshake
   * @see {@link McpUiHostCapabilities} for the capabilities structure
   */
  getHostCapabilities(): McpUiHostCapabilities | undefined {
    return this._hostCapabilities;
  }

  /**
   * Get the host's implementation info discovered during initialization.
   *
   * Returns the host's name and version as advertised during the
   * {@link connect} handshake. Returns `undefined` if called before
   * connection is established.
   *
   * @returns Host implementation info, or `undefined` if not yet connected
   *
   * @example Log host information after connection
   * ```typescript
   * await app.connect(transport);
   * const host = app.getHostVersion();
   * if (host) {
   *   console.log(`Connected to ${host.name} v${host.version}`);
   * }
   * ```
   *
   * @see {@link connect} for the initialization handshake
   * @see {@link Implementation} from @modelcontextprotocol/sdk for the type
   */
  getHostVersion(): Implementation | undefined {
    return this._hostInfo;
  }

  /**
   * Convenience handler for receiving complete tool input from the host.
   *
   * Set this property to register a handler that will be called when the host
   * sends a tool's complete arguments. This is sent after a tool call begins
   * and before the tool result is available.
   *
   * This setter is a convenience wrapper around `setNotificationHandler()` that
   * automatically handles the notification schema and extracts the params for you.
   *
   * @param callback - Function called with the tool input params
   *
   * @example Using the setter (simpler)
   * ```typescript
   * app.ontoolinput = (params) => {
   *   console.log("Tool:", params.arguments);
   *   renderToolUI(params.arguments);
   * };
   * ```
   *
   * @example Using setNotificationHandler (more explicit)
   * ```typescript
   * app.setNotificationHandler(
   *   McpUiToolInputNotificationSchema,
   *   (notification) => {
   *     console.log("Tool:", notification.params.arguments);
   *     renderToolUI(notification.params.arguments);
   *   }
   * );
   * ```
   *
   * @see {@link setNotificationHandler} for the underlying method
   * @see {@link McpUiToolInputNotification} for the notification structure
   */
  set ontoolinput(
    callback: (params: McpUiToolInputNotification["params"]) => void,
  ) {
    this.setNotificationHandler(McpUiToolInputNotificationSchema, (n) =>
      callback(n.params),
    );
  }

  /**
   * Convenience handler for receiving streaming partial tool input from the host.
   *
   * Set this property to register a handler that will be called as the host
   * streams partial tool arguments during tool call initialization. This enables
   * progressive rendering of tool arguments before they're complete.
   *
   * This setter is a convenience wrapper around `setNotificationHandler()` that
   * automatically handles the notification schema and extracts the params for you.
   *
   * @param callback - Function called with each partial tool input update
   *
   * @example Progressive rendering of tool arguments
   * ```typescript
   * app.ontoolinputpartial = (params) => {
   *   updateToolUIProgressively(params.partialArguments);
   * };
   * ```
   *
   * @see {@link setNotificationHandler} for the underlying method
   * @see {@link McpUiToolInputPartialNotification} for the notification structure
   * @see {@link ontoolinput} for the complete tool input handler
   */
  set ontoolinputpartial(
    callback: (params: McpUiToolInputPartialNotification["params"]) => void,
  ) {
    this.setNotificationHandler(McpUiToolInputPartialNotificationSchema, (n) =>
      callback(n.params),
    );
  }

  /**
   * Convenience handler for receiving tool execution results from the host.
   *
   * Set this property to register a handler that will be called when the host
   * sends the result of a tool execution. This is sent after the tool completes
   * on the MCP server, allowing your app to display the results or update its state.
   *
   * This setter is a convenience wrapper around `setNotificationHandler()` that
   * automatically handles the notification schema and extracts the params for you.
   *
   * @param callback - Function called with the tool result
   *
   * @example Display tool execution results
   * ```typescript
   * app.ontoolresult = (params) => {
   *   if (params.content) {
   *     displayToolOutput(params.content);
   *   }
   *   if (params.isError) {
   *     showError("Tool execution failed");
   *   }
   * };
   * ```
   *
   * @see {@link setNotificationHandler} for the underlying method
   * @see {@link McpUiToolResultNotification} for the notification structure
   * @see {@link ontoolinput} for the initial tool input handler
   */
  set ontoolresult(
    callback: (params: McpUiToolResultNotification["params"]) => void,
  ) {
    this.setNotificationHandler(McpUiToolResultNotificationSchema, (n) =>
      callback(n.params),
    );
  }

  /**
   * Convenience handler for host context changes (theme, viewport, locale, etc.).
   *
   * Set this property to register a handler that will be called when the host's
   * context changes, such as theme switching (light/dark), viewport size changes,
   * locale changes, or other environmental updates. Apps should respond by
   * updating their UI accordingly.
   *
   * This setter is a convenience wrapper around `setNotificationHandler()` that
   * automatically handles the notification schema and extracts the params for you.
   *
   * @param callback - Function called with the updated host context
   *
   * @example Respond to theme changes
   * ```typescript
   * app.onhostcontextchanged = (params) => {
   *   if (params.theme === "dark") {
   *     document.body.classList.add("dark-theme");
   *   } else {
   *     document.body.classList.remove("dark-theme");
   *   }
   * };
   * ```
   *
   * @see {@link setNotificationHandler} for the underlying method
   * @see {@link McpUiHostContextChangedNotification} for the notification structure
   * @see {@link McpUiHostContext} for the full context structure
   */
  set onhostcontextchanged(
    callback: (params: McpUiHostContextChangedNotification["params"]) => void,
  ) {
    this.setNotificationHandler(
      McpUiHostContextChangedNotificationSchema,
      (n) => callback(n.params),
    );
  }

  /**
   * Convenience handler for tool call requests from the host.
   *
   * Set this property to register a handler that will be called when the host
   * requests this app to execute a tool. This enables apps to provide their own
   * tools that can be called by the host or LLM.
   *
   * The app must declare tool capabilities in the constructor to use this handler.
   *
   * This setter is a convenience wrapper around `setRequestHandler()` that
   * automatically handles the request schema and extracts the params for you.
   *
   * @param callback - Async function that executes the tool and returns the result
   *
   * @throws {Error} If app did not declare tool capabilities
   *
   * @example Handle tool calls from the host
   * ```typescript
   * app.oncalltool = async (params, extra) => {
   *   if (params.name === "calculate") {
   *     const result = evaluate(params.arguments?.expression);
   *     return { content: [{ type: "text", text: String(result) }] };
   *   }
   *   throw new Error(`Unknown tool: ${params.name}`);
   * };
   * ```
   *
   * @see {@link setRequestHandler} for the underlying method
   * @see {@link CallToolRequest} for the request structure
   * @see {@link CallToolResult} for the expected return type
   */
  set oncalltool(
    callback: (
      params: CallToolRequest["params"],
      extra: RequestHandlerExtra,
    ) => Promise<CallToolResult>,
  ) {
    this.setRequestHandler(CallToolRequestSchema, (request, extra) =>
      callback(request.params, extra),
    );
  }

  /**
   * Convenience handler for listing available tools.
   *
   * Set this property to register a handler that will be called when the host
   * requests a list of tools this app provides. This enables dynamic tool
   * discovery by the host or LLM.
   *
   * The app must declare tool capabilities in the constructor to use this handler.
   *
   * This setter is a convenience wrapper around `setRequestHandler()` that
   * automatically handles the request schema and extracts the params for you.
   *
   * @param callback - Async function that returns the list of available tools
   *
   * @throws {Error} If app did not declare tool capabilities
   *
   * @example Return available tools
   * ```typescript
   * app.onlisttools = async (params, extra) => {
   *   return {
   *     tools: ["calculate", "convert", "format"]
   *   };
   * };
   * ```
   *
   * @see {@link setRequestHandler} for the underlying method
   * @see {@link ListToolsRequest} for the request structure
   * @see {@link oncalltool} for handling tool execution
   */
  set onlisttools(
    callback: (
      params: ListToolsRequest["params"],
      extra: RequestHandlerExtra,
    ) => Promise<{ tools: string[] }>,
  ) {
    this.setRequestHandler(ListToolsRequestSchema, (request, extra) =>
      callback(request.params, extra),
    );
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
    let scheduled = false;
    const sendBodySizeChange = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const rect = (
          document.body.parentElement ?? document.body
        ).getBoundingClientRect();
        const width = Math.ceil(rect.width);
        const height = Math.ceil(rect.height);
        this.sendSizeChange({ width, height });
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

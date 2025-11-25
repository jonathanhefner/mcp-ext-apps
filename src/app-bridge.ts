import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ZodLiteral, ZodObject } from "zod";

import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  Implementation,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResultSchema,
  Notification,
  PingRequestSchema,
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  Result,
  ToolListChangedNotificationSchema,
  Request,
} from "@modelcontextprotocol/sdk/types.js";
import {
  Protocol,
  ProtocolOptions,
  RequestOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";

import {
  type McpUiToolInputNotification,
  type McpUiToolResultNotification,
  type McpUiSandboxResourceReadyNotification,
  type McpUiSizeChangeNotification,
  LATEST_PROTOCOL_VERSION,
  McpUiAppCapabilities,
  McpUiHostCapabilities,
  McpUiInitializedNotificationSchema,
  McpUiInitializeRequest,
  McpUiInitializeRequestSchema,
  McpUiInitializeResult,
  McpUiResourceTeardownRequest,
  McpUiResourceTeardownResultSchema,
} from "./types";
export * from "./types";
export { PostMessageTransport } from "./message-transport";

/**
 * Options for configuring AppBridge behavior.
 */
export type HostOptions = ProtocolOptions;

/**
 * Protocol versions supported by this AppBridge implementation.
 *
 * The SDK automatically handles version negotiation during initialization.
 * Hosts don't need to manage protocol versions manually.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION];

/**
 * Host-side bridge for communicating with a single Guest UI (App).
 *
 * AppBridge extends the MCP SDK's Protocol class and acts as a proxy between
 * the host application and a Guest UI running in an iframe. It automatically
 * forwards MCP server capabilities (tools, resources, prompts) to the Guest UI
 * and handles the initialization handshake.
 *
 * ## Architecture
 *
 * **Guest UI ↔ AppBridge ↔ Host ↔ MCP Server**
 *
 * The bridge proxies requests from the Guest UI to the MCP server and forwards
 * responses back. It also sends host-initiated notifications like tool input
 * and results to the Guest UI.
 *
 * ## Lifecycle
 *
 * 1. **Create**: Instantiate AppBridge with MCP client and capabilities
 * 2. **Connect**: Call `connect()` with transport to establish communication
 * 3. **Wait for init**: Guest UI sends initialize request, bridge responds
 * 4. **Send data**: Call `sendToolInput()`, `sendToolResult()`, etc.
 * 5. **Teardown**: Call `sendResourceTeardown()` before unmounting iframe
 *
 * @example Basic usage
 * ```typescript
 * import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
 * import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *
 * // Create MCP client for the server
 * const client = new Client(
 *   { name: "MyHost", version: "1.0.0" },
 *   { tools: {}, resources: {} }
 * );
 * await client.connect(serverTransport);
 *
 * // Create bridge for the Guest UI
 * const bridge = new AppBridge(
 *   client,
 *   { name: "MyHost", version: "1.0.0" },
 *   { openLinks: {}, serverTools: {}, logging: {} }
 * );
 *
 * // Set up iframe and connect
 * const iframe = document.getElementById('app') as HTMLIFrameElement;
 * const transport = new PostMessageTransport(
 *   iframe.contentWindow!,
 *   iframe.contentWindow
 * );
 *
 * bridge.oninitialized = () => {
 *   console.log("Guest UI initialized");
 *   // Now safe to send tool input
 *   bridge.sendToolInput({ arguments: { location: "NYC" } });
 * };
 *
 * await bridge.connect(transport);
 * ```
 */
export class AppBridge extends Protocol<Request, Notification, Result> {
  /**
   * Called when the Guest UI completes initialization.
   *
   * Set this callback to be notified when the Guest UI has finished its
   * initialization handshake and is ready to receive tool input and other data.
   *
   * @example
   * ```typescript
   * bridge.oninitialized = () => {
   *   console.log("Guest UI ready");
   *   bridge.sendToolInput({ arguments: toolArgs });
   * };
   * ```
   */
  oninitialized?: () => void;

  private _appCapabilities?: McpUiAppCapabilities;

  /**
   * Create a new AppBridge instance.
   *
   * @param _client - MCP client connected to the server (for proxying requests)
   * @param _hostInfo - Host application identification (name and version)
   * @param _capabilities - Features and capabilities the host supports
   * @param options - Configuration options (inherited from Protocol)
   *
   * @example
   * ```typescript
   * const bridge = new AppBridge(
   *   mcpClient,
   *   { name: "MyHost", version: "1.0.0" },
   *   { openLinks: {}, serverTools: {}, logging: {} }
   * );
   * ```
   */
  constructor(
    private _client: Client,
    private _hostInfo: Implementation,
    private _capabilities: McpUiHostCapabilities,
    options?: HostOptions,
  ) {
    super(options);

    this.setRequestHandler(McpUiInitializeRequestSchema, (request) =>
      this._oninitialize(request),
    );
    this.setNotificationHandler(McpUiInitializedNotificationSchema, () =>
      this.oninitialized?.(),
    );

    this.setRequestHandler(PingRequestSchema, (request) => {
      console.log("Received ping:", request.params);
      return {};
    });
  }

  /**
   * Verify that the guest supports the capability required for the given request method.
   * @internal
   */
  assertCapabilityForMethod(method: Request["method"]): void {
    // TODO
  }

  /**
   * Verify that a request handler is registered and supported for the given method.
   * @internal
   */
  assertRequestHandlerCapability(method: Request["method"]): void {
    // TODO
  }

  /**
   * Verify that the host supports the capability required for the given notification method.
   * @internal
   */
  assertNotificationCapability(method: Notification["method"]): void {
    // TODO
  }

  /**
   * Get the host capabilities passed to the constructor.
   *
   * @returns Host capabilities object
   */
  getCapabilities(): McpUiHostCapabilities {
    return this._capabilities;
  }

  /**
   * Handle the ui/initialize request from the guest.
   * @internal
   */
  private async _oninitialize(
    request: McpUiInitializeRequest,
  ): Promise<McpUiInitializeResult> {
    const requestedVersion = request.params.protocolVersion;

    this._appCapabilities = request.params.appCapabilities;

    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
      requestedVersion,
    )
      ? requestedVersion
      : LATEST_PROTOCOL_VERSION;

    return {
      protocolVersion,
      hostCapabilities: this.getCapabilities(),
      hostInfo: this._hostInfo,
      hostContext: {
        // TODO
      },
    };
  }

  /**
   * Notify the Guest UI of viewport size changes.
   *
   * Send this when the host's container/window resizes to allow the Guest UI
   * to adjust its layout. For example: window resize, orientation change,
   * panel resize.
   *
   * @param params - New viewport dimensions in pixels
   *
   * @example
   * ```typescript
   * window.addEventListener('resize', () => {
   *   bridge.sendSizeChange({
   *     width: container.clientWidth,
   *     height: container.clientHeight
   *   });
   * });
   * ```
   */
  sendSizeChange(params: McpUiSizeChangeNotification["params"]) {
    return this.notification(<McpUiSizeChangeNotification>{
      method: "ui/notifications/size-change",
      params,
    });
  }

  /**
   * Send complete tool arguments to the Guest UI.
   *
   * The host MUST send this notification after the Guest UI completes initialization
   * (after `oninitialized` callback fires) and complete tool arguments become available.
   * This notification is sent exactly once and is required before {@link sendToolResult}.
   *
   * @param params - Complete tool call arguments
   *
   * @example
   * ```typescript
   * bridge.oninitialized = () => {
   *   bridge.sendToolInput({
   *     arguments: { location: "New York", units: "metric" }
   *   });
   * };
   * ```
   */
  sendToolInput(params: McpUiToolInputNotification["params"]) {
    return this.notification(<McpUiToolInputNotification>{
      method: "ui/notifications/tool-input",
      params,
    });
  }

  /**
   * Send tool execution result to the Guest UI.
   *
   * The host MUST send this notification when tool execution completes successfully
   * (if the UI is displayed during execution). This must be sent after
   * {@link sendToolInput}.
   *
   * @param params - Standard MCP tool execution result
   *
   * @example
   * ```typescript
   * import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
   *
   * const result = await mcpClient.request(
   *   { method: "tools/call", params: { name: "get_weather", arguments: args } },
   *   CallToolResultSchema
   * );
   * bridge.sendToolResult(result);
   * ```
   */
  sendToolResult(params: McpUiToolResultNotification["params"]) {
    return this.notification(<McpUiToolResultNotification>{
      method: "ui/notifications/tool-result",
      params,
    });
  }

  /**
   * Send HTML resource to the sandbox proxy for secure loading.
   *
   * This is an internal method used by web-based hosts implementing the
   * double-iframe sandbox architecture. After the sandbox proxy signals readiness
   * via `ui/notifications/sandbox-proxy-ready`, the host sends this notification
   * with the HTML content to load.
   *
   * @param params - HTML content and optional sandbox attributes
   * @internal
   */
  sendSandboxResourceReady(
    params: McpUiSandboxResourceReadyNotification["params"],
  ) {
    return this.notification(<McpUiSandboxResourceReadyNotification>{
      method: "ui/notifications/sandbox-resource-ready",
      params,
    });
  }

  /**
   * Request graceful shutdown of the Guest UI.
   *
   * The host MUST send this request before tearing down the UI resource (before
   * unmounting the iframe). This gives the Guest UI an opportunity to save state,
   * cancel pending operations, or show confirmation dialogs.
   *
   * The host SHOULD wait for the response before unmounting to prevent data loss.
   *
   * @param params - Empty params object
   * @param options - Request options (timeout, etc.)
   * @returns Promise resolving when Guest UI confirms readiness for teardown
   *
   * @example
   * ```typescript
   * try {
   *   await bridge.sendResourceTeardown({});
   *   // Guest UI is ready, safe to unmount iframe
   *   iframe.remove();
   * } catch (error) {
   *   console.error("Teardown failed:", error);
   * }
   * ```
   */
  sendResourceTeardown(
    params: McpUiResourceTeardownRequest["params"],
    options?: RequestOptions,
  ) {
    return this.request(
      <McpUiResourceTeardownRequest>{
        method: "ui/resource-teardown",
        params,
      },
      McpUiResourceTeardownResultSchema,
      options,
    );
  }

  private forwardRequest<
    Req extends ZodObject<{
      method: ZodLiteral<string>;
    }>,
    Res extends ZodObject<{}>,
  >(requestSchema: Req, resultSchema: Res) {
    this.setRequestHandler(requestSchema, async (request, extra) => {
      console.log(`Forwarding request ${request.method} from MCP UI client`);
      return this._client.request(request, resultSchema, {
        signal: extra.signal,
      });
    });
  }
  private forwardNotification<
    N extends ZodObject<{ method: ZodLiteral<string> }>,
  >(notificationSchema: N) {
    this.setNotificationHandler(notificationSchema, async (notification) => {
      console.log(
        `Forwarding notification ${notification.method} from MCP UI client`,
      );
      await this._client.notification(notification);
    });
  }

  /**
   * Connect to the Guest UI via transport and set up message forwarding.
   *
   * This method establishes the transport connection and automatically sets up
   * request/notification forwarding based on the MCP server's capabilities.
   * It proxies the following server capabilities to the Guest UI:
   * - Tools (tools/call, tools/list_changed)
   * - Resources (resources/list, resources/templates/list, resources/list_changed)
   * - Prompts (prompts/list, prompts/list_changed)
   *
   * After calling connect, wait for the `oninitialized` callback before sending
   * tool input and other data to the Guest UI.
   *
   * @param transport - Transport layer (typically PostMessageTransport)
   * @returns Promise resolving when connection is established
   *
   * @throws {Error} If server capabilities are not available
   *
   * @example
   * ```typescript
   * const bridge = new AppBridge(mcpClient, hostInfo, capabilities);
   * const transport = new PostMessageTransport(
   *   iframe.contentWindow!,
   *   iframe.contentWindow
   * );
   *
   * bridge.oninitialized = () => {
   *   console.log("Guest UI ready");
   *   bridge.sendToolInput({ arguments: toolArgs });
   * };
   *
   * await bridge.connect(transport);
   * ```
   */
  async connect(transport: Transport) {
    // Forward core available MCP features
    const serverCapabilities = this._client.getServerCapabilities();
    if (!serverCapabilities) {
      throw new Error("Client server capabilities not available");
    }

    if (serverCapabilities.tools) {
      this.forwardRequest(CallToolRequestSchema, CallToolResultSchema);
      if (serverCapabilities.tools.listChanged) {
        this.forwardNotification(ToolListChangedNotificationSchema);
      }
    }
    if (serverCapabilities.resources) {
      this.forwardRequest(
        ListResourcesRequestSchema,
        ListResourcesResultSchema,
      );
      this.forwardRequest(
        ListResourceTemplatesRequestSchema,
        ListResourceTemplatesResultSchema,
      );
      if (serverCapabilities.resources.listChanged) {
        this.forwardNotification(ResourceListChangedNotificationSchema);
      }
    }
    if (serverCapabilities.prompts) {
      this.forwardRequest(ListPromptsRequestSchema, ListPromptsResultSchema);
      if (serverCapabilities.prompts.listChanged) {
        this.forwardNotification(PromptListChangedNotificationSchema);
      }
    }

    // MCP-UI specific handlers are registered by the host component
    // after the proxy is created. The standard MCP initialization
    // (via oninitialized callback set in constructor) handles the ready signal.

    return super.connect(transport);
  }
}

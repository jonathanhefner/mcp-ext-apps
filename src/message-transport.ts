import {
  JSONRPCMessage,
  JSONRPCMessageSchema,
  MessageExtraInfo,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * JSON-RPC transport using window.postMessage for iframe↔parent communication.
 *
 * This transport enables bidirectional communication between MCP Apps running in
 * iframes and their host applications using the browser's postMessage API. It
 * implements the MCP SDK's Transport interface.
 *
 * ## Security
 *
 * The `eventSource` parameter provides origin validation by filtering messages
 * from specific sources. Guest UIs typically don't need to specify this (they only
 * communicate with their parent), but hosts should validate the iframe source for
 * security.
 *
 * ## Usage
 *
 * **Guest UI (default)**:
 * ```typescript
 * const transport = new PostMessageTransport(window.parent);
 * await app.connect(transport);
 * ```
 *
 * **Host (with source validation)**:
 * ```typescript
 * const iframe = document.getElementById('app-iframe') as HTMLIFrameElement;
 * const transport = new PostMessageTransport(
 *   iframe.contentWindow!,
 *   iframe.contentWindow  // Validate messages from this iframe only
 * );
 * await bridge.connect(transport);
 * ```
 *
 * @see {@link App.connect} for Guest UI usage
 * @see {@link AppBridge.connect} for Host usage
 */
export class PostMessageTransport implements Transport {
  private messageListener: (
    this: Window,
    ev: WindowEventMap["message"],
  ) => any | undefined;

  /**
   * Create a new PostMessageTransport.
   *
   * @param eventTarget - Target window to send messages to (default: window.parent)
   * @param eventSource - Optional source validation. If specified, only messages from
   *   this source will be accepted. Guest UIs typically don't need this (they only
   *   receive from parent), but hosts should validate the iframe source.
   *
   * @example Guest UI connecting to parent
   * ```typescript
   * const transport = new PostMessageTransport(window.parent);
   * ```
   *
   * @example Host connecting to iframe with validation
   * ```typescript
   * const iframe = document.getElementById('app') as HTMLIFrameElement;
   * const transport = new PostMessageTransport(
   *   iframe.contentWindow!,
   *   iframe.contentWindow  // Only accept messages from this iframe
   * );
   * ```
   */
  constructor(
    private eventTarget: Window = window.parent,
    private eventSource?: MessageEventSource,
  ) {
    this.messageListener = (event) => {
      if (eventSource && event.source !== this.eventSource) {
        console.error("Ignoring message from unknown source", event);
        return;
      }
      const parsed = JSONRPCMessageSchema.safeParse(event.data);
      if (parsed.success) {
        console.info("[host] Parsed message", parsed.data);
        this.onmessage?.(parsed.data);
      } else {
        console.error("Failed to parse message", parsed.error.message, event);
        this.onerror?.(
          new Error(
            "Invalid JSON-RPC message received: " + parsed.error.message,
          ),
        );
      }
    };
  }

  /**
   * Begin listening for messages from the event source.
   *
   * Registers a message event listener on the window. Must be called before
   * messages can be received.
   */
  async start() {
    window.addEventListener("message", this.messageListener);
  }

  /**
   * Send a JSON-RPC message to the target window.
   *
   * Messages are sent using postMessage with "*" origin, meaning they are visible
   * to all frames. The receiver should validate the message source for security.
   *
   * @param message - JSON-RPC message to send
   * @param options - Optional send options (currently unused)
   */
  async send(message: JSONRPCMessage, options?: TransportSendOptions) {
    console.info("[host] Sending message", message);
    this.eventTarget.postMessage(message, "*");
  }

  /**
   * Stop listening for messages and cleanup.
   *
   * Removes the message event listener and calls the onclose callback if set.
   */
  async close() {
    window.removeEventListener("message", this.messageListener);
    this.onclose?.();
  }

  /**
   * Called when the transport is closed.
   * @see {@link Transport.onclose}
   */
  onclose?: () => void;

  /**
   * Called when a message parsing error occurs.
   * @see {@link Transport.onerror}
   */
  onerror?: (error: Error) => void;

  /**
   * Called when a valid JSON-RPC message is received.
   * @see {@link Transport.onmessage}
   */
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  /**
   * Optional session identifier.
   * @see {@link Transport.sessionId}
   */
  sessionId?: string;

  /**
   * Callback to set the negotiated protocol version.
   * @see {@link Transport.setProtocolVersion}
   */
  setProtocolVersion?: (version: string) => void;
}

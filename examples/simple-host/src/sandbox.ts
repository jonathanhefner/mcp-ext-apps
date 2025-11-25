// Double-iframe raw HTML mode (HTML sent via postMessage)
const inner = document.createElement("iframe");
inner.style = "width:100%; height:100%; border:none;";
// sandbox will be set from postMessage payload; default minimal before html arrives
inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
document.body.appendChild(inner);

// Wait for HTML content from parent
window.addEventListener("message", async (event) => {
  if (event.source === window.parent) {
    if (
      event.data &&
      event.data.method === "ui/notifications/sandbox-resource-ready"
    ) {
      const { html, sandbox } = event.data.params;
      if (typeof sandbox === "string") {
        inner.setAttribute("sandbox", sandbox);
      }
      if (typeof html === "string") {
        inner.srcdoc = html;
      }
    } else {
      if (inner && inner.contentWindow) {
        inner.contentWindow.postMessage(event.data, "*");
      }
    }
  } else if (event.source === inner.contentWindow) {
    // Relay messages from inner to parent
    window.parent.postMessage(event.data, "*");
  }
});

// Notify parent that proxy is ready to receive HTML (distinct event)
window.parent.postMessage(
  {
    jsonrpc: "2.0",
    method: "ui/notifications/sandbox-proxy-ready",
    params: {},
  },
  "*",
);

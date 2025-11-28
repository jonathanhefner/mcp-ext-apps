import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { UI_RESOURCE_META_KEY } from "@modelcontextprotocol/ext-apps";


// Setup & run this STDIO server w/
// npm i @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps
// node server.js


const resourceUri = "ui://my-cool-app";
const resourceHtml = `
  <html>
  <head>
  <script type="module">
    import { App, PostMessageTransport } from "https://unpkg.com/@modelcontextprotocol/ext-apps";

    window.onload = async () => {
      const app = new App({ name: "Example UI", version: "1.0.0" });
      app.ontoolresult = ({ structuredContent }) => {
        document.getElementById("tool-result").innerText =
          JSON.stringify(structuredContent, null, 2);
      };
      await app.connect(new PostMessageTransport(window.parent));
    };
  </script>
  </head>
  <body>
    <div id="tool-result"></div>
  </body>
  </html>
`;

const server = new McpServer({ name: 'Quickstart Server', version: '1.0.0' });

server.registerResource('my-cool-app',
  resourceUri,
  { mimeType: "text/html+mcp" },
  () => { contents: [{ uri: resourceUri, text: resourceHtml }] },
);

server.registerTool('show-example',
  {
    _meta: { [UI_RESOURCE_META_KEY]: resourceUri },
    inputSchema: z.object({ message: z.string() }).shape,
  },
  ({ message }) => {
    return {
      content: [],
      structuredContent: { message: `Server received message: ${message}` }
    }
  }
);

server.server.connect(new StdioServerTransport())
  .then(() => console.error('Server is running'));

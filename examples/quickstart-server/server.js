// Setup & run this STDIO server w/
// npm i @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps
// node server.js
import { McpServer } from "@modelcontextprotocol/sdk/";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/";
import { UI_RESOURCE_META_KEY } from "@modelcontextprotocol/ext-apps";

const server = new McpServer({ name: 'Example Server', version: '1.0.0' });
const uiHtml = `
<html>
<head>
<script type="module">
import { App, PostMessageTransport } from "https://unpkg.com/@modelcontextprotocol/ext-apps";

window.onload = async () => {
  const app = new App({name: "Example UI", version: "1.0.0"});
  app.ontoolresult = ({structuredContent}) => {
    document.getElementById("tool-result").innerText = JSON.stringify(params, null, 2);
  }
  document.getElementById("alert-button").onclick = () => {
    app.sendOpenLink({url: "https://modelcontextprotocol.io"});
  }
  await app.connect(new PostMessageTransport(window.parent));
});
</script>
</head>
<body>
<div id="tool-result"></div>
<button id="alert-button"></button>
</body>
</html>
`;
const resourceUri = 'ui://page'
server.registerResource({ uri: resourceUri, ...., content: uiHtml })
server.registerTool('show-example', {
  inputSchema: z.object({ message: z.string() }).shape,
  _meta: {
    [UI_RESOURCE_META_KEY]: resourceUri,
  }
}, ({ message }) => {
  return {
    content: [],
    structuredContent: { message: `Server received message: ${message}` }
  }
})

server.server.connect(new StdioServerTransport())
  .then(() => console.error('Server is running');

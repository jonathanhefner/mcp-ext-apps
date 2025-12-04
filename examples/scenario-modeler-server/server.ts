import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RESOURCE_URI_META_KEY } from "../../dist/src/app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DIST_DIR = path.join(import.meta.dirname, "dist");

// ============================================================================
// Types
// ============================================================================

interface ScenarioInputs {
  startingMRR: number;
  monthlyGrowthRate: number;
  monthlyChurnRate: number;
  grossMargin: number;
  fixedCosts: number;
}

interface MonthlyProjection {
  month: number;
  mrr: number;
  grossProfit: number;
  netProfit: number;
  cumulativeRevenue: number;
}

interface ScenarioSummary {
  endingMRR: number;
  arr: number;
  totalRevenue: number;
  totalProfit: number;
  mrrGrowthPct: number;
  avgMargin: number;
  breakEvenMonth: number | null;
}

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  parameters: ScenarioInputs;
  projections: MonthlyProjection[];
  summary: ScenarioSummary;
  keyInsight: string;
}

// ============================================================================
// Calculations
// ============================================================================

function calculateProjections(inputs: ScenarioInputs): MonthlyProjection[] {
  const {
    startingMRR,
    monthlyGrowthRate,
    monthlyChurnRate,
    grossMargin,
    fixedCosts,
  } = inputs;

  const netGrowthRate = (monthlyGrowthRate - monthlyChurnRate) / 100;
  const projections: MonthlyProjection[] = [];
  let cumulativeRevenue = 0;

  for (let month = 1; month <= 12; month++) {
    const mrr = startingMRR * Math.pow(1 + netGrowthRate, month);
    const grossProfit = mrr * (grossMargin / 100);
    const netProfit = grossProfit - fixedCosts;
    cumulativeRevenue += mrr;

    projections.push({
      month,
      mrr,
      grossProfit,
      netProfit,
      cumulativeRevenue,
    });
  }

  return projections;
}

function calculateSummary(
  projections: MonthlyProjection[],
  inputs: ScenarioInputs
): ScenarioSummary {
  const endingMRR = projections[11].mrr;
  const arr = endingMRR * 12;
  const totalRevenue = projections.reduce((sum, p) => sum + p.mrr, 0);
  const totalProfit = projections.reduce((sum, p) => sum + p.netProfit, 0);
  const mrrGrowthPct =
    ((endingMRR - inputs.startingMRR) / inputs.startingMRR) * 100;
  const avgMargin = (totalProfit / totalRevenue) * 100;

  const breakEvenProjection = projections.find((p) => p.netProfit >= 0);
  const breakEvenMonth = breakEvenProjection?.month ?? null;

  return {
    endingMRR,
    arr,
    totalRevenue,
    totalProfit,
    mrrGrowthPct,
    avgMargin,
    breakEvenMonth,
  };
}

function buildTemplate(
  id: string,
  name: string,
  description: string,
  icon: string,
  parameters: ScenarioInputs,
  keyInsight: string
): ScenarioTemplate {
  const projections = calculateProjections(parameters);
  const summary = calculateSummary(projections, parameters);
  return { id, name, description, icon, parameters, projections, summary, keyInsight };
}

// ============================================================================
// Pre-defined Templates
// ============================================================================

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  buildTemplate(
    "bootstrapped",
    "Bootstrapped Growth",
    "Low burn, steady growth, path to profitability",
    "🌱",
    {
      startingMRR: 30000,
      monthlyGrowthRate: 4,
      monthlyChurnRate: 2,
      grossMargin: 85,
      fixedCosts: 20000,
    },
    "Profitable by month 1, but slower scale"
  ),
  buildTemplate(
    "vc-rocketship",
    "VC Rocketship",
    "High burn, explosive growth, raise more later",
    "🚀",
    {
      startingMRR: 100000,
      monthlyGrowthRate: 15,
      monthlyChurnRate: 5,
      grossMargin: 70,
      fixedCosts: 150000,
    },
    "Loses money early but ends at 3x MRR"
  ),
  buildTemplate(
    "cash-cow",
    "Cash Cow",
    "Mature product, high margin, stable revenue",
    "🐄",
    {
      startingMRR: 80000,
      monthlyGrowthRate: 2,
      monthlyChurnRate: 1,
      grossMargin: 90,
      fixedCosts: 40000,
    },
    "Consistent profitability, low risk"
  ),
  buildTemplate(
    "turnaround",
    "Turnaround",
    "Fighting churn, rebuilding product-market fit",
    "🔄",
    {
      startingMRR: 60000,
      monthlyGrowthRate: 6,
      monthlyChurnRate: 8,
      grossMargin: 75,
      fixedCosts: 50000,
    },
    "Negative net growth requires urgent action"
  ),
  buildTemplate(
    "efficient-growth",
    "Efficient Growth",
    "Balanced approach with sustainable economics",
    "⚖️",
    {
      startingMRR: 50000,
      monthlyGrowthRate: 8,
      monthlyChurnRate: 3,
      grossMargin: 80,
      fixedCosts: 35000,
    },
    "Good growth with path to profitability"
  ),
];

const DEFAULT_INPUTS: ScenarioInputs = {
  startingMRR: 50000,
  monthlyGrowthRate: 5,
  monthlyChurnRate: 3,
  grossMargin: 80,
  fixedCosts: 30000,
};

// ============================================================================
// Formatters for text output
// ============================================================================

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(2)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(absValue)}`;
}

function formatScenarioSummary(
  summary: ScenarioSummary,
  label: string
): string {
  return [
    `${label}:`,
    `  Ending MRR: ${formatCurrency(summary.endingMRR)}`,
    `  ARR: ${formatCurrency(summary.arr)}`,
    `  Total Revenue: ${formatCurrency(summary.totalRevenue)}`,
    `  Total Profit: ${formatCurrency(summary.totalProfit)}`,
    `  MRR Growth: ${summary.mrrGrowthPct.toFixed(1)}%`,
    `  Break-even: ${summary.breakEvenMonth ? `Month ${summary.breakEvenMonth}` : "Not achieved"}`,
  ].join("\n");
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new McpServer({
  name: "SaaS Scenario Modeler",
  version: "1.0.0",
});

// Zod schemas for tool registration
const ScenarioInputsSchema = z.object({
  startingMRR: z.number(),
  monthlyGrowthRate: z.number(),
  monthlyChurnRate: z.number(),
  grossMargin: z.number(),
  fixedCosts: z.number(),
});

const MonthlyProjectionSchema = z.object({
  month: z.number(),
  mrr: z.number(),
  grossProfit: z.number(),
  netProfit: z.number(),
  cumulativeRevenue: z.number(),
});

const ScenarioSummarySchema = z.object({
  endingMRR: z.number(),
  arr: z.number(),
  totalRevenue: z.number(),
  totalProfit: z.number(),
  mrrGrowthPct: z.number(),
  avgMargin: z.number(),
  breakEvenMonth: z.number().nullable(),
});

const ScenarioTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  parameters: ScenarioInputsSchema,
  projections: z.array(MonthlyProjectionSchema),
  summary: ScenarioSummarySchema,
  keyInsight: z.string(),
});

// Register tool and resource
{
  const resourceUri = "ui://scenario-modeler/mcp-app.html";

  server.registerTool(
    "get-scenario-data",
    {
      title: "Get Scenario Data",
      description:
        "Returns SaaS scenario templates and optionally computes custom projections for given inputs",
      inputSchema: {
        customInputs: ScenarioInputsSchema.optional().describe(
          "Custom scenario parameters to compute projections for"
        ),
      },
      outputSchema: {
        templates: z.array(ScenarioTemplateSchema),
        defaultInputs: ScenarioInputsSchema,
        customProjections: z.array(MonthlyProjectionSchema).optional(),
        customSummary: ScenarioSummarySchema.optional(),
      },
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async (args: {
      customInputs?: ScenarioInputs;
    }): Promise<CallToolResult> => {
      const result: {
        templates: ScenarioTemplate[];
        defaultInputs: ScenarioInputs;
        customProjections?: MonthlyProjection[];
        customSummary?: ScenarioSummary;
      } = {
        templates: SCENARIO_TEMPLATES,
        defaultInputs: DEFAULT_INPUTS,
      };

      if (args.customInputs) {
        result.customProjections = calculateProjections(args.customInputs);
        result.customSummary = calculateSummary(
          result.customProjections,
          args.customInputs
        );
      }

      // Build human-readable text output
      const textParts: string[] = [
        "SaaS Scenario Modeler",
        "=" .repeat(40),
        "",
        "Available Templates:",
        ...SCENARIO_TEMPLATES.map(
          (t) => `  ${t.icon} ${t.name}: ${t.description}`
        ),
        "",
      ];

      if (args.customInputs && result.customSummary) {
        textParts.push(formatScenarioSummary(result.customSummary, "Custom Scenario"));
      } else {
        textParts.push("Use customInputs parameter to compute projections for a specific scenario.");
      }

      return {
        content: [{ type: "text", text: textParts.join("\n") }],
        structuredContent: result,
      };
    }
  );

  server.registerResource(
    resourceUri,
    resourceUri,
    { description: "SaaS Scenario Modeler UI" },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8"
      );
      return {
        contents: [{ uri: resourceUri, mimeType: "text/html+mcp", text: html }],
      };
    }
  );
}

// ============================================================================
// Express Server
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const httpServer = app.listen(PORT, () => {
  console.log(
    `SaaS Scenario Modeler Server listening on http://localhost:${PORT}/mcp`
  );
});

function shutdown() {
  console.log("\nShutting down...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

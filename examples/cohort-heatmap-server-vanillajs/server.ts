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

// Types for cohort data
interface CohortCell {
  cohortIndex: number;
  periodIndex: number;
  retention: number;
  usersRetained: number;
  usersOriginal: number;
}

interface CohortRow {
  cohortId: string;
  cohortLabel: string;
  originalUsers: number;
  cells: CohortCell[];
}

interface CohortData {
  cohorts: CohortRow[];
  periods: string[];
  periodLabels: string[];
  metric: string;
  periodType: string;
  generatedAt: string;
}

interface RetentionParams {
  baseRetention: number;
  decayRate: number;
  floor: number;
  noise: number;
}

// Retention decay model: retention(t) = baseRetention * e^(-decayRate * t) + floor + noise
function generateRetention(period: number, params: RetentionParams): number {
  if (period === 0) return 1.0; // M0 is always 100%

  const { baseRetention, decayRate, floor, noise } = params;
  const base = baseRetention * Math.exp(-decayRate * (period - 1)) + floor;
  const variation = (Math.random() - 0.5) * 2 * noise;

  return Math.max(0, Math.min(1, base + variation));
}

function generateCohortData(
  metric: string,
  periodType: string,
  cohortCount: number,
  maxPeriods: number,
): CohortData {
  const now = new Date();
  const cohorts: CohortRow[] = [];
  const periods: string[] = [];
  const periodLabels: string[] = [];

  // Generate period headers
  const periodPrefix = periodType === "weekly" ? "W" : "M";
  const periodName = periodType === "weekly" ? "Week" : "Month";
  for (let i = 0; i < maxPeriods; i++) {
    periods.push(`${periodPrefix}${i}`);
    periodLabels.push(`${periodName} ${i}`);
  }

  // Retention parameters vary by metric type
  const paramsMap: Record<string, RetentionParams> = {
    retention: { baseRetention: 0.75, decayRate: 0.12, floor: 0.08, noise: 0.04 },
    revenue: { baseRetention: 0.70, decayRate: 0.10, floor: 0.15, noise: 0.06 },
    active: { baseRetention: 0.60, decayRate: 0.18, floor: 0.05, noise: 0.05 },
  };
  const params = paramsMap[metric] ?? paramsMap.retention;

  // Generate cohorts (oldest first)
  for (let c = 0; c < cohortCount; c++) {
    const cohortDate = new Date(now);
    if (periodType === "weekly") {
      cohortDate.setDate(cohortDate.getDate() - (cohortCount - 1 - c) * 7);
    } else {
      cohortDate.setMonth(cohortDate.getMonth() - (cohortCount - 1 - c));
    }

    const cohortId =
      periodType === "weekly"
        ? `${cohortDate.getFullYear()}-W${String(getWeekNumber(cohortDate)).padStart(2, "0")}`
        : `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;

    const cohortLabel =
      periodType === "weekly"
        ? `Week ${getWeekNumber(cohortDate)}, ${cohortDate.getFullYear()}`
        : cohortDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    // Random cohort size: 1000-5000 users
    const originalUsers = Math.floor(1000 + Math.random() * 4000);

    // Number of periods this cohort has data for (newer cohorts have fewer periods)
    const periodsAvailable = cohortCount - c;

    const cells: CohortCell[] = [];
    let previousRetention = 1.0;

    for (let p = 0; p < Math.min(periodsAvailable, maxPeriods); p++) {
      // Retention must decrease or stay roughly same (allow tiny increase for realism)
      let retention = generateRetention(p, params);
      retention = Math.min(retention, previousRetention + 0.02);
      previousRetention = retention;

      cells.push({
        cohortIndex: c,
        periodIndex: p,
        retention,
        usersRetained: Math.round(originalUsers * retention),
        usersOriginal: originalUsers,
      });
    }

    cohorts.push({ cohortId, cohortLabel, originalUsers, cells });
  }

  return {
    cohorts,
    periods,
    periodLabels,
    metric,
    periodType,
    generatedAt: new Date().toISOString(),
  };
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatCohortSummary(data: CohortData): string {
  const cells = data.cohorts.flatMap((c) => c.cells);
  const nonZeroCells = cells.filter((cell) => cell.periodIndex > 0);
  const avgRetention =
    nonZeroCells.length > 0
      ? nonZeroCells.reduce((sum, cell) => sum + cell.retention, 0) / nonZeroCells.length
      : 0;

  return `Cohort Analysis: ${data.cohorts.length} cohorts, ${data.periods.length} periods
Average retention: ${(avgRetention * 100).toFixed(1)}%
Metric: ${data.metric}, Period: ${data.periodType}`;
}

const server = new McpServer({
  name: "Cohort Heatmap Server",
  version: "1.0.0",
});

// Register the get-cohort-data tool and its associated UI resource
{
  const resourceUri = "ui://cohort-heatmap/mcp-app.html";

  server.registerTool(
    "get-cohort-data",
    {
      title: "Get Cohort Retention Data",
      description: "Returns cohort retention heatmap data for visualization",
      inputSchema: {
        metric: z
          .enum(["retention", "revenue", "active"])
          .optional()
          .default("retention")
          .describe("Metric type: retention %, revenue retention, or active users"),
        periodType: z
          .enum(["monthly", "weekly"])
          .optional()
          .default("monthly")
          .describe("Period granularity"),
        cohortCount: z
          .number()
          .min(3)
          .max(24)
          .optional()
          .default(12)
          .describe("Number of cohorts to generate"),
        maxPeriods: z
          .number()
          .min(3)
          .max(24)
          .optional()
          .default(12)
          .describe("Maximum number of periods to show"),
      },
      outputSchema: {
        cohorts: z.array(
          z.object({
            cohortId: z.string(),
            cohortLabel: z.string(),
            originalUsers: z.number(),
            cells: z.array(
              z.object({
                cohortIndex: z.number(),
                periodIndex: z.number(),
                retention: z.number(),
                usersRetained: z.number(),
                usersOriginal: z.number(),
              }),
            ),
          }),
        ),
        periods: z.array(z.string()),
        periodLabels: z.array(z.string()),
        metric: z.string(),
        periodType: z.string(),
        generatedAt: z.string(),
      },
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async (args): Promise<CallToolResult> => {
      const metric = (args.metric as string) ?? "retention";
      const periodType = (args.periodType as string) ?? "monthly";
      const cohortCount = (args.cohortCount as number) ?? 12;
      const maxPeriods = (args.maxPeriods as number) ?? 12;

      const data = generateCohortData(metric, periodType, cohortCount, maxPeriods);

      return {
        content: [{ type: "text", text: formatCohortSummary(data) }],
        structuredContent: data as unknown as { [key: string]: unknown },
      };
    },
  );

  server.registerResource(
    resourceUri,
    resourceUri,
    { description: "Cohort Retention Heatmap UI" },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

      return {
        contents: [{ uri: resourceUri, mimeType: "text/html+mcp", text: html }],
      };
    },
  );
}

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
  console.log(`Cohort Heatmap Server listening on http://localhost:${PORT}/mcp`);
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

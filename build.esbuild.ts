#!/usr/bin/env tsx
import { execSync } from "child_process";
import * as esbuild from "esbuild";

// Run TypeScript compiler for type declarations
execSync("tsc", { stdio: "inherit" });

const isDevelopment = process.env.NODE_ENV === "development";

// Build all JavaScript/TypeScript files
async function buildJs(
  entrypoint: string,
  opts: { outdir?: string; target?: "browser" | "node" } = {},
) {
  return esbuild.build({
    entryPoints: [entrypoint],
    outdir: opts.outdir ?? "dist",
    platform: opts.target === "node" ? "node" : "browser",
    format: "esm",
    bundle: true,
    minify: !isDevelopment,
    sourcemap: isDevelopment ? "inline" : false,
  });
}

await Promise.all([
  buildJs("src/app.ts", { outdir: "dist/src" }),
  buildJs("src/app-bridge.ts", { outdir: "dist/src" }),
  buildJs("src/react/index.tsx", { outdir: "dist/src/react" }),
]);

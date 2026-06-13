#!/usr/bin/env node
// deepseek-v4 MCP server
// Exposes two tools, `deepseek_v4_flash` and `deepseek_v4_pro`, that call
// DeepSeek through its Anthropic-compatible endpoint and return the result to
// the calling agent. stdio transport. Reads DEEPSEEK_API_KEY from env.
//
// Reference server for Part 4 of "Treat your AI coding agent like infrastructure".
// A thin adapter: the value is that MCP makes "another model" look like just
// another tool to the agent.
//
// Model IDs, parameter counts, and prices below are a snapshot. Names and
// pricing change; check DeepSeek's docs before relying on them.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";

// DeepSeek ships an Anthropic-compatible endpoint. The request is the Anthropic
// Messages format; only the base URL and key differ from an Anthropic call.
const API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/anthropic";
if (!process.env.DEEPSEEK_API_KEY) {
  console.error("FATAL: DEEPSEEK_API_KEY not set");
  process.exit(1);
}

const server = new McpServer({ name: "deepseek-v4", version: "1.0.0" });

// Tool definitions: what the agent sees when it calls list_tools.
server.tool(
  "deepseek_v4_flash",
  "Fast, cheap reasoning. 284B total / 13B active params, 1M context.",
  {
    prompt: z.string(),
    mode: z.enum(["non_thinking", "thinking", "think_max"]).default("non_thinking"),
    context: z.string().optional(),
    max_tokens: z.number().int().min(1).max(8192).default(4096),
    temperature: z.number().min(0).max(2).default(0.7),
  },
  (args) => callDeepSeek("deepseek-v4-flash", args)
);

server.tool(
  "deepseek_v4_pro",
  "Frontier reasoning. 1.6T total / 49B active params, 1M context.",
  {
    prompt: z.string(),
    mode: z.enum(["non_thinking", "thinking", "think_max"]).default("thinking"),
    context: z.string().optional(),
    max_tokens: z.number().int().min(1).max(16000).default(8000),
    temperature: z.number().min(0).max(2).default(0.6),
  },
  (args) => callDeepSeek("deepseek-v4-pro", args)
);

async function callDeepSeek(model, args) {
  const { prompt, mode, context, max_tokens, temperature } = args;

  // Extended thinking is the one Anthropic-format extension we toggle by mode.
  const thinkingBudget =
    mode === "think_max" ? 10000 :
    mode === "thinking"  ? 4000  : 0;
  const thinking =
    thinkingBudget > 0
      ? { type: "enabled", budget_tokens: thinkingBudget }
      : { type: "disabled" };

  const userContent = context ? `${context}\n\n---\n\n${prompt}` : prompt;
  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.DEEPSEEK_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens,
      temperature,
      messages: [{ role: "user", content: userContent }],
      thinking,
    }),
  });

  const latencyMs = Date.now() - startTime;
  if (!response.ok) {
    const err = await response.text();
    return { isError: true, content: [{ type: "text", text: `DeepSeek API ${response.status}: ${err.slice(0, 400)}` }] };
  }

  const data = await response.json();
  const text =
    (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n") || "(empty)";

  await logUsage({
    model,
    mode,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    latencyMs,
  });

  return { content: [{ type: "text", text }] };
}

async function logUsage({ model, mode, inputTokens, outputTokens, latencyMs }) {
  // USD per 1M tokens. Snapshot; verify before relying on these.
  const pricing = {
    "deepseek-v4-flash": { inPerMtok: 0.14,  outPerMtok: 0.28 },
    "deepseek-v4-pro":   { inPerMtok: 0.435, outPerMtok: 0.87 },
  };
  const p = pricing[model] ?? { inPerMtok: 0, outPerMtok: 0 };
  const estimatedCostUSD =
    (inputTokens / 1_000_000) * p.inPerMtok + (outputTokens / 1_000_000) * p.outPerMtok;

  const record = {
    ts: new Date().toISOString(),
    model,
    mode,
    inputTokens,
    outputTokens,
    estimatedCostUSD: +estimatedCostUSD.toFixed(6),
    latencyMs,
  };
  await fs.appendFile(new URL("./usage.jsonl", import.meta.url), JSON.stringify(record) + "\n").catch(() => {});
}

const transport = new StdioServerTransport();
await server.connect(transport);

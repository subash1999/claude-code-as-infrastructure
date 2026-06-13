# deepseek-v4 MCP server

A small stdio [MCP](https://modelcontextprotocol.io) server that exposes DeepSeek as two tools for an agent like Claude Code:

- `deepseek_v4_flash`: fast, cheap bulk worker (284B total / 13B active, 1M context)
- `deepseek_v4_pro`: frontier reasoning worker (1.6T total / 49B active, 1M context)

The interesting part: it talks to DeepSeek through DeepSeek's **Anthropic-compatible endpoint** (`https://api.deepseek.com/anthropic`). The request is the Anthropic Messages format (`POST /v1/messages`, `x-api-key`, `anthropic-version`, an optional `thinking` budget). Only the base URL and key differ from an Anthropic call.

Full write-up: Part 4 of [Treat your AI coding agent like infrastructure](../README.md).

## Install

```bash
npm install
cp .env.example .env   # add your DEEPSEEK_API_KEY
```

## Register with Claude Code

```bash
claude mcp add -s user --env=DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY deepseek-v4 -- node ./server.mjs
```

After this, `deepseek_v4_flash` and `deepseek_v4_pro` appear in the agent's tool list. It calls them like any other tool.

## Notes

- Each call appends a line to `usage.jsonl` (model, tokens, estimated cost, latency) so spend is visible at the code.
- List prices change; the `PRICE` map in `server.mjs` is a snapshot, verify before relying on it.
- The Anthropic-compatibility is a convenience, not a guarantee. If DeepSeek's endpoint drifts from the spec, the adapter breaks. Add a startup health check if you depend on it.
- Only route non-sensitive, scrubbed tasks here. See the [privacy firewall](../privacy/README.md) (Part 2) for keeping private context off a third-party endpoint.

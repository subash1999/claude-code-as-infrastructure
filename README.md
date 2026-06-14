# Treat your AI coding agent like infrastructure

![The six infrastructure disciplines applied to an AI coding agent: a capability-slot model registry, a directory-scoped privacy firewall, brain/hands cost routing, a custom MCP server, a self-updating config, and config-as-code.](diagrams/series-overview.png)

Reference code for a 6-part series on running [Claude Code](https://claude.com/claude-code) (and agents like it) the way you'd run infrastructure: versioned, multi-vendor, cost-aware, and security-scoped.

This is a **reference implementation**, not a drop-in product. The snippets are intentionally small and self-contained so you can lift the idea, not clone a setup. It is a personal config pattern, not production infrastructure.

## The idea

An AI coding agent's config is volatile (models change monthly), multi-vendor (you mix providers for cost and capability), and security-sensitive (it can send your files to a third party). That is exactly the kind of thing we already know how to manage. Each part of the series applies one ordinary engineering discipline to the agent config.

| Part | Discipline | What's here |
|---|---|---|
| 1. [Capability-slot model registry](#1-capability-slot-model-registry) | abstraction | [`model-registry.example.yaml`](./model-registry.example.yaml) · [`resolve.mjs`](./resolve.mjs) |
| 2. [Directory-scoped privacy firewall](#2-privacy-firewall) | security | [`privacy/`](./privacy/) |
| 3. [Brain and hands (cost routing)](#3-brain-and-hands) | cost engineering | [`routing/brain-and-hands.md`](./routing/brain-and-hands.md) |
| 4. [Custom MCP server → DeepSeek](#4-custom-mcp-server) | integration | [`deepseek-mcp-server/`](./deepseek-mcp-server/) |
| 5. [A config that updates itself](#5-self-updating-config) | operations | [`.github/workflows/meta-update.example.yml`](./.github/workflows/meta-update.example.yml) |
| 6. [Config as code](#6-config-as-code) | reproducibility | [`install.example.sh`](./install.example.sh) · [`RESTORE-PROMPT.md`](./RESTORE-PROMPT.md) |

> Medium links are added as each part publishes (one per week).

## Quickstart (the flagship: the MCP server)

The most reusable piece is the [`deepseek-mcp-server`](./deepseek-mcp-server/). It wraps DeepSeek as two MCP tools through DeepSeek's Anthropic-compatible endpoint:

```bash
cd deepseek-mcp-server
npm install
export DEEPSEEK_API_KEY=your-key            # https://platform.deepseek.com/api_keys
claude mcp add -s user --env=DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY deepseek-v4 -- node ./server.mjs
```

## Prior art (this is not invented here)

Capability-based model routing already exists in more complete forms: [LiteLLM](https://github.com/BerriAI/litellm) (proxy + model aliases), [OpenRouter](https://openrouter.ai) (many providers behind one API), and the [RouteLLM](https://github.com/lm-sys/RouteLLM) research line (route by difficulty). This repo is the small, personal version, useful for understanding the pattern and for a one-person setup. For anything bigger, reach for those.

## A note on DeepSeek

Several parts route bulk, non-sensitive work to DeepSeek for cost reasons. DeepSeek is a third-party (PRC-hosted) provider. The [privacy firewall](./privacy/) exists precisely so that sensitive context never reaches it: directory-scoped routing blocks the third-party path entirely in any folder marked sensitive. If your employer restricts external model vendors, check policy before doing the same.

## License

MIT. See [LICENSE](./LICENSE). Personal reference code, use at your own risk.

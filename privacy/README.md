# Directory-scoped privacy firewall (Part 2)

The constraint: some work routes to a cheap third-party model (Part 3), but some folders must never reach a third-party endpoint at all. So the **working directory is the trust boundary**. Start a session inside a folder you marked sensitive, and the whole session is locked to a trusted vendor; the third-party path is blocked.

This is data-loss-prevention / egress-filtering thinking, applied one layer up: instead of blocking data from leaving a network, you block it from being routed to a specific model endpoint.

## How it decides

You keep a list of path prefixes you have designated sensitive. At session start, the current working directory is checked against that list. If it matches, the session runs under the `pii_safe` policy: only the `pii_safe` slot (locked to a trusted vendor in the [registry](../model-registry.example.yaml)) can resolve. Any rule that reaches for `cheap_bulk` fails closed.

```js
import { selectPolicy } from "./routing-policy.example.mjs";
selectPolicy("/work/notes/_private/abc");   // -> "pii_safe"
selectPolicy("/work/code/some-project");     // -> "default"
```

**Describe sensitive folders by convention, not by category.** This example uses a `_private/` tag and a couple of marked prefixes. Do not hardcode category names that reveal what you protect, the folder names themselves would be the leak.

## Two layers

1. **Routing block** (above): the session cannot reach a third-party model.
2. **Memory drop**: a Stop-hook learnings extractor classifies anything it might save and drops the sensitive tier before writing, so private context never lands in long-lived agent memory. See [`routing-policy.example.mjs`](./routing-policy.example.mjs).

## What it does NOT catch (be honest)

- Secrets in environment variables.
- Sensitive strings inside file paths or filenames themselves.
- Clipboard or out-of-cwd tool reads.
- A crashed Stop hook (design it to **fail closed**: drop on classifier error, do not write).

It is policy enforcement at the routing layer, which depends on the routing layer being the only path to a model. "Firewall" communicates the intent; it is not a network-level guarantee. For a stricter threat model, add controls at the network layer too.

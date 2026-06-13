# Brain and hands: routing bulk work to a cheaper model (Part 3)

The expensive frontier model is the **brain**: orchestration, judgment, novel reasoning. A much cheaper model is the **hands**: bulk audit, review, summarize, classify, find. The price delta is the whole argument.

## The cost delta (USD per 1M tokens, snapshot 2026-06-10, verify before relying)

| Model | Input | Output | Notes |
|---|---|---|---|
| DeepSeek V4-Flash | 0.14 | 0.28 | 284B total / 13B active, 1M ctx |
| DeepSeek V4-Pro | 0.435 | 0.87 | 1.6T total / 49B active, 1M ctx |
| Sonnet-tier | ~3 | ~15 | |
| Opus-tier | ~15 | ~75 | |

So, with the date and the exact pair stated:

- Flash output (0.28) vs Sonnet output (15): about **53x** cheaper.
- Flash output (0.28) vs Opus output (75): about **268x** cheaper.
- Flash input (0.14) vs Sonnet input (3): about **21x** cheaper.

## The rule that actually matters

> Send a job to the cheap model only when a **wrong answer is cheap to catch**.

That means the output goes into a pipeline where a human or a stronger model reads it before anything acts on it. If verification is cheap, the whole chain is cheap. If verification is not cheap, the token savings are an illusion (a confident wrong answer on a high-stakes job costs more than it saves).

Good "hands" jobs: pre-commit audit passes, summarizing review comments before you read them, finding near-duplicate functions, grouping diff chunks before a human review.

## The inversion

Flash has a 1M-token context. For "find the needle in a huge haystack" tasks (which of 3,000 functions is most similar to this one), the cheap model's wide context is the brain: it scans everything and returns a small candidate set, then a stronger model reasons over just that set.

## The constraint

This only applies to non-sensitive, scrubbed tasks. The [privacy firewall](../privacy/) (Part 2) blocks anything touching a sensitive directory from reaching a third-party endpoint at all. The cheap model only ever sees what the firewall already cleared.

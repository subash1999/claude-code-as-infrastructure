# Tool-bridge: grounding a tool-less reasoner (Part 7 · capstone)

This part composes two earlier ones — the [privacy firewall](../privacy/) (Part 2) and
[brain and hands](./brain-and-hands.md) (Part 3) — for one hard case: **using a cheap
external model to review a change whose correctness depends on live state.**

The pattern is vendor-neutral. In this repo's setup the external reasoner is DeepSeek V4
(Part 4's [MCP server](../deepseek-mcp-server/)) and the hands are a cheaper in-house model,
but any tool-less external reasoner paired with any cheaper tool-capable executor works the
same way.

## The problem

A second opinion is most useful from a model that *isn't* your primary one — a different
vendor has different blind spots. But a cheap external reasoner has two limits:

1. **It has no tools.** It can't run `gh`, `aws`, `grep`, or read a file. It reasons in principle.
2. **It is stateless.** Every turn resends the whole transcript, so back-and-forth is expensive.

For a change whose correctness depends on live state — *does this IAM policy actually grant
the access? does this branch ruleset still block the bot? does the column this migration
drops still have readers?* — reasoning in principle produces **confident wrong answers**.
The model guesses the state and then reviews its own guess.

## The naive fixes, and why they fail

- **Paste everything up front.** You don't know what state the reviewer needs until it
  reasons. Over-paste and you bury the signal — and you may hand it something the firewall
  should have stopped.
- **Let it ask, turn by turn.** It works, but a stateless model resends the full context
  every turn. Ten clarifying questions is ten full-context calls. Slow, and no longer cheap.

## The pattern: enumerate → vet → execute → review

Bridge the model to tools through a gate you control. Four steps, ~2 external calls total:

1. **Enumerate (1 external call).** Send the task + diff. Ask the reasoner to list —
   exhaustively, in one shot — every piece of live state it needs, each as
   `{intent, suggested read-only command}`. Pin the output to a list and nothing else.
2. **Vet (orchestrator — never delegated).** Filter the list against a **read-only
   allowlist**. Reject every write, every secret read, anything outside the task's scope.
   See [`vet-commands.example.mjs`](./vet-commands.example.mjs). This is the security gate.
3. **Execute (cheap hands, in parallel).** A cheap in-house model with tool access (the
   "hands" from Part 3) runs the *vetted* commands and returns raw output verbatim.
   Constrain it: run exactly these, return raw, improvise nothing.
4. **Review grounded (1 external call).** Resend task + diff + all command output → verdict.
   Allow one more round only if the reasoner names a concrete missing fact; loop back to
   step 2 with just the delta. **Hard cap: 2 rounds.**

This collapses N round-trips into ~2 external calls. The reasoner reasons in *intent*; you
vet; the hands run.

```
        diff + task
            │
            ▼
   ┌──────────────────┐   "I need state X, Y, Z          (1 external call)
   │ external reasoner │──▶ as read-only commands"
   └──────────────────┘
            │  proposed commands
            ▼
   ┌──────────────────┐   read-only allowlist, fail closed  (orchestrator —
   │   VET (you own)   │   reject writes / secrets / OOS      never delegated)
   └──────────────────┘
            │  vetted commands only
            ▼
   ┌──────────────────┐   runs exactly these, returns raw   (cheap in-house
   │   cheap hands     │                                       hands, parallel)
   └──────────────────┘
            │  raw outputs
            ▼
   ┌──────────────────┐   verdict, grounded in real state   (1 external call;
   │ external reasoner │                                       ≤1 more round)
   └──────────────────┘
```

## The crux: an external model is choosing your commands

Step 2 is the whole point. You are letting a third-party model *propose* what runs against
your accounts and repos. The orchestrator — not the external model, not the hands — decides
what actually executes. So the allowlist is strict and **fails closed**:

- **Allow** read verbs only: `gh api` (GET), `aws … describe-* / get-* / list-*`,
  `git log/show/diff`, `grep`, `cat`, `jq`.
- **Reject** any mutation (`put-*`, `update-*`, `create`, `delete`,
  `--method PUT/POST/PATCH/DELETE`, `push`, `rm`), any secret read (`get-secret-value`,
  decrypted SSM, `.env`, private keys), anything outside the task's repos/accounts, and any
  shell trick that hides one of these (chaining, subshells, redirection, pipe-to-shell).
- **When in doubt, reject.** A rejected command costs one clarifying round. A mutation
  chosen by an external model and actually run costs much more.

## What never crosses the bridge

The command *outputs* go back to the external (third-party) model, so the Part 2 firewall
rule still holds: nothing sensitive crosses. The allowlist already blocks secret reads; the
firewall already blocks sensitive directories from reaching a third party at all.
Infrastructure posture (IAM, rulesets, workflow YAML) is fine to bridge; customer data, PII,
and credentials are not.

## When not to use it

- The change isn't state-dependent (pure logic, local refactor) — review it directly.
- The state is small and you already have it — paste it, skip the dance.
- The review is high-stakes *and* the external vendor is disallowed by policy — keep it
  in-house (Part 2 already forces this in sensitive directories).

## Why it's worth the ceremony

A one-shot external review of a state-dependent change is a guess dressed as a verdict.
Tested on a real CI permissions/ruleset fix, a one-shot external review picked the *wrong*
fix — it assumed how the rulesets composed. Through the bridge, the model enumerated the
read-only state it needed, the orchestrator vetted the list down to the essential queries,
cheap hands ran them once, and the **grounded** re-review flipped to the correct fix — and
additionally caught a second blocker (an independent ruleset that also required review) that
no tool-less model could have known. Cost: ~2 external calls plus one batch of cheap-hands
execution. The cheap external eye becomes trustworthy exactly when its answer is grounded in
state you let it see — through a gate you control.

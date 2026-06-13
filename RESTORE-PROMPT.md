# The AI restore prompt (Part 6)

The novel bit of "config as code" for an *agent*: you do not run the setup yourself, you paste a prompt into a fresh machine's agent and it bootstraps its own environment, stopping before anything destructive.

Paste this into Claude Code (or any capable coding agent) on a clean machine:

```text
You are setting up my AI coding agent configuration on a fresh machine from a
public git repo. Do this end to end, confirming before any destructive step.

1. Verify the CLI is installed (`claude --version`). If missing, tell me and stop.
2. If a config dir already exists at ~/.claude, back it up:
   `mv ~/.claude ~/.claude.legacy-$(date +%Y%m%d)`. Confirm with me first.
3. Clone the repo as the config dir: `git clone https://github.com/subash1999/claude-code-as-infrastructure ~/.claude`.
4. Read ~/.claude/install.example.sh. Summarize what it will do in 5 bullets.
   Ask me to confirm before running it.
5. On confirmation, run it. Stream the output. On any failure, stop and report.
6. Check env vars: ANTHROPIC_API_KEY and DEEPSEEK_API_KEY. Tell me which are missing.
7. Run `claude mcp list` and report each server's status. For anything needing
   OAuth, tell me which tool to invoke from inside a session to finish login.
8. Tell me what still needs my manual action (secrets, MCP auth, machine config).
9. Do NOT push or modify the repo. Do NOT delete the legacy backup.

Stop after step 8 and wait for me.
```

## What a repo restore can NOT bring back

The repo restores the **skeleton**, not the credentials or live state:

- **Secrets / API keys** live in env vars and are never committed. You re-add them.
- **MCP OAuth tokens** are cached per machine. You re-authenticate each integration on first use.
- **Local model state**, caches, and anything machine-specific are not in the repo.

After the restore prompt runs, the agent is structurally correct and will not route anything wrong. It is missing the secrets and session auth. You supply those, then it is fully operational.

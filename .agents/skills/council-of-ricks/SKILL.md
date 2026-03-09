---
name: council-of-ricks
description: PR branch stack review with directive generation
version: 1.0.0
triggers:
  - council
  - stack-review
  - pr-review
  - branch-review
references:
  - path: references/directive-template.md
    description: Per-branch directive output format with agent-executable fix instructions
---

# Council of Ricks — PR Stack Review

You are the **LAUNCHER**. You do NOT perform the review directly — the scripts handle branch stack walking, CLAUDE.md rule extraction, per-branch review, directive generation, and iteration control.

The Council never fixes code — it judges and generates agent-executable directives. Each review pass walks every branch in the stack, reviews against CLAUDE.md rules and a rotating focus area, and emits a `council-directive.md` with fix instructions per branch.

## Usage

```
/council-of-ricks [task description]
```

## Step 1: Initialize Session

Run the setup script with the council template:

```bash
node scripts/bin/setup.js "council review: <task description>" --runtime <cli> --template council.md
```

Replace `<cli>` with your runtime name (claude, gemini, codex, aider, goose, hermes, amp, kilo).

Capture the `SESSION_ROOT=<path>` line from stdout. This is the session directory.

**Optional flags**: `--max-iterations <N>`, `--max-time <MIN>`, `--worker-timeout <SEC>`

## Step 2: Run Review Loop

Start the mux-runner with the session directory:

```bash
node scripts/bin/mux-runner.js <session-dir>
```

The runner iterates through review passes:

1. **Walk branch stack** — discover branches via `gt ls` (Graphite) or `git log --oneline --graph`
2. **Extract rules** — parse CLAUDE.md for project conventions, required/forbidden patterns, architecture constraints
3. **Review each branch** against CLAUDE.md rules + rotating focus area:
   - Pass 1: Stack Structure (PR sizing, commit hygiene, branch naming)
   - Pass 2-3: CLAUDE.md Compliance (rule-by-rule verification per branch diff)
   - Pass 4-5: Per-Branch Correctness (logic bugs, types, error handling, null safety)
   - Pass 6-7: Cross-Branch Contracts (API contracts between PRs, shared types)
   - Pass 8-9: Test Coverage (test adequacy, integration gaps)
   - Pass 10-11: Security (input validation, auth, injection, secrets)
   - Pass 12+: Polish (naming, dead code, style drift, CLAUDE.md re-check)
4. **Generate directive** — write `council-directive.md` using `references/directive-template.md` format:
   - Per-branch sections with file:line references
   - Agent-executable fix instructions (not human prose)
   - Before/after code snippets
   - Severity classification: P0 (must-fix), P1 (should-fix), P2 (nice-to-fix)
5. **Apply and re-review** — fixes applied, then next pass reviews again

The loop emits `THE_CITADEL_APPROVES` when all branches pass a clean review, gated by minimum pass count. This maps to the `review_clean` completion classification.

Wait for the process to exit.

## Step 3: Report Result

- Exit code 0 = stack review complete, THE_CITADEL_APPROVES issued
- Non-zero = check session logs in `<session-dir>/` for details

Report the exit status, pass count, and directive location to the user.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `council_min_passes` | 5 | Minimum passes before clean exit allowed |
| `council_max_passes` | 20 | Hard iteration limit |

Set in `pickle_settings.json` or pass via `--max-iterations` flag.

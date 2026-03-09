<p align="center">
  <img src="images/architecture.png" alt="Pickle Rick Skills Architecture" width="100%" />
</p>

# Pickle Rick Skills — Architecture

Deep-dive internals for the Pickle Rick engineering lifecycle. For usage, commands, and quick start, see the [README](README.md).

---

## Circuit Breaker — Runaway Session Protection

> *"You know what's worse than a bug, Morty? An infinite loop that keeps making the same bug. Over and over. Burning tokens like Jerry burns goodwill."*

Long-running autonomous sessions can get stuck — same error repeating, no git progress, the model spinning its wheels. The circuit breaker detects these failure modes and stops the session before it wastes hours.

### How It Works

The circuit breaker is a three-state machine integrated into `mux-runner`. After every iteration, it checks two signals:

**Progress detection** — Runs `git diff --stat` (staged + unstaged) and `git rev-parse HEAD` against the last known state. Also tracks lifecycle transitions (step changes, ticket changes). If any of these changed, the iteration made progress. First-iteration warm-up always counts as progress (no baseline to compare).

**Error signature extraction** — Parses the iteration's NDJSON output for `result.subtype` starting with `"error"`. If found, extracts the last assistant text block and normalizes it: paths → `<PATH>`, line:column → `<N>:<N>`, timestamps → `<TS>`, UUIDs → `<UUID>`, whitespace collapsed, truncated to 200 chars. Exit codes are preserved (they're diagnostic). Two iterations hitting the same normalized signature count as the same error.

### State Transitions

```
                     progress detected
            ┌────────────────────────────────┐
            │                                │
            ▼                                │
        ┌────────┐  no progress ≥ 2  ┌───────────┐  no progress ≥ 5  ┌────────┐
        │ CLOSED │ ──────────────►  │ HALF_OPEN │ ──────────────►  │  OPEN  │
        │(normal)│                   │ (warning) │                   │ (stop) │
        └────────┘                   └───────────┘                   └────────┘
            ▲                                │                           │
            │         progress detected      │                           │
            └────────────────────────────────┘                           │
                                                                         ▼
                                                              Session terminated
                                                              reason logged
```

- **CLOSED** (normal): Every iteration with progress resets the counter.
- **HALF_OPEN** (warning): After `cb_half_open_after` (default: 3) consecutive no-progress iterations. One more progress iteration → back to CLOSED.
- **OPEN** (stop): After `cb_no_progress_threshold` (default: 5) consecutive no-progress iterations, OR `cb_error_threshold` (default: 3) consecutive identical error signatures. Session terminates with a diagnostic message.

### Manual Recovery

If the circuit breaker trips and you want to continue:

```bash
# Reset the circuit breaker state file and resume
# Delete circuit_breaker.json from the session directory, then:
/pickle-rick --resume <session-path>
```

### Disabling

Set `cb_enabled: false` in `~/.pickle-rick-skills/config.json`.

---

## Rate Limit Auto-Recovery

> *"Oh, you thought we'd just... stop? Because some API said 'too many requests'? Morty, I once escaped a galactic prison using a AAA battery and spite."*

When a CLI agent hits an API rate limit during a session, the runner detects it, computes the optimal wait duration, pauses, and resumes automatically.

### How It Works

The mux-runner classifies every iteration's exit into one of: `completed_normally`, `completed_with_error`, `rate_limited`, `timed_out`, `unknown`. Rate limit detection uses two signals:

1. **Exit code patterns** — CLI-specific rate limit exit codes (e.g., exit code 2 for Claude Code)
2. **Structured events** — NDJSON line with `type: "system"` and `subtype: "rate_limit_event"` containing `rate_limit_type` (e.g., `"five_hour"`, `"daily"`) and `resets_at_epoch` (Unix timestamp)
3. **Text pattern matching** — Stderr/stdout scanning for rate limit keywords when structured events aren't available

### Wait-and-Resume Cycle

```
Iteration exits with rate limit
         │
         ▼
Parse output for rate_limit_event
         │
    ┌────┴─────┐
    │ Found?   │
    └────┬─────┘
    Yes  │        No
    │    │        │
    ▼    │        ▼
Compute wait from          Use static config default
resetsAt epoch + 30s       (rate_limit_wait_minutes)
buffer, cap at 3×
config default
    │                      │
    └──────────┬───────────┘
               ▼
Write rate_limit_wait.json
  { waiting, wait_until, consecutive_waits,
    rate_limit_type, resets_at_epoch, wait_source }
               │
               ▼
┌─────────────────────────────────────────┐
│  Sleep loop (checks every 10s):        │
│  • Check if wait_until has passed       │
│  • Check state.json active flag         │
│  • Check session time limit             │
│  • Cancel sets active=false → exit      │
└──────────────┬──────────────────────────┘
               │ timer expires
               ▼
Delete rate_limit_wait.json
Write handoff prompt (resume instructions)
Continue loop → next iteration
```

**Key behavior**: When `resetsAt` is available from the API, the runner **always waits** — it never exhausts retries when the API told us exactly when to come back. The consecutive retry counter only triggers a bail when there's no `resetsAt` signal.

**Consecutive limit**: After `max_rate_limit_retries` (default: 3) consecutive rate limits without a successful iteration between them — and without a `resetsAt` signal — the runner exits with `rate_limit_exhausted`. A successful iteration resets the counter.

**Time-limit aware**: If the computed wait would exceed the session's `max_time_minutes`, the wait is clamped to the remaining time (or the session exits immediately if time is already up).

**Smart backoff**: When a structured `rate_limit_event` is available, the runner uses the API's `resetsAt` epoch to compute the exact wait duration (+ 30s buffer). This avoids both under-waiting (resuming before the window opens) and over-waiting (sitting idle for 60 minutes when the limit resets in 12). The API wait is capped at 3× `rate_limit_wait_minutes` to prevent multi-day limits from hanging a session — if the reset is too far out, the static config default is used instead.

### Settings

| Setting | Default | Description |
|---|---|---|
| `rate_limit_wait_minutes` | 60 | Fallback wait duration when no API reset time is available. Also used as the base for the 3× cap on API-derived waits |
| `max_rate_limit_retries` | 3 | Consecutive rate limits (without resetsAt) before giving up |
| `rate_limit_poll_ms` | 10000 | How often to check during a wait (ms) |

---

## Metrics Internals

`/pickle-metrics` aggregates CLI agent usage across all your projects — event counts, commits, and lines of code changed — into a daily or weekly breakdown.

### What It Reports

- **Events**: Notable session events (ticket transitions, phase changes, errors) from activity logs
- **Commits**: Git commit count per repo per day (via `git log`)
- **Lines +/-**: Lines added and removed across all tracked repos
- **Per-project breakdown**: Each project's contribution to the totals
- **Weekly trends**: Week-over-week output delta and top project per week

Data sources: activity JSONL files in `~/.pickle-rick-skills/activity/` for events, `git log --numstat` across repos under `~/loanlight/` (configurable via `METRICS_REPO_ROOT`) for LOC. Results are cached to `metrics-cache.json` to avoid re-parsing unchanged files.

---

## Portal Gun Internals

### How It Works

1. **Open Portal** — Fetches the donor code (GitHub API, local copy, npm registry, or synthesizes from description). Saves to `portal/donor/`
2. **Pattern Extraction** — Analyzes the donor: structural pattern, invariants, edge cases, anti-patterns → `pattern_analysis.md`
3. **Target Analysis** — Studies your codebase: conventions, integration points, conflicts, adaptation requirements → `target_analysis.md`
4. **PRD Synthesis** — Generates a transplant PRD with a Behavioral Validation Tests table mapping donor behavior to expected target behavior, with donor file references for workers
5. **Refinement Cycle** — Three parallel analysts (Requirements, Codebase Context, Risk & Scope) validate the transplant PRD against donor invariants and target constraints. Portal artifacts give them extra context a normal refinement wouldn't have
6. **Pattern Library** — Saves extracted patterns to `~/.pickle-rick-skills/patterns/` for reuse in future portal-gun sessions. Use `--save-pattern <name>` to persist, or patterns stay in the session directory
7. **Handoff** — Resume with `/pickle-rick --resume` to execute the transplant PRD

### Flags

| Flag | Effect |
|------|--------|
| `--run` | Auto-launch session after PRD is ready |
| `--meeseeks` | Chain Meeseeks review after execution (implies `--run`) |
| `--target <path>` | Target repo (default: cwd) |
| `--depth shallow\|deep` | `shallow` = summary, structural pattern, and invariants only; `deep` = full analysis (default) |
| `--no-refine` | Skip the automatic refinement cycle |
| `--save-pattern <name>` | Persist extracted pattern to global library for future reuse |
| `--cycles <N>` | Number of refinement cycles (default: 3) |
| `--max-turns <N>` | Max turns per refinement worker (default: 100) |

---

## Project Mayhem Internals

Every module follows the same **Chaos Cycle**: read original → apply one mutation → run tests → record result → `git checkout` revert → verify revert. One mutation at a time, always reverted, always verified.

**Module 1 — Mutation Testing**: Finds high-value mutation sites in your source code (conditionals, comparisons, boolean literals, guard clauses, error handlers) and applies operators like boolean flip, comparison inversion, boundary shift, operator swap, condition negation, guard removal, and empty catch. If tests still pass after a mutation (a "survivor"), that's a test coverage gap. Survivors are severity-rated: Critical (auth/security/validation), High (business logic), Medium (utilities), Low (display/logging).

**Module 2 — Dependency Armageddon**: Selects 5-10 key direct dependencies — prioritizing the most imported, foundational, and security-sensitive — and downgrades each to the previous major version one at a time. Tracks install failures, test breakages (with error messages), and backward-compatible deps. Also runs a phantom dependency check to find imports that work by accident via transitive dependencies.

**Module 3 — Config Resilience**: Discovers runtime config files (JSON, YAML, .env, INI — excluding build tooling), then applies corruption strategies: truncation (50%), empty file, missing keys, wrong types, prototype pollution payloads (`__proto__`), and invalid syntax. Tests whether the app handles each corruption gracefully or crashes.

### The Report

After all modules run, a `project_mayhem_report.md` is written to the project root with:

- **Chaos Score** (0–100): weighted average — Mutation 50%, Deps 25%, Config 25%
- **Mutation survivors table**: file:line, operator, original → mutated, severity
- **Dependency breakages**: package, version tested, error summary
- **Phantom dependencies**: imports not declared in the manifest
- **Config crashes**: file, corruption strategy, exit code, error
- **Prioritized recommendations**: what to fix first based on severity

### Safety Guarantees

- Requires clean git state — refuses to run with uncommitted changes
- Records `HEAD` SHA before starting, verifies it hasn't changed at the end
- Every individual mutation is reverted immediately via `git checkout -- <file>`
- Dependency downgrades restore the original lockfile + re-install after each test
- Final verification: `git diff` must be empty, tests must pass
- On any error: `git checkout .` + restore deps before reporting

---

## GitNexus Integration

Pickle Rick Skills integrates with [GitNexus](https://gitnexus.dev), an MCP-powered code knowledge graph that indexes your codebase into symbols, relationships, and execution flows. Once indexed, every worker subprocess automatically inherits GitNexus awareness — no manual setup per ticket.

- **Explore architecture** — trace execution flows, understand how modules connect, answer "how does X work?"
- **Impact analysis** — before changing shared code, see the blast radius: direct callers, affected processes, risk level
- **Safe refactoring** — multi-file coordinated renames using graph + text search, tagged by confidence
- **Bug tracing** — follow call chains from symptom to root cause across file boundaries
- **Change detection** — map uncommitted diffs to affected execution flows before you commit

### Setup

```bash
# Index the current repo (run from project root)
npx gitnexus analyze

# Verify the index
npx gitnexus status
```

GitNexus runs as an MCP server. Once indexed, workers spawned by the lifecycle get GitNexus tool access injected automatically. The SKILL.md instructions for exploring, impact analysis, debugging, and refactoring expose guided workflows for each capability.

---

## Directory Structure

```
pickle-rick-skills/
├── .agents/
│   └── skills/                    # agentskills.io skill definitions
│       ├── pickle-rick/SKILL.md       # Main lifecycle loop
│       ├── pickle-prd/SKILL.md        # PRD drafter
│       ├── pickle-refine-prd/SKILL.md # PRD refinement + decomposition
│       ├── meeseeks/SKILL.md          # Code review loop (10-50 passes)
│       ├── council-of-ricks/SKILL.md  # PR stack review with directives
│       ├── portal-gun/SKILL.md        # Cross-repo pattern transplant
│       ├── project-mayhem/SKILL.md    # Chaos engineering
│       ├── pickle-jar/SKILL.md        # Batch queue execution
│       ├── pickle-metrics/SKILL.md    # Developer metrics reporter
│       └── pickle-standup/SKILL.md    # Standup summary formatter
├── scripts/
│   ├── src/                       # TypeScript sources (canonical — never edit .js directly)
│   │   ├── bin/                   # → compiles to scripts/bin/
│   │   ├── services/              # → compiles to scripts/bin/services/
│   │   └── types/                 # → compiles to scripts/bin/types/
│   ├── bin/                       # Compiled JS (build artifacts)
│   │   ├── setup.js               # Session initializer + config validation
│   │   ├── mux-runner.js          # Main iteration loop (classify, transition, circuit break)
│   │   ├── spawn-worker.js        # CLI subprocess spawner (timeout + SIGTERM/SIGKILL escalation)
│   │   ├── spawn-morty.js         # Worker lifecycle orchestrator per ticket
│   │   ├── spawn-refinement-team.js # 3 parallel analysts × N cycles for PRD refinement
│   │   ├── jar-runner.js          # Night-shift batch queue executor
│   │   ├── metrics.js             # Token/commit/LOC aggregation reporter
│   │   ├── standup.js             # Activity summary formatter
│   │   ├── log-activity.js        # NDJSON event logger CLI
│   │   ├── monitor.js             # Live tmux dashboard (optional)
│   │   ├── log-watcher.js         # Live log stream (optional tmux pane)
│   │   ├── morty-watcher.js       # Live worker log stream (optional tmux pane)
│   │   ├── get-session.js         # Session path resolver
│   │   ├── update-state.js        # State mutation helper
│   │   ├── status.js              # Session status display
│   │   ├── cancel.js              # Loop canceller
│   │   └── services/              # Shared service modules
│   │       ├── config.js              # Runtime registry + config loading (8 CLIs)
│   │       ├── circuit-breaker.js     # 3-state circuit breaker
│   │       ├── rate-limit.js          # Rate limit detection + wait management
│   │       ├── degenerate-detector.js # Repeated output / infinite loop detection
│   │       ├── runtime-adapter.js     # CLI-specific command building
│   │       ├── session-map.js         # Session discovery + O_EXCL file locking
│   │       ├── activity-logger.js     # NDJSON event logging
│   │       ├── jar-utils.js           # Pickle jar queue management
│   │       └── metrics-utils.js       # Git log parsing + LOC counting
│   ├── tests/                     # Test suite (node --test, 374 tests)
│   ├── package.json               # "type": "module"
│   └── tsconfig.json              # TypeScript config (strict, ESNext)
├── images/                        # README assets
├── persona.md                     # Optional Pickle Rick persona snippet
├── pickle_settings.json           # Legacy settings (prefer ~/.pickle-rick-skills/config.json)
├── install.sh                     # Installer (detects CLIs, writes config, copies skills)
├── package.json                   # Root package
└── CLAUDE.md                      # Worker context for Claude Code
```

---

## State & Session Management

Every Pickle Rick session creates a directory under `~/.pickle-rick-skills/sessions/<date-hash>/` with a `state.json` that tracks live execution state:

```json
{
  "active": true,
  "working_dir": "/path/to/project",
  "step": "implement",
  "iteration": 7,
  "max_iterations": 100,
  "max_time_minutes": 120,
  "worker_timeout_seconds": 1200,
  "start_time_epoch": 1772287760,
  "current_ticket": "feat-03",
  "tmux_mode": false,
  "chain_meeseeks": false,
  "history": []
}
```

The mux-runner reads `state.json` between iterations to build the handoff summary. Status commands read it for the dashboard. Workers never modify `state.json` — only the orchestrator writes to it.

### Session Logs & Artifacts

Each session directory accumulates execution traces and work products:

```
~/.pickle-rick-skills/sessions/2026-03-08-a1b2c3d4/
├── state.json                          # Live state (see above)
├── circuit_breaker.json                # Circuit breaker state (when enabled)
├── rate_limit_wait.json                # Rate limit countdown (transient — deleted on resume)
├── prd.md                              # The PRD for this epic
├── prd_refined.md                      # Refined PRD (after /pickle-refine-prd)
├── linear_ticket_parent.md             # Parent ticket with all sub-tickets
├── mux-runner.log                      # Orchestrator-level log
├── iteration_1.log                     # Per-iteration NDJSON stdout
├── iteration_1.exitcode                # Subprocess exit code for post-mortem
├── iteration_2.log
├── meeseeks-summary.md                 # Meeseeks audit trail (when review runs)
├── feat-01/
│   ├── linear_ticket_feat-01.md        # Ticket specification
│   ├── research_feat-01.md             # Research phase output
│   ├── research_review.md              # Research review
│   ├── plan_feat-01.md                 # Implementation plan
│   ├── plan_review.md                  # Plan review
│   └── worker_session_12345.log        # Worker subprocess stdout
├── feat-02/
│   └── ...
└── refinement/                         # PRD refinement worker logs
    ├── worker_requirements_c1.log      # Requirements analyst (cycle 1)
    ├── worker_codebase_c1.log          # Codebase analyst (cycle 1)
    └── worker_risk-scope_c1.log        # Risk/scope analyst (cycle 1)
```

**Log types:**

| Log | What it captures |
|-----|------------------|
| `mux-runner.log` | Iteration lifecycle: spawn, wait, classify completion, advance or stop |
| `iteration_N.log` | Raw NDJSON from CLI subprocess per iteration |
| `worker_session_<pid>.log` | Full worker subprocess output — research, planning, implementation, test runs |
| `worker_<role>_c<N>.log` | PRD refinement analyst output per role per cycle |
| `meeseeks-summary.md` | Per-pass table of issues found/fixed, test status, commit hashes |
| `circuit_breaker.json` | Circuit breaker state: `state` (CLOSED/HALF_OPEN/OPEN), counters, `lastError`, `reason` |
| `rate_limit_wait.json` | Transient: `waiting`, `wait_until` (ISO), `consecutive_waits`, `rate_limit_type`, `resets_at_epoch`, `wait_source` (`"api"`/`"config"`). Deleted on resume |

**Ticket artifacts** follow the lifecycle phases: `research_<id>.md` → `research_review.md` → `plan_<id>.md` → `plan_review.md` → implementation (code changes + commits). These persist in the session directory and can be reviewed after the run.

### Activity Log (Standup Data)

The activity logger writes a date-keyed JSONL file for every notable event — ticket transitions, commits, phase changes, errors:

```
~/.pickle-rick-skills/activity/
├── 2026-03-07.jsonl
└── 2026-03-08.jsonl
```

`/pickle-standup` reads these to produce a formatted standup summary. Old files are pruned during session setup.

### Global Config

`~/.pickle-rick-skills/config.json` stores all configurable defaults — max iterations, timeouts, circuit breaker thresholds, rate limit settings, meeseeks pass limits, refinement cycles, and per-CLI runtime configurations. See [Configuration](README.md#%EF%B8%8F-configuration) in the README.

### How the Systems Connect

```
Config (config.json)                   SKILL.md Instructions
   │ read at session setup                │ read by agent each iteration
   │                                      │
   ▼                                      ▼
┌──────────────────────────────────────────────┐
│              Active Session                   │
│  state.json ◄──► mux-runner (orchestrator)   │
│       │                                       │
│       ├── mux-runner.log (orchestration)      │
│       ├── iteration_N.log (raw output)        │
│       ├── ticket/worker_*.log (worker output) │
│       ├── ticket/research_*.md (artifacts)    │
│       └── meeseeks-summary.md (review audit)  │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
        Activity Log (JSONL)
           │
           ▼
      /pickle-standup
```

When a session ends, its directory persists — you can review any past session's state, logs, and artifacts.

---

## Iteration Loop — How the Agent Drives the Lifecycle

> *"No hooks, Morty. No middleware. The agent reads the instructions and just... does it. Like a scientist."*

Unlike pickle-rick-claude (which uses Claude Code's stop hook to block agent exit and re-inject context), pickle-rick-skills drives the lifecycle **inline via SKILL.md instructions**. The agent reads the skill file, which tells it to run scripts, interpret their output, and decide what to do next.

### The Loop

```
Agent reads SKILL.md
       │
       ▼
Run setup.js → creates session + state.json
       │
       ▼
┌──────────────────────────────────────────────┐
│  mux-runner.js outer loop                     │
│                                               │
│  For each iteration:                          │
│  1. Read state.json (phase, ticket, limits)   │
│  2. Build handoff prompt from state           │
│  3. Spawn CLI subprocess with prompt          │
│  4. Wait for exit                             │
│  5. Classify exit (normal/error/rate-limit)   │
│  6. Check circuit breaker                     │
│  7. Advance state (next ticket/phase)         │
│  8. Write handoff.txt for next iteration      │
│                                               │
│  Stop conditions:                             │
│  • All tickets Done                           │
│  • max_iterations reached                     │
│  • max_time_minutes exceeded                  │
│  • Circuit breaker OPEN                       │
│  • Rate limit exhausted (no resetsAt)         │
│  • active=false in state.json (cancelled)     │
└──────────────────────────────────────────────┘
```

### tmux Monitor

When running with tmux, a 3-pane monitor window provides real-time visibility:

![tmux monitor — 3-pane layout: dashboard (top-left), iteration log (top-right), worker stream (bottom)](images/tmux-monitor.png)

- **Top-left pane**: live dashboard — active ticket, phase, iteration count, elapsed time, circuit breaker state, rate limit countdown (when waiting), all tickets with status (`[x]` done / `[~]` in progress / `[ ]` todo), and recent output summary. Refreshes every 2 seconds.
- **Top-right pane**: live iteration log — streams each iteration's log as it's written, with an iteration header when the runner advances. Auto-switches to each new log file.
- **Bottom pane**: live worker (Morty) stream — auto-follows the latest worker session output showing research, implementation, test runs, and commits in real time.

### Context Clearing

The single biggest advantage over naive "just keep prompting" approaches is **context clearing between iterations**.

Long-running AI sessions accumulate stale conversational context. The model starts "remembering" earlier wrong turns, half-finished reasoning, and superseded plans — all of it silently influencing every subsequent response. Over enough iterations, the model loses track of what phase it's in, tries to restart from scratch, or hallucinates already-completed work.

**The Ralph Wiggum insight** (see [Credits](README.md#-credits)) is that a simple loop — spawning a fresh subprocess and injecting a minimal, accurate context — outperforms one long conversation every time. Fresh context = cleaner decisions.

Each iteration spawns a genuinely fresh CLI subprocess. The mux-runner builds a full structured handoff summary — phase, ticket list, task — and injects it into the prompt before each iteration starts:

```
=== PICKLE RICK LOOP CONTEXT ===
Phase: implementation
Iteration: 4 of 100
Session: ~/.pickle-rick-skills/sessions/2026-03-08-a3f2
Ticket: feat-42
Task: refactor the auth module
PRD: exists
Tickets:
  [x] feat-40: Set up database schema
  [x] feat-41: Add JWT middleware
  [~] feat-42: Refactor auth module
  [ ] feat-43: Write integration tests

NEXT ACTION: Resume from current phase. Read state.json for context.
Do NOT restart from PRD. Continue where you left off.
```

No matter how much context gets evicted, the agent always wakes up knowing exactly where it is and what to do next.

Workers already get clean context naturally — each is a fresh subprocess with the full 6-phase lifecycle template from the worker prompt.

---

## Manager / Worker Model

- **Manager (Rick)**: Runs via the mux-runner. Handles PRD, Breakdown, orchestration, state transitions.
- **Worker (Morty)**: Spawned via `spawn-worker.js` as a CLI subprocess per ticket. Gets the full 6-phase lifecycle prompt (Research → Plan → Implement → Verify → Review → Simplify). Workers are scope-bounded: they write artifacts only to their ticket directory, signal completion via a promise token, and are forbidden from modifying `state.json`.

### Runtime Adapter

The `runtime-adapter.js` service builds CLI-specific command lines for spawning subprocesses. It knows the flags for each of the 8 supported CLIs — prompt injection, auto-approve, turn limits, model selection, directory scoping. This abstraction is what lets the same lifecycle scripts work across Claude Code, Gemini CLI, Codex, Aider, and the rest.

```
Manager decides to spawn worker for ticket feat-42
       │
       ▼
runtime-adapter.js builds command:
  claude --dangerously-skip-permissions -p "..." --max-turns 200
  OR
  gemini -p "..." --sandbox
  OR
  codex --approval-mode full-auto -q "..."
       │
       ▼
spawn-worker.js executes with:
  • Timeout (worker_timeout_seconds)
  • SIGTERM → grace period → SIGKILL escalation
  • Stdout/stderr capture to worker log
  • Exit code classification
```

### Dual Spawn Architecture

Two spawn entry points serve different scopes:

| Entry | Scope | Use |
|-------|-------|-----|
| `spawn-morty.js` | Session-wide | Orchestrates per-ticket lifecycle — finds the ticket file, builds the worker prompt, calls `spawn-worker.js`, updates ticket status |
| `spawn-worker.js` | Single subprocess | Low-level CLI spawner — builds the command via runtime-adapter, handles timeout/kill escalation, captures output |

The separation means `spawn-morty.js` handles the *what* (which ticket, what prompt, what status updates) while `spawn-worker.js` handles the *how* (which CLI binary, what flags, process lifecycle).

---

## Key Differences from pickle-rick-claude

| Aspect | pickle-rick-claude | pickle-rick-skills |
|--------|-------------------|-------------------|
| **Loop mechanism** | Claude Code stop hook (`decision: block`) | mux-runner subprocess loop (no hooks) |
| **Persona injection** | CLAUDE.md (always active) | Optional via `persona` config flag |
| **Skill discovery** | `.claude/commands/*.md` | `.agents/skills/*/SKILL.md` (agentskills.io) |
| **CLI support** | Claude Code only | 8 CLIs via runtime-adapter |
| **Install location** | `~/.claude/pickle-rick/` | `~/.pickle-rick-skills/` |
| **Context clearing** | Hook-based `reason` injection (interactive) or tmux subprocess (tmux mode) | Always subprocess-based (mux-runner) |
| **Config format** | `pickle_settings.json` (flat) | `config.json` (nested with runtime registry) |
| **Worker spawning** | Hardcoded `claude -p` flags | `runtime-adapter.js` builds per-CLI commands |
| **Session memory** | `~/.claude/projects/` auto-memory | Session state.json + activity JSONL only |

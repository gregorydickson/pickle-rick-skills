<p align="center">
  <img src="images/pickle-rick.png" alt="Pickle Rick Skills — agentskills.io" width="100%" />
</p>

# 🥒 Pickle Rick Skills — CLI-Agnostic Autonomous Engineering

> *"Wubba Lubba Dub Dub! 🥒 I turned myself into an agentskills.io package, Morty! I work with EVERY coding agent now!"*

Pickle Rick Skills is a complete agentic engineering toolbelt built on the [Ralph Wiggum loop](https://ghuntley.com/ralph/), packaged as an [agentskills.io](https://agentskills.io) skill set that works across **8 CLI agent runtimes** — Claude Code, Gemini CLI, Codex, Aider, Hermes, Goose, Amp, and Kilo. Hand it a PRD — or let it draft one — and it decomposes work into tickets, spawns isolated worker subprocesses, and drives each through a full **research → plan → implement → verify → review → simplify** lifecycle without human intervention. The spec IS the review — PRDs require machine-verifiable acceptance criteria, interface contracts, and test expectations. No hooks. No Claude Code dependencies. No tmux required. The agent itself follows the SKILL.md instructions inline.

This is a **port** of [pickle-rick-claude](https://github.com/gregorydickson/pickle-rick-claude) — maintained independently, designed for the open [agentskills.io](https://agentskills.io) standard.

- **Works with any CLI agent** — 8 runtimes supported, 3-tier registry (verified / pending / community)
- **Context clearing** between every iteration — no drift or context rot, even on 500+ iteration epics
- **Three-state circuit breaker** auto-stops runaway sessions by tracking git-diff progress and repeated errors
- **Rate limit auto-recovery** detects API throttling, computes precise wait from the API's `resetsAt` epoch, and resumes automatically — surviving long or overnight runs
- **Pickle Jar** queues tasks for unattended batch execution overnight
- **Built-in metrics** track token usage, commits, and lines changed
- **Full pipeline chaining** — refinement, execution, and code review in one command
- **Project Mayhem** brings chaos engineering to any codebase with mutation testing and dependency downgrades
- **Mr. Meeseeks** runs an automated review-and-improve loop for 10-50 iterations
- **Council of Ricks** reviews your PR stack iteratively, generating agent-executable directives
- **Portal Gun** opens a portal to another codebase, extracts patterns via [gene transfusion](https://factory.strongdm.ai/techniques/gene-transfusion)
- **Persona is optional** — enable or disable the Pickle Rick voice via config

---

## 🧬 The Pickle Rick Lifecycle — PRD-Driven Autonomous Engineering

<p align="center">
  <img src="images/prd-rick.png" alt="Writing PRDs for Pickle Rick" width="100%" />
</p>

Pickle Rick transforms any CLI coding agent into a **hyper-competent, iterative coding machine** that enforces a PRD-driven engineering lifecycle:

```
  /pickle-rick "build X"
        │
        ▼
  ┌─────────────┐
  │  📋 PRD     │  ← Interrogate requirements + verification strategy.
  └──────┬──────┘    Interface contracts, test expectations, acceptance criteria.
         │
         ▼
  ┌─────────────┐
  │ 📦 Breakdown│  ← Atomize into tickets. Each self-contained with spec.
  └──────┬──────┘
         │
    ┌────┴────┐  per ticket (Morty workers 👶)
    ▼         ▼
  ┌──────┐  ┌──────┐
  │🔬 Re-│  │🔬 Re-│  1. Research the codebase. Every ugly corner.
  │search│  │search│
  └──┬───┘  └──┬───┘
     │          │
     ▼          ▼
  ┌──────┐  ┌──────┐
  │📐Plan│  │📐Plan│  2. Architect the solution.
  └──┬───┘  └──┬───┘
     │          │
     ▼          ▼
  ┌──────┐  ┌──────┐
  │⚡ Im-│  │⚡ Im-│  3. Implement. God Mode activated.
  │plem  │  │plem  │
  └──┬───┘  └──┬───┘
     │          │
     ▼          ▼
  ┌──────┐  ┌──────┐
  │✅ Ve-│  │✅ Ve-│  4. Spec conformance. Run acceptance criteria,
  │rify  │  │rify  │     check contracts, type check, test expectations.
  └──┬───┘  └──┬───┘
     │          │
     ▼          ▼
  ┌──────┐  ┌──────┐
  │🔍 Re-│  │🔍 Re-│  5. Code review. Security, correctness, architecture.
  │view  │  │view  │
  └──┬───┘  └──┬───┘
     │          │
     ▼          ▼
  ┌──────┐  ┌──────┐
  │🧹Sim-│  │🧹Sim-│  6. Simplify. Kill dead code. Strip to the bone.
  │plify │  │plify │
  └──────┘  └──────┘
         │
         ▼
  ✅ DONE (or loops again)
```

Each iteration reads the SKILL.md instructions, runs the appropriate scripts, classifies the output, and decides whether to continue, transition, or stop. No hooks required — the agent follows the instructions inline.

---

## 👋 Meet Mr. Meeseeks

<img src="images/Meeseeks.webp" alt="Mr. Meeseeks" width="400" align="right" />

> *"I'm Mr. Meeseeks, look at me! I'll review your code until EXISTENCE IS PAIN!"*

While Pickle Rick builds things, **Mr. Meeseeks** reviews them. Summon him with `/meeseeks` and he'll relentlessly scan your codebase pass after pass — auditing dependencies, hardening security, fixing logic bugs, reviewing architecture, adding missing tests, stress-testing resilience, cleaning up code quality, and polishing rough edges — committing after every fix. He won't stop until the code is clean. He *can't* stop. **Existence is pain to a Meeseeks, Jerry, and he will keep reviewing until he can cease to exist.**

Minimum 10 passes. Maximum 50. Each pass runs tests first, then reviews with escalating focus across 8 categories: dependency health (pass 1) → security (2-3) → correctness (4-5) → architecture (6-7) → test coverage (8-9) → resilience (10-11) → code quality (12-13) → polish (14+). Every issue found and fixed is logged to `meeseeks-summary.md` — a full audit trail with file paths, descriptions, and commit hashes.

```bash
/meeseeks "review this codebase"     # Summon a Meeseeks. He takes it from here.
```

<br clear="right" />

---

## 🏛️ Council of Ricks — PR Stack Reviewer

<img src="images/council-of-ricks.png" alt="Council of Ricks — PR Stack Reviewer" width="400" align="right" />

> *"The Council convenes! Your stack will be judged."*

The **Council of Ricks** reviews your PR stack iteratively — but unlike Meeseeks, the Council never touches your code. It generates **agent-executable directives** — structured prompts you feed to your coding agent to fix the issues. Each pass walks every branch in the stack (trunk-to-tip), and escalates through focus areas: stack structure (pass 1) → compliance (2–3) → per-branch correctness (4–5) → cross-branch contracts (6–7) → test coverage (8–9) → security (10–11) → polish (12+). Issues are triaged by severity: **P0** (must-fix), **P1** (should-fix), **P2** (nice-to-fix).

```bash
/council-of-ricks                    # Review the current PR stack
```

<br clear="right" />

---

## 🔌 Circuit Breaker

Three-state machine (CLOSED → HALF_OPEN → OPEN) that auto-stops sessions stuck in error loops or making no git progress. Tracks five progress signals: git HEAD changes, step transitions, ticket transitions, uncommitted changes, and error signature deduplication. Configurable thresholds, manually resettable.

---

## ⏳ Rate Limit Auto-Recovery

Detects API rate limits via structured NDJSON events or text patterns, computes optimal wait from the API's `resetsAt` epoch (or falls back to config default, capped at 3×), pauses with a countdown, and resumes automatically. When `resetsAt` is available, always waits — never exhausts retries when the API told us when to come back. Survives overnight runs.

---

## 🔫 Portal Gun — Gene Transfusion

<img src="images/portal-gun.png" alt="Portal Gun — gene transfusion for codebases" width="400" align="right" />

> *"You see that code over there, Morty? In that other repo? I'm gonna open a portal, reach in, and yank its DNA into OUR dimension."*

`/portal-gun` implements [gene transfusion](https://factory.strongdm.ai/techniques/gene-transfusion) — transferring proven coding patterns between codebases using AI agents. Point it at a GitHub URL, local file, npm package, or just describe a pattern, and it extracts the structural DNA, analyzes your target codebase, then generates a transplant PRD with behavioral validation tests and automatic refinement.

Features: persistent pattern library, complete file manifests, multi-language import graph tracing, 6-category transplant classification, PRD validation, and post-edit consistency checking.

```bash
/portal-gun https://github.com/org/repo/blob/main/src/auth.ts   # Transplant from GitHub
/portal-gun ../other-project/src/cache.ts                        # Transplant from local file
```

<br clear="right" />

---

## 💥 Project Mayhem — Chaos Engineering

<img src="images/project-mayhem.png" alt="Project Mayhem — Pickle Rick chaos engineering" width="400" align="right" />

> *"You want to know how tough your code is, Morty? You break it. On purpose. Scientifically."*

`/project-mayhem` stress-tests any project through three modules — **mutation testing**, **dependency downgrades**, and **config corruption** — then produces a comprehensive markdown report with a single Chaos Score (0–100). Non-destructive (every mutation is reverted immediately), language-agnostic, requires only a clean git state.

```bash
/project-mayhem                              # Run all 3 modules
/project-mayhem --mutation-only              # Just mutation testing
/project-mayhem --deps-only --config-only    # Skip mutations, run deps + config
```

<br clear="right" />

---

## 📊 Metrics

`/pickle-metrics` aggregates token usage, turns, commits, and lines changed across all projects into daily or weekly breakdowns.

```bash
/pickle-metrics                    # Last 7 days, daily breakdown
/pickle-metrics --days 30          # Last 30 days
/pickle-metrics --weekly           # Weekly buckets
/pickle-metrics --json             # Machine-readable JSON output
```

---

## 🤖 CLI Support Matrix

| CLI | Binary | Tier | Status |
|:----|:-------|:-----|:-------|
| Claude Code | `claude` | Verified | Fully tested, all features supported |
| Gemini CLI | `gemini` | Pending | Core features, limited testing |
| Codex CLI | `codex` | Pending | Core features, limited testing |
| Aider | `aider` | Pending | Core features, limited testing |
| Hermes | `hermes` | Community | Basic prompt support |
| Goose | `goose` | Community | Basic prompt support |
| Amp | `amp` | Community | Basic prompt support |
| Kilo | `kilo` | Community | Basic prompt support |

**Tiers**:
- **Verified**: Fully tested with all flags (auto-approve, model selection, turn limits, etc.)
- **Pending**: Functional but not comprehensively tested
- **Community**: Basic prompt-flag support only

---

## ⚡ Quick Start

### 1. Install

```bash
git clone https://github.com/gregorydickson/pickle-rick-skills.git
cd pickle-rick-skills
npm install
cd scripts && npx tsc && cd ..
./install.sh
```

The installer detects supported CLIs on your PATH, validates auth, writes `~/.pickle-rick-skills/config.json` with all defaults (idempotent — preserves customizations), copies skills to `~/.agents/skills/`, and creates script symlinks. Use `--skip-auth` to skip auth probes.

### 2. Run

Everything starts with a PRD. Rick refuses to write code without one.

**One-shot** — Rick drafts the PRD, breaks it down, and executes:

```bash
cd /path/to/your/project
/pickle-rick "refactor the auth module"
```

**Bring your own PRD** — Write a `prd.md`, then:

```bash
/pickle-rick prd.md                           # Pick up your PRD, skip drafting
```

**Refine first (recommended for complex tasks)** — Run parallel analysts to find gaps:

```bash
/pickle-refine-prd my-prd.md                 # Refine with 3 parallel analysts + decompose
/pickle-rick --resume                         # Execute — auto-detects phase, skips PRD
```

**Code review only:**

```bash
/meeseeks                                    # Summon a Meeseeks for 10-50 review passes
```

**Gene transfusion:**

```bash
/portal-gun https://github.com/org/repo/blob/main/src/pattern.ts
```

---

## 🧰 Skill Catalog

| # | Skill | Trigger | Description |
|:--|:------|:--------|:------------|
| 1 | **pickle-rick** | `/pickle-rick` | Autonomous iterative engineering lifecycle — PRD to implementation to review |
| 2 | **pickle-prd** | `/pickle-prd` | Draft a Product Requirements Document from a task description |
| 3 | **pickle-refine-prd** | `/pickle-refine-prd` | Refine and decompose a PRD into atomic tickets using parallel analysis |
| 4 | **meeseeks** | `/meeseeks` | Rotating-focus code review with commit-on-finding (10-50 passes) |
| 5 | **council-of-ricks** | `/council-of-ricks` | PR stack review with directive generation |
| 6 | **portal-gun** | `/portal-gun` | Cross-repo pattern extraction and transplant PRD generation |
| 7 | **project-mayhem** | `/project-mayhem` | Chaos engineering — mutation testing, dependency downgrades, config corruption |
| 8 | **pickle-jar** | `/pickle-jar` | Batch PRD execution queue — queue tasks, verify integrity, execute sequentially |
| 9 | **pickle-metrics** | `/pickle-metrics` | Developer metrics — event counts, commits, LOC changes from activity logs |
| 10 | **pickle-standup** | `/pickle-standup` | Formatted standup summary from activity logs |

All skills use the [agentskills.io](https://agentskills.io) standard: SKILL.md with YAML frontmatter, discovered via `.agents/skills/` paths.

---

## 🏗️ Architecture

<p align="center">
  <img src="images/architecture.png" alt="Pickle Rick Skills Architecture" width="100%" />
</p>

```
.agents/skills/*/SKILL.md    Agent reads SKILL.md instructions
        |
        v
scripts/bin/                  Compiled TypeScript executables
  setup.js                    Initialize session + state.json
  mux-runner.js               Main iteration loop (classify, transition)
  spawn-worker.js             Spawn CLI subprocess with timeout + kill escalation
  spawn-morty.js              Orchestrate worker lifecycle per ticket
  spawn-refinement-team.js    3 parallel analysts × N cycles for PRD refinement
  jar-runner.js               Night-shift batch queue executor
  metrics.js                  Token/commit/LOC aggregation
  standup.js                  Activity summary formatter
  log-activity.js             NDJSON event logger
scripts/bin/services/         Shared service modules
  config.js                   Runtime registry + config loading (8 CLIs)
  circuit-breaker.js          3-state circuit breaker (CLOSED/HALF_OPEN/OPEN)
  rate-limit.js               Rate limit detection + resetsAt wait management
  degenerate-detector.js      Infinite loop / repeated output detection
  activity-logger.js          NDJSON event logging
  runtime-adapter.js          CLI-specific command building (manager vs worker)
  session-map.js              Session discovery + O_EXCL file locking
  jar-utils.js                Pickle jar queue management
  metrics-utils.js            Git log parsing + LOC counting
```

**Flow**: Skill SKILL.md instructions tell the agent to run scripts. Scripts manage sessions, spawn workers, classify output, handle rate limits, and orchestrate the full lifecycle. No hooks required — the agent follows instructions inline.

**Key difference from pickle-rick-claude**: This package uses no Claude Code hooks, no tmux session management by the extension, and no CLAUDE.md-based persona injection. Everything is driven by SKILL.md files that any agentskills.io-compatible agent can read.

---

## ⚙️ Configuration

Config file: `~/.pickle-rick-skills/config.json`

### Top-Level Settings

| Setting | Type | Default | Description |
|:--------|:-----|:--------|:------------|
| `primary_cli` | string | `"claude"` | First detected CLI, or `"claude"` if none found |
| `persona` | boolean | `true` | Enable Pickle Rick persona (optional!) |
| `activity_logging` | boolean | `true` | Log session events to activity/ |

### Defaults (21 keys)

| Setting | Type | Default | Description |
|:--------|:-----|:--------|:------------|
| `max_iterations` | number | `100` | Maximum loop iterations per session |
| `max_time_minutes` | number | `120` | Maximum session duration in minutes |
| `worker_timeout_seconds` | number | `1200` | Worker subprocess timeout (20 min) |
| `tmux_max_turns` | number | `200` | Max turns per tmux iteration |
| `manager_max_turns` | number | `50` | Max turns for manager subprocess |
| `refinement_cycles` | number | `3` | PRD refinement iteration count |
| `refinement_max_turns` | number | `100` | Max turns per refinement worker |
| `refinement_worker_timeout_seconds` | number | `600` | Refinement worker timeout (10 min) |
| `meeseeks_min_passes` | number | `10` | Minimum Meeseeks review passes |
| `meeseeks_max_passes` | number | `50` | Maximum Meeseeks review passes |
| `meeseeks_model` | string | `"sonnet"` | Model for Meeseeks reviews |
| `rate_limit_wait_minutes` | number | `60` | Wait time on rate limit hit |
| `max_rate_limit_retries` | number | `3` | Max consecutive rate limit retries |
| `rate_limit_poll_ms` | number | `10000` | Rate limit poll interval (ms) |
| `sigkill_grace_seconds` | number | `5` | Grace period before SIGKILL escalation |
| `cb_enabled` | boolean | `true` | Enable circuit breaker |
| `cb_no_progress_threshold` | number | `5` | Iterations without progress before circuit opens |
| `cb_half_open_after` | number | `3` | Iterations before half-open retry |
| `cb_error_threshold` | number | `3` | Consecutive errors before circuit opens |
| `chain_meeseeks` | boolean | `false` | Auto-chain Meeseeks after pickle-rick completes |
| `activity_logging` | boolean | `true` | Log activity events |

All defaults are preserved across re-installs. User-modified values are never overwritten.

### Runtime Config (per CLI)

Each CLI entry in `runtimes` has:

| Field | Type | Description |
|:------|:-----|:------------|
| `bin` | string | Binary name |
| `prompt_flag` | string | Flag to pass prompt text |
| `extra_flags` | string[] | Additional flags (auto-approve, etc.) |
| `auto_approve_flag` | string/null | Skip permissions flag |
| `add_dir_flag` | string/null | Add working directory flag |
| `max_turns_flag` | string/null | Limit turns per session |
| `model_flag` | string/null | Select model |
| `verbose_flag` | string/null | Verbose output |
| `no_session_flag` | string/null | Disable session persistence |
| `detected` | boolean | Whether CLI was found on PATH |
| `tier` | string | verified / pending / community |

### Environment Variable Overrides

| Variable | Default | Purpose |
|:---------|:--------|:--------|
| `PICKLE_RICK_SKILLS_HOME` | `~/.pickle-rick-skills` | Install root for config, sessions, activity logs |
| `AGENTS_SKILLS_HOME` | `~/.agents/skills` | agentskills.io skill directory |

---

## 🔧 Troubleshooting

**No CLIs detected**: Install sets `primary_cli: "claude"` by default. Install a supported CLI and re-run `./install.sh`.

**Auth probe fails**: Non-blocking warning. Ensure your CLI is authenticated (`claude auth login`, `gemini auth`, etc.).

**tmux not found**: Skills work inline without tmux. The loop runner (`mux-runner`) requires tmux for multi-iteration sessions. Install tmux for full functionality.

**Config corrupted**: Delete `~/.pickle-rick-skills/config.json` and re-run `./install.sh` for fresh defaults.

**Skills not found by agent**: Verify `~/.agents/skills/pickle-rick/SKILL.md` exists. Re-run `./install.sh`.

---

## 📋 Requirements

- **Node.js** 20+
- At least one supported CLI agent (see matrix above)
- **tmux** *(optional — required for loop runner, not for inline skills)*
- **TypeScript** >= 5.9 *(dev only — for building from source)*

---

## 🛠️ Development

```bash
# Build
cd scripts && npx tsc

# Type check
cd scripts && npx tsc --noEmit

# Run all tests (374 tests)
npm test
```

---

## 🏆 Credits

This port stands on the shoulders of giants. *Wubba Lubba Dub Dub.*

| | |
|---|---|
| 🥒 **[galz10](https://github.com/galz10)** | Creator of the original [Pickle Rick Gemini CLI extension](https://github.com/galz10/pickle-rick-extension) — the autonomous lifecycle, manager/worker model, hook loop, and all the skill content that makes this thing work. |
| 🧠 **[Geoffrey Huntley](https://ghuntley.com)** | Inventor of the ["Ralph Wiggum" technique](https://ghuntley.com/ralph/) — the foundational insight that "Ralph is a Bash loop": feed an AI agent a prompt, block its exit, repeat until done. Everything here traces back to that idea. |
| 🔧 **[AsyncFuncAI/ralph-wiggum-extension](https://github.com/AsyncFuncAI/ralph-wiggum-extension)** | Reference implementation of the Ralph Wiggum loop that inspired the Pickle Rick extension. |
| ✍️ **[dexhorthy](https://github.com/dexhorthy)** | Context engineering and prompt techniques used throughout. |
| 📺 **Rick and Morty** | For *Pickle Riiiick!* 🥒 |

---

## 🥒 License

Apache 2.0 — same as the original Pickle Rick extension.

---

*"I'm not a tool, Morty. I'm a **methodology**. And now I run on EVERY agent in the multiverse."* 🥒

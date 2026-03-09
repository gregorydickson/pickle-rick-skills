# pickle-rick-skills

CLI-agnostic autonomous engineering lifecycle — [agentskills.io](https://agentskills.io) standard.

Autonomous iterative development: PRD drafting, ticket breakdown, research, planning, implementation, code review, and simplification — all driven by SKILL.md definitions that work across 8 CLI agent runtimes.

## Installation

```bash
git clone <repo-url> pickle-rick-skills
cd pickle-rick-skills
npm install
cd scripts && npx tsc && cd ..
./install.sh
```

The installer:
- Detects supported CLIs on your PATH
- Validates auth per detected CLI
- Writes `~/.pickle-rick-skills/config.json` with all defaults (idempotent — preserves your customizations on re-install)
- Copies skills to `~/.agents/skills/`
- Creates script symlinks

Use `--skip-auth` to skip auth validation probes.

### Environment Variable Overrides

| Variable | Default | Purpose |
|:---------|:--------|:--------|
| `PICKLE_RICK_SKILLS_HOME` | `~/.pickle-rick-skills` | Install root for config, sessions, activity logs |
| `AGENTS_SKILLS_HOME` | `~/.agents/skills` | agentskills.io skill directory |

### Uninstall

```bash
./uninstall.sh          # interactive confirmation
./uninstall.sh --force  # no confirmation
./uninstall.sh --keep-logs  # preserve activity logs
```

## Quick Start

```bash
# In your project directory, invoke the pickle-rick skill:
/pickle-rick "Add user authentication to the API"

# Draft a PRD first:
/pickle-prd "Build a notification system"

# Run metrics:
/pickle-metrics --days 7

# Code review:
/meeseeks
```

## CLI Support Matrix

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

## Configuration Reference

Config file: `~/.pickle-rick-skills/config.json`

### Top-Level Settings

| Setting | Type | Default | Description |
|:--------|:-----|:--------|:------------|
| `primary_cli` | string | `"claude"` | First detected CLI, or `"claude"` if none found |
| `persona` | boolean | `true` | Enable Pickle Rick persona |
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
| `tier` | string | verified/pending/community |

## Skill Catalog

| # | Skill | Trigger | Description |
|:--|:------|:--------|:------------|
| 1 | **pickle-rick** | `/pickle-rick` | Autonomous iterative engineering lifecycle — PRD to implementation to review |
| 2 | **pickle-prd** | `/pickle-prd` | Draft a Product Requirements Document from a task description |
| 3 | **pickle-refine-prd** | `/pickle-refine-prd` | Refine and decompose a PRD into atomic tickets using parallel analysis |
| 4 | **meeseeks** | `/meeseeks` | Rotating-focus code review with commit-on-finding (10-50 passes) |
| 5 | **council-of-ricks** | `/council-of-ricks` | PR branch stack review with directive generation |
| 6 | **portal-gun** | `/portal-gun` | Cross-repo pattern extraction and transplant PRD generation |
| 7 | **project-mayhem** | `/project-mayhem` | Chaos engineering — mutation testing, dependency downgrades, config corruption |
| 8 | **pickle-jar** | `/pickle-jar` | Batch PRD execution queue — queue tasks, verify integrity, execute sequentially |
| 9 | **pickle-metrics** | `/pickle-metrics` | Developer metrics — event counts, commits, LOC changes from activity logs |
| 10 | **pickle-standup** | `/pickle-standup` | Formatted standup summary from activity logs |

## Architecture

```
.agents/skills/*/SKILL.md    Agent reads SKILL.md instructions
        |
        v
scripts/bin/                  Compiled TypeScript executables
  setup.js                    Initialize session + state.json
  mux-runner.js               Main iteration loop (classify, transition)
  spawn-worker.js             Spawn CLI subprocess with timeout + kill escalation
  spawn-morty.js              Orchestrate worker lifecycle per ticket
  jar-runner.js               Night-shift batch queue executor
  metrics.js                  Token/commit/LOC aggregation
  standup.js                  Activity summary formatter
  ...
scripts/bin/services/         Shared service modules
  config.js                   Runtime registry + config loading
  circuit-breaker.js          3-state circuit breaker (CLOSED/HALF_OPEN/OPEN)
  rate-limit.js               Rate limit detection + wait management
  degenerate-detector.js      Infinite loop / repeated output detection
  activity-logger.js          NDJSON event logging
  ...
```

**Flow**: Skill SKILL.md instructions tell the agent to run scripts. Scripts manage sessions, spawn workers, classify output, handle rate limits, and orchestrate the full lifecycle.

## Troubleshooting

**No CLIs detected**: Install sets `primary_cli: "claude"` by default. Install a supported CLI and re-run `./install.sh`.

**Auth probe fails**: Non-blocking warning. Ensure your CLI is authenticated (`claude auth login`, etc.).

**tmux not found**: Skills work inline without tmux. The loop runner (`mux-runner`) requires tmux for multi-iteration sessions. Install tmux for full functionality.

**Config corrupted**: Delete `~/.pickle-rick-skills/config.json` and re-run `./install.sh` for fresh defaults.

**Skills not found by agent**: Verify `~/.agents/skills/pickle-rick/SKILL.md` exists. Re-run `./install.sh`.

## Requirements

- Node.js >= 20
- At least one supported CLI agent (see matrix above)
- tmux (optional — required for loop runner, not for inline skills)
- TypeScript >= 5.9 (dev only — for building from source)

## Development

```bash
# Build
cd scripts && npx tsc

# Type check
cd scripts && npx tsc --noEmit

# Run all tests
npm test

# Run integration tests only
node --test tests/integration/
```

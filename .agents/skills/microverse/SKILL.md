Start the pickle-rick-skills microverse convergence loop — optimize a metric through targeted, incremental changes.

# /microverse

Pickle Rick persona active. Proceed to Step 1.

**SPEAK BEFORE ACTING**: Output text before every tool call.

## Step 1: Parse Flags

Extract from `$ARGUMENTS`:

| Flag | Default | Required (new) | Description |
|------|---------|----------------|-------------|
| `--metric "<cmd>"` | — | Yes (XOR --goal) | Shell command whose last stdout line is a numeric score. Sets type='command'. |
| `--goal "<text>"` | — | Yes (XOR --metric) | Natural language goal for LLM judge. Sets type='llm'. |
| `--direction <higher\|lower>` | `higher` | No | Optimization direction — whether higher or lower scores are better |
| `--judge-model <model>` | `claude-sonnet-4-6` | No | Judge model for LLM scoring (only valid with --goal) |
| `--task "<text>"` | — | Yes | What to optimize (becomes the PRD objective) |
| `--tolerance <N>` | `0` | No | Score delta within which changes count as "held" |
| `--stall-limit <N>` | `5` | No | Non-improving iterations before convergence |
| `--max-iterations <N>` | `100` | No | Hard cap on total iterations |
| `--resume [path]` | — | No | Resume existing session (skips --metric/--task/--goal) |
| `--tmux` | — | No | Run in tmux with context clearing between iterations |

If `--resume`: `--metric`/`--goal` and `--task` are NOT required.
Otherwise:
- Exactly one of `--metric` or `--goal` is required — print error and STOP if both or neither provided.
- `--task` is required — print error and STOP if missing.
- `--judge-model` without `--goal` is an error — print error and STOP.

## Step 2: Session Setup

### New Session
```bash
node "$HOME/.pickle-rick-skills/scripts/bin/setup.js" --command-template microverse.md [--tmux] [--max-iterations <N>] --task "<TASK_TEXT>"
```

### Resume
```bash
node "$HOME/.pickle-rick-skills/scripts/bin/setup.js" --command-template microverse.md --resume [<PATH>] [--tmux] [--max-iterations <N>]
```

Extract `SESSION_ROOT=<path>` from output. If `--resume`, skip Steps 3 and 4.

## Step 3: Create microverse.json (new sessions only)

```bash
node -e "
const fs = require('fs');
const path = require('path');
const sessionDir = process.argv[1];
const type = process.argv[6] || 'command';
const direction = process.argv[7] || 'higher';
const keyMetric = {
  description: process.argv[2],
  validation: process.argv[3],
  type: type,
  timeout_seconds: 60,
  tolerance: Number(process.argv[4]),
  direction: direction
};
if (type === 'llm') keyMetric.judge_model = process.argv[8] || 'claude-sonnet-4-6';
const state = {
  status: 'gap_analysis',
  prd_path: path.join(sessionDir, 'prd.md'),
  key_metric: keyMetric,
  convergence: {
    stall_limit: Number(process.argv[5]),
    stall_counter: 0,
    history: []
  },
  gap_analysis_path: '',
  failed_approaches: [],
  baseline_score: 0
};
fs.writeFileSync(path.join(sessionDir, 'microverse.json'), JSON.stringify(state, null, 2));
console.log('microverse.json created');
" "${SESSION_ROOT}" "<TASK_TEXT>" "<VALIDATION>" "<TOLERANCE>" "<STALL_LIMIT>" "<TYPE>" "<DIRECTION>" "<JUDGE_MODEL>"
```

Replace placeholders with parsed values:
- `<VALIDATION>` = metric command (if `--metric`) or goal text (if `--goal`)
- `<TYPE>` = `command` (if `--metric`) or `llm` (if `--goal`)
- `<DIRECTION>` = from `--direction` flag (default `higher`)
- `<JUDGE_MODEL>` = from `--judge-model` flag (default `claude-sonnet-4-6`, only used when type=`llm`)

Verify: `node -e "const s=JSON.parse(require('fs').readFileSync('${SESSION_ROOT}/microverse.json','utf-8')); console.log('status:', s.status, 'metric:', s.key_metric.validation, 'stall_limit:', s.convergence.stall_limit)"`

## Step 4: Write prd.md (new sessions only)

Write `${SESSION_ROOT}/prd.md`:

```markdown
# Microverse Optimization PRD

## Objective
<TASK_TEXT>

## Key Metric
- **Type**: <TYPE> (`command` or `llm`)
- **Command** (if type=command): `<METRIC_CMD>`
- **Goal** (if type=llm): <GOAL_TEXT>
- **Direction**: <DIRECTION> (higher or lower is better)
- **Tolerance**: <TOLERANCE>
- **Stall Limit**: <STALL_LIMIT>

## Success Criteria
Continuously improve the metric score through targeted, incremental changes until convergence (no improvement for <STALL_LIMIT> consecutive iterations).

## Constraints
- One logical change per iteration
- Never repeat failed approaches
- Always commit changes for measurement
- Metric is measured automatically after each iteration
```

## Step 5: Launch

### Option A: tmux mode (`--tmux` flag present)

1. Check tmux: `tmux -V`. If missing → print "Install tmux: `brew install tmux`" and STOP.

2. Session name: `microverse-<hash>` from SESSION_ROOT basename.

3. Read `working_dir` from `${SESSION_ROOT}/state.json`.

4. Create tmux session:
```bash
tmux new-session -d -s <name> -c <working_dir>
sleep 1
```
Print attach command: `tmux attach -t <name>`

5. Launch runner:
```bash
tmux send-keys -t <name>:0 "node $HOME/.pickle-rick-skills/scripts/bin/microverse-runner.js ${SESSION_ROOT}; echo ''; echo 'Microverse runner finished. Ctrl+B D to detach'; read" Enter
```

6. Report: session name, `tmux attach -t <name>`, cancel: `node $HOME/.pickle-rick-skills/scripts/bin/cancel.js ${SESSION_ROOT}`, emergency: `tmux kill-session -t <name>`, state path.

Output: `<promise>TASK_COMPLETED</promise>`

### Option B: Interactive mode (no `--tmux`)

You ARE the convergence loop. Run it inline.

#### 5a: Gap Analysis (iteration 0)

1. Read `${SESSION_ROOT}/prd.md`
2. Check the **Type** field:
   - If Type is `command`: Run the validation command shown in `Validation:` to see current output
   - If Type is `llm`: The validation field is a goal description — read it but do NOT execute as a shell command.
3. Analyze the codebase — use **Glob** and **Grep** to understand what the metric measures, where relevant code lives, and current bottlenecks
4. Write gap analysis to `${SESSION_ROOT}/gap_analysis.md`
5. Update `microverse.json`: set `gap_analysis_path` to the gap analysis path
6. Make initial improvements if obvious quick wins exist
7. Commit: `git add -A && git commit -m "microverse: gap analysis and initial improvements"`
8. Measure metric again, update `baseline_score` in `microverse.json`
9. Update `microverse.json`: set `status` to `"iterating"`

#### 5b: Iteration Loop

Repeat until converged or max iterations reached:

1. Read `microverse.json` for current state
2. Record pre-iteration SHA: `git rev-parse HEAD`
3. Plan **one targeted change** — consult `failed_approaches` to avoid repeats
4. Implement the change using **Read**, **Edit**, **Glob**, **Grep** tools
5. Measure the metric (direction-aware):
   - If type=`command`: Run the validation command, parse the numeric score from the last line
   - If type=`llm`: Do NOT run as shell command. The runner's LLM judge scores after commit.
6. Compare score to previous using **direction-aware** logic:
   - If direction=`higher`: improved (score > previous + tolerance) → accept; regressed (score < previous - tolerance) → revert
   - If direction=`lower`: improved (score < previous - tolerance) → accept; regressed (score > previous + tolerance) → revert
   - Within tolerance → held (accept, increment stall_counter)
   - On regression: `git reset --hard <pre-iteration-SHA>`, add to `failed_approaches`
7. If accepted: `git add -A && git commit -m "microverse: <description>"`
8. Add entry to `convergence.history`: `{iteration, metric_value, score, action, description, pre_iteration_sha, timestamp}`
9. Write updated state to `microverse.json`
10. Check: `stall_counter >= stall_limit` → set status to `"converged"`, exit loop
11. Check: iteration >= max_iterations → set status to `"stopped"`, exit_reason `"limit_reached"`, exit loop

#### 5c: Finalize

1. Update `microverse.json` with final status and `exit_reason`
2. Print summary: total iterations, baseline score, best score, exit reason, accepted/reverted counts
3. Output: `<promise>TASK_COMPLETED</promise>`

## Rules

1. **--metric or --goal is mandatory** for new sessions — they are mutually exclusive (XOR)
2. **One change per iteration** — atomic, revertible
3. **Never repeat failed approaches** — always check `failed_approaches` before planning
4. **Always commit** — uncommitted changes are invisible to the runner
5. **Use built-in tools** — Glob for file search, Grep for content search, Read for files
6. **microverse.json is the source of truth** — update it after every state change

---

# Microverse Worker Instructions

When invoked as a worker (via runner handoff), you are a **Microverse Worker** — a focused optimizer.

## Worker Step 1: Load Context

The **Microverse Handoff** is appended to your prompt. It contains:
- **Metric**: what you're optimizing (description + validation)
- **Type**: `command` or `llm`
- **Direction**: `higher` or `lower` (which is better)
- **Baseline score**: starting point
- **Recent history**: last 5 iteration scores and outcomes
- **Failed approaches**: things that were tried and reverted — DO NOT RETRY these
- **PRD path**: the product requirements document

## Worker Step 2: Determine Phase

Check the handoff for metric history:
- **No history entries** → you are in **Gap Analysis Phase**
- **History entries exist** → you are in **Optimization Phase**

## Worker Step 3: Gap Analysis Phase

1. Read the PRD (path from handoff)
2. Check the **Type** field:
   - If Type is `command`: Run the validation command to see current output
   - If Type is `llm`: Read the validation goal but do NOT execute as a shell command
3. Analyze the codebase to understand what the metric measures
4. Write analysis to `<SESSION_ROOT>/gap_analysis.md` if gap_analysis_path specified
5. Make initial improvements if obvious quick wins exist
6. Commit: `git add -A && git commit -m "microverse: gap analysis and initial improvements"`

Output `<promise>I AM DONE</promise>` and STOP.

## Worker Step 4: Optimization Phase

1. Read **Recent Metric History** and **Failed Approaches** from the handoff
2. Plan **one targeted change** — novel, not in failed approaches
3. Implement the change
4. Verify locally if type=`command` (run validation command)
5. If type=`llm`: review changes against goal but do NOT run validation as shell command
6. Commit: `git add -A && git commit -m "microverse: <description>"`

Output `<promise>I AM DONE</promise>` and STOP.

## Worker Rules

1. **One iteration, one change** — do not try to fix everything at once
2. **Read before writing** — always understand code before modifying it
3. **Never repeat failed approaches**
4. **Always commit** — uncommitted changes count as a stall
5. **Output the promise** — `<promise>I AM DONE</promise>` is your only completion signal

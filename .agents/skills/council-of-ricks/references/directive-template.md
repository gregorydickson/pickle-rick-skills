# Council Directive — Pass [N]

## Stack Overview
- **Repo**: [repo path]
- **Trunk**: [main/master]
- **Branches**: [branch count]
- **Focus Area**: [current focus category]
- **Issues Found**: [count by severity: P0/P1/P2]

## Project Rules
[Key rules from CLAUDE.md that apply to this review pass]

## Instructions

For each branch below, checkout with `gt branch checkout <branch> --no-interactive`, apply fixes, stage only modified files, commit with message: `"address council pass <N>: <summary>"`.

After all branches fixed: `gt restack --no-interactive`. Then run lint/test/build commands.

---

## Branch: [branch-name]

**Status**: PASS | FAIL
**PR Purpose**: [from PR description]

### Findings

| # | Severity | File | Line | Rule Violated | Problem | Fix Instruction |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | P0 | [path] | [line] | [CLAUDE.md rule or N/A] | [description] | [action: replace/insert/delete] |

### Fix Details

#### Finding 1: [title]

**File**: `[path]`
**Lines**: [start]-[end]
**Action**: replace | insert | delete

**Before**:
```
[existing code — 3-5 relevant lines]
```

**After**:
```
[corrected code — exact content to write]
```

---

## Branch: [next-branch-name]

[Repeat per-branch section]

---

## Completion

Run after all fixes applied:
1. `gt restack --no-interactive`
2. [lint command from CLAUDE.md]
3. [test command from CLAUDE.md]
4. [build command from CLAUDE.md]

If all pass and no issues remain → THE_CITADEL_APPROVES.

---
name: project-mayhem
description: Chaos engineering for any project — mutation testing, dependency downgrades, config corruption.
version: 1.0.0
triggers:
  - chaos
  - mutation
  - mayhem
  - resilience-test
---

# Project Mayhem

Chaos engineering skill that tests project resilience through controlled mutations. ALL changes are reverted after each test phase.

## Rules

1. **Non-destructive**: Every mutation phase ends with `git checkout .` to revert ALL changes
2. **Isolated**: Run one mutation at a time, verify, revert before next
3. **Reported**: Generate `project_mayhem_report.md` with kill rates and resilience scores
4. **Safe**: Never push mutations, never modify git history, never delete branches

## Phases

### 1. Mutation Testing
For each source file in the project:
1. Make a single semantic mutation (flip condition, change operator, remove return)
2. Run the test suite
3. Record whether tests caught the mutation (killed) or missed it (survived)
4. `git checkout .` — revert the mutation
5. Repeat for next mutation

**Kill rate** = mutations killed / total mutations. Higher is better.

### 2. Dependency Downgrades
For each dependency in package.json (or equivalent):
1. Downgrade to previous major version
2. Run tests
3. Record pass/fail
4. `git checkout .` — revert

### 3. Config Corruption
For each config file:
1. Modify a config value (change port, flip boolean, empty string)
2. Run tests
3. Record whether the change was caught
4. `git checkout .` — revert

### 4. Report Generation
Generate `project_mayhem_report.md`:

```markdown
# Project Mayhem Report

## Mutation Testing
- Kill Rate: X/Y (Z%)
- Survived mutations: [list with file:line]

## Dependency Downgrades
- Failures caught: X/Y
- Silent downgrades: [list]

## Config Corruption
- Caught: X/Y
- Uncaught: [list]

## Resilience Score: X/10
```

### 5. Final Revert
```bash
git checkout .
```
Verify working tree is clean with `git status`.

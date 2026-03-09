# Ticket Template

```markdown
---
id: [8-char hex hash]
title: "[Title]"
status: "Todo"
priority: [High|Medium|Low]
order: [N — 10, 20, 30...]
created: [YYYY-MM-DD]
updated: "[YYYY-MM-DD]"
depends_on:
  - [ticket_id]
links:
  - url: ../linear_ticket_parent.md
    title: Parent
---
# Description
## Problem
[What's broken and why it matters]

## Solution
[How to fix it]

## Implementation Details
**Files to modify/create**:
- `path/to/file.ts` — What changes

## Interface Contracts
**Inputs**: [What the code receives]
**Outputs**: [What the code produces]

## Acceptance Criteria
- [ ] [Criterion] — Verify: [command] — Type: [test|lint|llm-conformance]

## Test Expectations
| Criterion | Test File | Description | Assertion |
|:---|:---|:---|:---|

## Conformance Check
- [ ] Type checker passes
- [ ] Test runner passes
- [ ] Contracts match impl signatures
```

## Field Reference
| Field | Type | Required |
|:------|:-----|:---------|
| id | string (hex) | yes |
| title | string | yes |
| status | "Todo" \| "In Progress" \| "Done" \| "Blocked" | yes |
| priority | "High" \| "Medium" \| "Low" | yes |
| order | number | yes |
| created | date (YYYY-MM-DD) | yes |
| updated | date string | yes |
| depends_on | string[] | no |
| links | {url, title}[] | no |
| review_group | string (comma-separated IDs) | no, review tickets only |

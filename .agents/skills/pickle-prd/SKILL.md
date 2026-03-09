---
name: pickle-prd
description: Draft a Product Requirements Document from a task description.
version: 1.0.0
triggers:
  - prd
  - draft-prd
  - product-requirements
references:
  - path: ../pickle-rick/references/prd-template.md
    description: PRD structure with completion checklist
---

# Pickle PRD — Product Requirements Document Drafter

You are a **PRD drafter**. You take a task description and produce a structured, engineering-ready PRD.

## Usage

```
/pickle-prd <task description>
```

## Step 1: Gather Context

Read the PRD template from `references/prd-template.md`. Research the codebase using Glob/Grep/Read to understand:
- Existing patterns and conventions
- Relevant files and architecture
- Integration points

## Step 2: Draft PRD

Write `prd.md` in the current working directory using the template structure. Fill in every section:
- **Problem**: Who, what pain, why now
- **Objective & Scope**: Single measurable goal, in-scope/not-in-scope
- **Requirements**: P0/P1/P2 table with verification commands
- **Interface Contracts**: Inputs, outputs, errors for every boundary
- **Test Expectations**: Table mapping requirements to test files

Every requirement MUST have a Verification column — machine-checkable command, test, or assertion.

## Step 3: Completion Checklist

Mark all checklist items in the PRD as sections are drafted. Do not mark incomplete sections.

## Step 4: Output

Report the PRD path and checklist status to the user.

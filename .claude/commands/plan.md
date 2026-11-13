---
description: "Plan the implementation of a spec — phases in dependency order, each with exit criteria and validation."
argument-hint: "<spec or feature>"
---

Write an implementation plan for: $ARGUMENTS

- Base it on the approved spec; link to it.
- Order phases by dependency; keep each phase small enough to validate on its own.
- Give every phase exit criteria and the exact validation that proves them (commands, smoke
  checks).
- Write it to disk; a plan with several phases must be usable by other agents or models without
  the conversation. Keep the status table, the checkboxes and "Next step" up to date as work
  proceeds, in the same commit as the work, so what is done and what is missing is always clear.
- Set `Status` to `In progress` when work starts, `Paused` when it stops unfinished and `Done` when
  every phase is validated (`AGENTS.md`, "Open plans at session start"); sessions start by asking
  the user whether to resume open plans.
- Name the main risks and where the plan addresses them.
- Finish by reviewing it with the `plan-review` skill when it is installed.

Save it as `docs/plans/<slug>.md`, where `<slug>` is a short kebab-case name. Never overwrite an existing file.

Use this structure:

```markdown
# Plan — <title>

- **Date:** <YYYY-MM-DD>
- **Status:** Draft
- **Resume prompt:** ask
- **Next step:**
- **Spec:**

## Approach

## Phase status

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 1 — | Pending | — | |

Statuses: `Pending`, `Next`, `In progress`, `Done`, `Blocked`. `Done` only when every exit
criterion is validated.

## Phases

### Phase 1 —

- Work:
- Exit criteria:
  - [ ]
- Validation:

## Risks

## Out of scope

## Log

<!-- One line per session or pause: date, what was done, what is left, what the next agent must know. -->
```

---
description: "Record a structural decision with its context, the options considered and the consequences."
argument-hint: "<decision>"
---

Write an architecture decision record for: $ARGUMENTS

- Describe the forces and constraints in the context, not the solution.
- Compare at least two real options with their pros and cons.
- State the decision and why; list positive and negative consequences and follow-ups.
- Status starts as `Proposed`; accepted records are superseded by a new one, never rewritten.

Save it as `docs/adr/<NNNN>-<slug>.md`, where `<slug>` is a short kebab-case name, `<NNNN>` is the next free four-digit number in that folder. Never overwrite an existing file.

Use this structure:

```markdown
# ADR — <title>

- **Status:** Proposed
- **Date:** <YYYY-MM-DD>

## Context

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A | | |
| B | | |

## Decision

## Consequences

- Positive:
- Negative:
- Follow-ups:
```

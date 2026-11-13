---
description: "Write a feature spec — objective, scope, rules and testable acceptance criteria."
argument-hint: "<feature>"
---

Write a feature spec for: $ARGUMENTS

- Read the related framing, existing specs and the code areas involved first.
- Every acceptance criterion must be testable; every rule must be unambiguous.
- Separate scope from out-of-scope explicitly; flag hidden scope.
- Ask for missing facts instead of inventing them; list them under "Open questions".
- Finish by reviewing it with the `spec-review` skill when it is installed.

Save it as `docs/specs/<slug>.md`, where `<slug>` is a short kebab-case name. Never overwrite an existing file.

Use this structure:

```markdown
# Spec — <title>

- **Date:** <YYYY-MM-DD>
- **Status:** Draft

## Objective

## Users and context

## Scope

## Out of scope

## Product rules

## Technical rules

## Acceptance criteria

- [ ]

## Risks

## Open questions
```

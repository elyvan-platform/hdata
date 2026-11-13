---
description: "Describe a pull request — context, what changed, what was left out, validation actually run and risks."
argument-hint: "<change>"
agent: agent
---

Write the pull request description for: ${input:subject:change}

- Read the diff and the related spec or issue first.
- Under "Validation", list the exact commands run and their results; never claim checks that did
  not run.
- Be explicit about what was left out and the follow-ups.

Reply with the result in Markdown; do not create a file.

Use this structure:

```markdown
## Context

## What changed

-

## Left out

-

## Validation

-

## Docs updated

-

## Risks and follow-ups

-
```

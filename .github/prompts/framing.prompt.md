---
description: "Frame an idea on one page before it becomes a spec — problem, users, value, scope."
argument-hint: "<idea>"
agent: agent
---

Write a framing one-pager for: ${input:subject:idea}

- Keep it to one page; short, concrete sentences.
- Ask for facts you do not have instead of inventing them; list them under "Open questions".
- Name what is explicitly out, not only what is in.
- Finish by reviewing it with the `framing-review` skill when it is installed.

Save it as `docs/framing/<slug>.md`, where `<slug>` is a short kebab-case name. Never overwrite an existing file.

Use this structure:

```markdown
# Framing — <title>

- **Date:** <YYYY-MM-DD>
- **Status:** Draft

## Problem

## Primary user (and buyer, if different)

## Value proposition

## What we will build first

## Explicitly out

## Open questions
```

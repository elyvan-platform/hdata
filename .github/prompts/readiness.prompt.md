---
description: "Decide whether a milestone or release candidate is ready — with evidence, reservations and blockers."
argument-hint: "<milestone or release>"
agent: agent
---

Write a readiness check for: ${input:subject:milestone or release}

- Gather evidence first: acceptance criteria, validation actually executed, runtime smoke
  results, known issues. Run what is missing or record it as not executed.
- Decide: ready, ready with reservations, or not ready. Never claim more than was observed.
- Use the `readiness-check` skill when it is installed.

Save it as `docs/readiness/<YYYY-MM-DD>-<slug>.md`, where `<slug>` is a short kebab-case name, `<YYYY-MM-DD>` is today. Never overwrite an existing file.

Use this structure:

```markdown
# Readiness — <title>

- **Date:** <YYYY-MM-DD>
- **Milestone / release:**

## Evidence

- [ ] Acceptance criteria met
- [ ] `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass
- [ ] Environment configured for the target
- [ ] Runtime smoke (`/health`, `/ready`, `/version`; device check for mobile apps)
- [ ] Known risks documented

## Validation level reached

## Decision

Ready / Ready with reservations / Not ready

## Reservations and blockers

## Next steps
```

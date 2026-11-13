# Lessons — Operational Memory

Short rules distilled from real incidents in hdata, so mistakes are not repeated. Rules live in
`AGENTS.md`; this file is memory.

## How to use

- Read the entries of the area before relevant work.
- Add a lesson only with evidence of reuse: it happened more than once, caused relevant rework,
  revealed a wrong assumption, or can become a rule, test or guard. One-off fixes stay in the pull
  request.

## Prevention levels

```text
P0 — documented only
P1 — covered by a checklist or template
P2 — covered by a test
P3 — covered by automated validation or CI
P4 — impossible to violate without failing a technical guard
```

## Index

| ID | Lesson | Prevention |
|---|---|---|

<!--
Entry format:

## LES-001 — <rule in one line>

**Rule.** What to do or never do.
**Why.** The incident and its cost.
**Applies to.** Areas or files.
**Prevention.** P0–P4 and where it is enforced.
-->

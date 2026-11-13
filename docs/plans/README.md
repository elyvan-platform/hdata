# Plans

One file per plan with more than one phase, named `<slug>.md`. Create one with
`elyvan new plan "<title>"`.

Every plan starts with this header, which agents search for at the start of a session:

```markdown
- **Status:** Draft | In progress | Paused | Done | Cancelled
- **Resume prompt:** ask | never
- **Next step:** <the one thing to do next>
```

A plan is open while its status is `In progress` or `Paused`; agents then ask whether to resume it.
See "Open plans at session start" in `AGENTS.md`.

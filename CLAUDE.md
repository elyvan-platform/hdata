@AGENTS.md

## Claude Code

- `AGENTS.md` (imported above) is the canonical source of rules; this file only adds
  Claude-specific notes and never overrides it.
- Skills are in `.claude/skills`, which points to `.agents/skills`.
- Project commands are in `.claude/commands` (`/spec`, `/plan`, …).
- Model workflow: Opus (latest) analyses and plans each task, Sonnet (latest) implements it;
  then commit the task. Details in `AGENTS.md` (Working rules).

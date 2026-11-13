# Copilot instructions

[`AGENTS.md`](../AGENTS.md) is the canonical source of rules for hdata; read it first. This
file is a thin adapter and never overrides it.

- Area rules: `.github/instructions/*.instructions.md` (applied by path).
- Skills: `.agents/skills/*/SKILL.md`.
- Prompt files: `.github/prompts/*.prompt.md` (`/spec`, `/plan`, …).
- Model workflow: Astra (latest) analyses and plans each task, Sol (latest) implements it;
  then commit the task. Details in `AGENTS.md` (Working rules).

---
description: "Use when writing commit messages or preparing branches and pull requests."
---

# Commits and pull requests

- Conventional Commits: `<type>(<scope>): <subject>` with types `feat`, `fix`, `refactor`,
  `perf`, `test`, `docs`, `chore`, `ci`, `build`.
- Subject in the imperative, lowercase, no trailing period, at most 72 characters.
- Commit every task once it is done and validated: one task, one commit.
- One concern per commit; no generic messages (`fix`, `update`, `wip`).
- Pull requests describe context, what changed, what was left out, the validation actually run
  and risks (`.github/pull_request_template.md`).

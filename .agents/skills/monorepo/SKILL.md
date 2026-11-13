---
name: monorepo
description: "Use when working across apps and packages of this pnpm + Turborepo monorepo: adding a workspace package, sharing code, wiring internal dependencies, running tasks for one package, or changing turbo.json or the catalog."
---

# Monorepo

Execution guide for the workspace layout. `AGENTS.md` keeps precedence.

## Layout

- `apps/<name>` — deployable apps; `packages/<name>` — internal packages, named
  `<scope>/<name>` (see `scope` in `elyvan.json`). New apps and packages come from `elyvan add app|package`
  (see the `elyvan-cli` skill), never from copying a folder.
- `packages/config` holds the shared `tsconfig.base.json`; apps and packages extend
  `<scope>/config/tsconfig.base.json` and list `"<scope>/config": "workspace:*"` in
  `devDependencies`.

## Tasks

- Root scripts run in every package through Turborepo: `pnpm dev`, `pnpm build`, `pnpm check`,
  `pnpm typecheck`, `pnpm test`.
- One package: `pnpm --filter <scope>/<name> <script>`; a package and its dependencies:
  `pnpm --filter <scope>/<name>... build`.
- Task wiring lives in `turbo.json`. `build` depends on `^build` (dependencies first) and caches
  `dist/**` and `.next/**`. Declare new outputs there when a package produces them.

## Internal packages

1. Create `packages/<name>/package.json` with `"name": "<scope>/<name>"`, `"private": true`,
   `"type": "module"` and the uniform scripts it needs.
2. Extend the shared tsconfig and add `<scope>/config` as a dev dependency.
3. Consumers add `"<scope>/<name>": "workspace:*"`.
4. Keep packages free of app-specific code; a package used only by one app belongs in that app.

## Dependencies

- Add the exact version once to the root `pnpm-workspace.yaml` catalog, then reference it with
  `catalog:` in each package that uses it. Run `pnpm install` at the root only.
- A dependency belongs to the package that imports it, not to the root.

## Pitfalls

- Turborepo runs tasks in strict environment mode: variables a build needs must be declared in
  `turbo.json` (`env` or `globalEnv`), or the cache can serve stale output.
- Never import from another package's `src/` by relative path; depend on the package.

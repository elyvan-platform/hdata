---
name: project-conventions
description: "Use when adding environment variables, scripts, dependencies or operational endpoints to this project, or when unsure where something belongs. Covers the Zod environment schema and .env.example, uniform scripts, the pnpm catalog, /health /ready /version, Biome and elyvan.json."
---

# Project Conventions

Execution guide for the conventions every app in this project shares. `AGENTS.md` keeps
precedence.

## Environment variables

- Each app declares its variables in `src/env/`: one file per capability (`src/env/<unit>.ts`)
  exporting an object of `envVar({ … })` declarations. `src/env/index.ts` composes them into
  `envSchema`; it is generated, so add variables to the unit files, not to the index.
- Declare a variable with `kind` (`string`, `url`, `port`, `int`, `boolean`, `enum` with
  `values`), a `description`, and either a `default`, `required: true`, or nothing (optional).
  Add an `example` when there is no default.
- `loadEnv()` (`src/env/load.ts`) validates once at startup and throws listing every problem.
  Never read `process.env` directly elsewhere; pass the parsed `Env` around.
- After changing the schema run `pnpm env:example`; `pnpm check` fails while `.env.example` is
  stale. Never edit `.env.example` by hand and never commit `.env`.

## Scripts

Every app has the same script names: `dev`, `build`, `check` (Biome + `.env.example`
freshness), `typecheck`, `test`, plus `start` for servers. Keep them working; CI, Docker and
deploy configuration rely on the names.

## Dependencies

- pnpm only. Versions live once, in the `catalog` of `pnpm-workspace.yaml`; every `package.json`
  references them as `catalog:`. To add a dependency, add its exact version to the catalog and
  `"<name>": "catalog:"` to the package that uses it, then `pnpm install`.
- Never pin a version directly in a `package.json`.

## Install hook

The root `package.json` has a `postinstall` that runs `elyvan doctor` when the CLI is on the PATH
and does nothing otherwise. It never fails the install; read its warnings and errors, and do not
remove the script.

## Operational endpoints

Every server answers `GET /health` (process alive), `GET /ready` (dependencies reachable;
503 when not) and `GET /version` (`name` and `version` from `package.json`). Keep them
dependency-free and fast; add readiness checks instead of changing `/health`.

## Code style

- TypeScript strict; erasable syntax only (no `enum`, no namespaces, no parameter properties);
  relative imports keep their `.ts` extension.
- Biome is the only linter and formatter: `pnpm check`, and `pnpm exec biome check --write .`
  to fix formatting.

## Adding apps, packages and blocks

Always use the `elyvan` CLI; the `elyvan-cli` skill lists every command and block. Never
scaffold an app or a block by hand or copy it from another repository: the CLI keeps
`elyvan.json`, the catalog, scripts, env schema and AI kit consistent.

## `elyvan.json`

Records how the project was generated (shape, apps, packages, blocks, AI kit). The project never
depends on the generator to install, build or run; keep the file in version control.

## Before finishing a change

Run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`, and report what actually ran.

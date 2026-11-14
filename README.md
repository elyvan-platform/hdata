# hdata

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm 12.14.0 installed globally (for example `npm install -g pnpm@12.14.0`)

## Structure

| Path | Contents |
|---|---|
| `apps/*` | Applications |
| `packages/*` | Internal packages, published under the `@hdata/*` scope inside the workspace |

Dependency versions are declared once in the `catalog` of `pnpm-workspace.yaml`; every
`package.json` references them as `catalog:`.

## Getting started

```bash
pnpm install
pnpm dev
```

Each app reads its environment from its own `.env` (copy `apps/<app>/.env.example`).

When an app has development services or one-time setup (a database, storage), follow
[`docs/development.md`](docs/development.md) instead: it lists the first-run commands, the
services and the scripts each app's blocks add. `elyvan add` keeps it up to date.

## Scripts

Root scripts run in every workspace package through Turborepo; use `pnpm --filter <package> <script>`
to target one.

| Script | What it does |
|---|---|
| `pnpm dev` | Start every app in development mode |
| `pnpm build` | Build every app and package |
| `pnpm check` | Lint and format check (Biome) and `.env.example` freshness |
| `pnpm typecheck` | Type-check with TypeScript |
| `pnpm test` | Run the tests |

## Environment

Each app declares and validates its variables with Zod in `src/env/`; an app refuses to start with
an invalid environment. Its `.env.example` is generated from that schema: after changing it, run
`pnpm env:example` in the app (`pnpm check` fails while the file is stale).

## Project manifest

`elyvan.json` records how this project was generated (shape, apps, packages and blocks). The
project does not depend on the generator to install, build or run.

Preparação do lançamento do arquivo: [runbook operacional](docs/operations/release.md)
e [readiness](docs/readiness/2026-11-14-lancamento-arquivo.md).

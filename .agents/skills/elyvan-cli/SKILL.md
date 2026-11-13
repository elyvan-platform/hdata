---
name: elyvan-cli
description: "Use before creating or changing project structure: adding an app, package, capability (database, auth, docker, ci, sentry, email, jobs, tailwind…), skill or document, or when files seem out of date after upgrading elyvan. Maps every task to the elyvan command that does it."
---

# Elyvan CLI

Execution guide for the `elyvan` CLI. `AGENTS.md` keeps precedence.

**Rule:** if an `elyvan` command can do what is asked, use it. Hand-write or copy files only for
what the CLI does not cover, and say in the final report which command you checked and why it did
not fit. The CLI keeps `elyvan.json`, the pnpm catalog, scripts, env schema, CI, Docker and the AI
kit consistent; hand-made scaffolding drifts from them.

## Which command for which task

| Task | Command |
|---|---|
| Add an app (monorepo) | `elyvan add app <name> --template <nextjs\|astro\|fastify\|expo>` |
| Add a shared package (monorepo) | `elyvan add package <domain\|api-client\|ui\|mobile-ui>` |
| Add a capability to an app | `elyvan add <block> --app <app>` (omit `--app` for every app that supports it) |
| See what exists, and what an app supports | `elyvan list blocks`, `elyvan list templates`, `elyvan info` |
| Check the project against `elyvan.json` | `elyvan doctor` |
| Bring engine-owned files up to date after upgrading elyvan | `elyvan sync` |
| Set up or update the AI kit (level, agents, skills implied by new blocks) | `elyvan ai init`, `elyvan ai sync` |
| Add, update or remove a catalogue skill | `elyvan skills list\|add\|update\|remove` |
| Start a spec, plan, framing, ADR, PR text or readiness document | `elyvan new <spec\|plan\|framing\|adr\|pr\|readiness> "<title>"` |

New projects come from `elyvan create` (`--shape`, `--template`, `--app name:template`, `--with
<block>`, `--ai`) in a new, empty directory. For a repository that already exists and has no
`elyvan.json` (empty, or holding only `.git`, a README or a license) use `elyvan init --shape
single|monorepo` instead; a single app also needs `--template`. A monorepo starts with no apps: add
them with `elyvan add app`. `init` never overwrites a file (it lists conflicts and writes nothing)
and does not install; run `pnpm install` afterwards.

## Capabilities (`elyvan add <block>`)

Required blocks are added automatically. Run `elyvan list blocks --json` for the authoritative,
current list; this table is a summary.

| Block | Adds | Apps | Needs |
|---|---|---|---|
| `vitest` | Unit tests with the operational endpoints | fastify, nextjs, astro | |
| `playwright` | Browser end-to-end tests | nextjs, astro | |
| `database` | PostgreSQL, Drizzle, migrations, readiness | fastify | |
| `auth` | Better Auth sessions, roles, guards | fastify | database |
| `security` | TOTP two-factor, step-up | fastify | auth |
| `tenancy` | Tenants as organizations, invitations | fastify | auth |
| `permissions` | Tenant roles and permission codes | fastify | tenancy |
| `audit` | Append-only audit log | fastify | auth |
| `rate-limit` | Per-IP and per-account limits | fastify | |
| `jobs` | Background jobs and cron (pg-boss) | fastify | database |
| `email` | Resend in production, Mailpit in development | fastify | |
| `storage` | S3 / R2 with signed URLs | fastify | |
| `github`, `openrouter`, `telegram` | API clients and webhooks | fastify | |
| `sentry` | Error tracking (active with `SENTRY_DSN`) | fastify | |
| `web-auth` | Sign-in and account pages | nextjs | an API with `auth` |
| `mobile-auth` | Sign-in and account screens | expo | an API with `auth` |
| `tailwind` | Tailwind v4 with shadcn theme variables | nextjs | |
| `docker`, `railway` | Dockerfile per server; Railway services | fastify, nextjs, astro | docker → railway |
| `ci` | GitHub Actions workflow | every app | |

Packages (`elyvan add package`): `domain` (shared Zod schemas), `api-client`, `ui` (shadcn/ui for
web) and `mobile-ui`; monorepos only. `config` is added with the monorepo itself.

## Working with it

1. Read `elyvan.json` to see the apps and blocks the project already has.
2. Find the command in the tables above; if unsure, `elyvan list blocks` and `elyvan <command> --help`.
3. Preview with `--dry-run`, then run it. Use `--no-install` only when you will install yourself.
4. Review what it lists. `add` creates files and updates `package.json`, the pnpm catalog and
   `elyvan.json`, but never edits other existing files; it lists the ones that need a manual
   change (for example wiring a route or an import). Make those changes by hand.
5. Run `elyvan doctor` (it also runs after every `pnpm install` when `elyvan` is on the PATH; read
   its output, it never blocks the install), then the validation commands from `AGENTS.md`.

Global options: `--json` (machine-readable output), `--verbose` (diagnostics on failure).

## When the CLI is not enough

- The task is not a capability, template or document the CLI knows (domain code, business
  logic, a library it has no block for): work by hand, following the stack skills.
- The block exists but not for this app (for example `database` on Next.js): do not copy it by
  hand; report the gap and wait for direction.
- Never edit `elyvan.json` by hand to fake a block, and never delete engine-owned files
  (`docker-compose.yml`, CI workflow, `docs/development.md`, `src/env/index.ts`,
  `src/instrument.ts`, `.railway/services.ts`): change the cause and run `elyvan sync`.

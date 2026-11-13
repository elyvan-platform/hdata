---
description: "TypeScript rules for every app and package."
applyTo: "**/*.ts,**/*.tsx"
---

# TypeScript

- `strict` and `noUncheckedIndexedAccess` are on; never use `any` — use `unknown` with type
  guards.
- Avoid `as` casts; prefer type guards, discriminated unions and `satisfies`.
- Erasable syntax only: no `enum` (use `as const` objects), no namespaces, no parameter
  properties. Relative imports keep their `.ts` extension.
- Validate external input (requests, environment, files, third-party responses) with Zod at the
  boundary.
- `const` by default; named exports except where a framework requires a default export; files in
  `kebab-case`.
- Never leave an empty `catch`; rethrow, return an explicit result or report the error.

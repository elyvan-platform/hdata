# Search and catalog (web + API)

What the public consultation does today. Product rules: `specs/arquivo-historico-vila-caiz.md`
(section "Pesquisa"); status: Phase 7 of `plans/arquivo-historico-vila-caiz.md`.

## API (`apps/api`, `src/routes/search.ts`, `src/search/service.ts`)

| Route | Purpose |
|---|---|
| `GET /search` | `q`, `type` (`baptism`/`marriage`/`death`/`undetermined`), `book` (catalog reference code), `from`/`to` (years), `page`, `pageSize` (default 20, max 50). Invalid input is 400. |
| `GET /search/coverage` | Published seats per book; books without seats appear with 0. |
| `GET /records/:recordId` | One published seat; 404 when missing **or not published**. |

- Only the latest `published` revision of a record is read. Drafts, validated-but-unpublished
  revisions and later edits never appear in results, counts, seat pages or image URLs.
  Publication already requires known rights for the source and images.
- `q` matches participants (names, relatives, role and notes such as profession), place and date
  (`1850`, `1850-03`, `12/03/1850`, the date as written). Every word must start some word of the
  record, compared with `normalizeSearchText` (accents, case, documented place variants). It is a
  match, not proof of identity. The manuscript text (`originalText`) is **not** searched; that is
  #87.
- Type, book and period are filtered in SQL; the text comparison runs in memory over the
  published set because the PostgreSQL strategy (FTS/unaccent) still needs its ADR. Order is
  stable: date, then record id. A period filter excludes records without a year.
- Results keep the source spelling and show origin (source name/kind, import or manual), book
  reference, folio/locator and image references.

## Web (`apps/web`)

- `/` — search form (GET, works without JavaScript), coverage line, results, pagination.
  States: not searched yet, loading (`app/loading.tsx`), empty (successful search, no results),
  invalid query, technical error (`role="alert"`). If the catalog fails, the book filter is
  disabled and says so.
- `/catalogo` — catalog books with real published counts and "pesquisar neste livro".
- `/assento/[recordId]` — seat details, participants, official record link, viewer link and
  image references; unavailable links are stated, not hidden. The viewer is the official
  Digitarq one (external link).

## Validation done

`pnpm check`, `typecheck`, `test`, `build`; plus Fastify and `next start` running together
against a PGlite database with one published seat: search from `/` with filters, seat page,
source links, empty search and 404. A PostgreSQL server was not available, so that run used
PGlite (PostgreSQL compiled to WASM), not a server instance.

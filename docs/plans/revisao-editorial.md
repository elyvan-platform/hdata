# Revisão editorial e histórico de alterações

- **Status:** Paused
- **Resume prompt:** never
- **Next step:** Validar a concorrência em PostgreSQL real e trocar o autenticador por sessões Better Auth.

## Fases

1. **Done** — Contratos de domínio, migração `0004` (estado `published`, `revision_event`), serviço, rotas e testes de permissões, conflito e concorrência.
2. **Done** — Cliente da API e páginas web (`/revisao`, ficha, formulário, decisões).
3. **Pending** — Better Auth (sessões e utilizadores) no lugar dos tokens; teste com ligações independentes em PostgreSQL.

## Log

- 2026-11-14 — Implementadas as fases 1–2. Pré-requisitos 03/05 e branch develop inexistentes; trabalho sobre `main` num branch. CLI Elyvan indisponível, blocos Better Auth/autorização/auditoria feitos à mão. Ver `docs/editorial-review.md`.

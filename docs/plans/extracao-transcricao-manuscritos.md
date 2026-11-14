# Extração de propostas de transcrição de manuscritos

- **Status:** Paused
- **Resume prompt:** ask
- **Next step:** Medir o piloto (fase 3): registar a imagem m0006, correr a extração e comparar com um conjunto revisto à mão.

## Fases

1. **Done** — Contratos de domínio (`extraction.ts`), migração `0005`, serviço idempotente com tentativas limitadas, fornecedor de modelo e carregador de imagem, worker pg-boss, testes (PGlite).
2. **Done** — Revisão humana de propostas (`reviewProposal`) e documentação em `docs/extraction-pilot.md`.
3. **Blocked** — Medição: falta a imagem, a chave do modelo e o conjunto de referência; harness `evaluatePilot` pronto.
4. **Pending** — Rotas/página de revisão de propostas e bloco storage (verificação de direitos concluída pela tarefa 11).

## Log

- 2026-11-14 — Fases 1–2 implementadas sobre `main` (pré-requisitos 03/07 e `develop` inexistentes). CLI Elyvan indisponível: jobs/storage/modelos feitos à mão. pg-boss não testado contra PostgreSQL real. Sem medições reais.

- 2026-11-14 — Tarefa 11 acrescenta verificação de direitos em fonte/imagem, concessão
  retomável e proteção contra respostas antigas. Executor, orçamento e cobertura
  descritos em `../extraction-batch.md`; medição real continua bloqueada por dados.

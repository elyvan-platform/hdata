# Plan — Modelo de arquivo

- **Status:** Paused
- **Resume prompt:** never
- **Next step:** Validar concorrência em PostgreSQL com ligações independentes e concluir a proteção do snapshot contra inserções posteriores.

## Fases

1. **In progress** — Contratos Zod e datas parciais. Os contratos de arquivo e testes de dados incompletos estão implementados; falta completar os contratos das entidades de índice e transcrição previstas no plano geral.
2. **In progress** — Tabelas e migração Drizzle. Migrações, referências, unicidade e importação foram testadas em PGlite; falta testar concorrência num servidor PostgreSQL e impedir inserções posteriores nas coleções de revisões.
3. **In progress** — Documentação e validação. O modelo está documentado e os comandos do repositório foram executados; falta validação em Node 24 e PostgreSQL externo.

## Log

- 2026-11-14 — Implementados contratos, migrações, proteção contra alteração e remoção de revisões e reimportação transacional. Testes PGlite verificam migração, restrições e reimportação sequencial. CLI Elyvan indisponível, branch develop e remoto ausentes. O servidor PostgreSQL e Node 24 não estavam disponíveis. Falta testar concorrência real e impedir anexar participantes ou imagens a uma revisão já criada.

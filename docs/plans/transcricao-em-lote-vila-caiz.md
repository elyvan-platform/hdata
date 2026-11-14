# Transcrição em lote de Vila Caiz

- **Status:** Paused
- **Resume prompt:** never
- **Next step:** Obter páginas enumeradas e evidência de reutilização/processamento externo; executar e medir o piloto real de óbitos.

## Plano

Uma fase de implementação, após análise: contratos em domain; executor e CLI em
api/extraction; testes de integração; relatório e instruções de operação.
Reutilizar extraction_run/proposal e reviewProposal, sem publicar automaticamente.
Elyvan `new plan "Transcricao em lote Vila Caiz" --dry-run` indisponível (127).
Não existe develop nem remoto; base disponível main. Não há troca de modelo disponível.

### Fase 1 — Done

- [x] Manifesto validado, prioridade a óbitos e metadados de conteúdo inacessível.
- [x] Reexecução idempotente, tentativas limitadas, orçamento e concorrência limitados.
- [x] Índice de propostas e fila de revisão com proveniência, sem alterar correções.
- [x] Relatório das oito fontes, sem inventar documentos/páginas ou direitos.
- [x] check, typecheck, test, build e smoke health.

Riscos: inventário sem páginas ou direitos confirmados; nenhum corpus real pode
ser enviado ao modelo. Índices existentes só são reutilizados quando disponíveis,
sem converter entradas de índice em transcrição. O piloto de óbitos usa fixtures.

## Log

- 2026-11-14 — Análise: spec/plano #75 e tarefas prévias lidos. Plano de extração
  aberto continua bloqueado por dados externos; tarefa atual autoriza o executor.
  Sem imagens, exportações históricas ou direitos confirmados no inventário MVP.

- 2026-11-14 — Implementação concluída e validada: contrato partilhado, CLI preview/apply,
  orçamento persistente de chamadas/custo estimado, concorrência limitada, concessões
  reclamáveis e proteção contra respostas antigas, direitos antes do I/O, reutilização
  de transcrições/índices e export de propostas/fila editorial. Imagem/livro/página
  conferidos com o catálogo; cobertura conserva os campos do inventário original.
  `pnpm install`, `pnpm check`, `pnpm typecheck`, `pnpm test` (71 testes, 51 na API),
  `pnpm build` e preview do manifesto terminaram com 0. API compilada iniciada com
  `pnpm --filter @hdata/api start`: GET /health 200, {"status":"ok"}.
  Primeira suite completa revelou correspondência incorreta nas fixtures, corrigida
  com sequências reais e verificação do localizador; outra execução sob build
  concorrente excedeu timeout do catálogo. Suite final isolada passou sem alterar
  testes existentes ou limites. Migrações exercitadas por PGlite.
  CLI Elyvan ausente (127); documentos e lógica de domínio escritos à mão, sem
  novos blocos/apps. Sem develop/remotos; branch feat/vila-caiz-batch de main local.
  Sem troca de modelo; análise e plano precederam implementação. Node observado
  v22.23.3: Node 24 não certificado. PostgreSQL real, advisory lock em múltiplos
  processos, faturação externa e modelo real não exercitados. Nenhum deploy/push.
  Commit não criado (opcional nesta tarefa).
  Plano pausado apenas porque o acervo real não está disponível/autorizado: oito
  entradas de inventário, zero páginas processáveis confirmadas, índice/fila reais
  vazios. Não confundir o piloto sintético testado com cobertura do acervo.

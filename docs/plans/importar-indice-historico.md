# Importar índice histórico

- **Status:** Paused
- **Resume prompt:** never
- **Next step:** Recuperar exportações autorizadas do protótipo e fontes secundárias para executar a reconciliação histórica real.

## Plano

Uma fase técnica — **Done** (sem commit local; commit opcional nesta tarefa). Contratos em `packages/domain`, leitor JSON/XLSX,
reconciliação e comando local em `apps/api/src/archive`, staging Drizzle e documentação.
Mapeamento explícito porque não existe exemplo recuperável dos formatos históricos.
Preservar dados originais, TIF, confiança e proveniência separadas por entrada;
identidade por fonte e ID externo, versões por hash, conflitos sem sobrescrita.
Sem rotas públicas ou promoção automática a assentos/transcrições validados.

Critérios de saída:
- [x] Pré-visualização JSON/XLSX, rejeições, diferenças, conflitos e duplicados testados.
- [x] Persistência transacional e reimportação idempotente testadas.
- [x] Totais esperados 484/254 comparados sem alegar recuperação de fontes ausentes.
- [x] `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` executados.

Riscos: exportações, direitos e URLs das fontes secundárias ausentes; a reconciliação
real fica explicitamente por executar. Não existe branch develop nem remoto.

## Log

- 2026-11-14 — Análise antes da implementação. Elyvan list blocks e new plan --dry-run
  falharam com 404; documento criado manualmente. Modelos não trocados nesta sessão;
  mantida a separação entre análise/plano e implementação.

- 2026-11-14 — Fase técnica validada: pnpm check, pnpm typecheck, pnpm test e
  pnpm build passaram; comando local testado com fixture JSON; API iniciada via
  pnpm --filter @hdata/api start e GET /health devolveu 200 com status ok.
  Migração, imutabilidade, rollback e reimportação testados com PGlite. Ambiente
  disponível: Node 22.23.3, pnpm 12.14.0; Node 24 e PostgreSQL real não validados.
  Permanece por executar a aceitação com os 738 registos reais e a avaliação externa
  das fontes: ficheiros, referências e condições não estão disponíveis. Plano pausado
  por essa limitação factual, sem decisão de produto pendente. Não retomar outros planos.

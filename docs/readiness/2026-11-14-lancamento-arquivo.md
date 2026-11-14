# Readiness — Lançamento arquivo Vila Caiz

- **Date:** 2026-11-14
- **Milestone / release:** tarefa 09; preparação local, sem implantação

## Evidence

- [ ] Acceptance criteria met — percurso com acervo real ainda não demonstrado
- [x] `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass (exit 0)
- [ ] Environment configured for the target
- [ ] Runtime smoke integral — API /ready 503, sem PostgreSQL
- [x] Known risks documented

## Validation level reached

Testes de integração Fastify/PGlite e renderização estática React, com fixtures
sintéticas. Não são um teste de browser nem um ensaio PostgreSQL/Railway.
`pnpm install --frozen-lockfile`: exit 0. `pnpm check`, `pnpm typecheck`,
`pnpm test` e `pnpm build`: exit 0. API: 60 testes; web: 9 testes; restantes
pacotes também passaram pelo gate. Teste específico:
`pnpm --filter @hdata/api exec vitest run src/search/search.test.ts`: 9 passaram.
A primeira tentativa isolada antes do build de domain falhou por exports ainda
não compilados; depois de `pnpm --filter @hdata/domain build` passou.

Builds iniciados com `pnpm --filter @hdata/api start` e
`pnpm --filter @hdata/web start`. Pedidos HTTP locais por urllib.request,
timeout 8s: API health/version 200, ready 503 (`database: down`); web
health/ready/version 200. Ambos reportaram `release-readiness-local`, marcador
de ensaio, não hash de release. DATABASE_URL explicitamente local; worker desligado.
Nenhuma ligação ou alteração a ambiente remoto. O plano contém a matriz de cobertura.
Node fornecido v22.23.3, pnpm 12.14.0; Node 24 ainda por validar.

## Decision

**Not ready** para lançar o arquivo real. A preparação local não demonstra a
aceitação integral nem autoriza exposição pública.

## Reservations and blockers

- Develop/remoto ausentes; integração de 02–07 não confirmada nessa branch.
- CLI Elyvan ausente; tentativa de obter 0.8.0 pelo registry devolveu 404.
  Docker/Railway/Sentry não gerados, imagens e recolha de erros não validadas.
- Nenhum percurso com dados reais validados; não há medição do acervo de uma
  implantação. Totais históricos 484/254 não recuperados, livros 39/27/22 por
  reconciliar; não há percentagem comprovada. Ver [limitações](../search.md).
- Política privada da spec ainda não implementada para consulta; não existe sessão
  de investigador. Papéis editoriais têm testes, mas não há garantia de separação
  por identidade caso uma pessoa receba vários papéis/tokens. Rever antes de expor.
- PostgreSQL real, migrações no alvo, backup R2 encriptado, restauro e rollback não
  executados. O runbook é procedimento a demonstrar, não infraestrutura instalada.
- Endpoint e direitos Digitarq por confirmar; diagnóstico alojado por executar.
- Piloto 08 excluído: sem imagens autorizadas/medição; chave do worker ausente.

## Next steps

Seguir o [runbook](../operations/release.md) num ambiente autorizado: confirmar
base e acesso, gerar blocos, ensaiar PostgreSQL/backup/restauro/rollback, importar
e rever fontes com direitos e registar consultas e links reais por tipologia.
Implantação tem validação separada; não há autorização nesta entrega para publicar.

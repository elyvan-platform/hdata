# Plan — Arquivo histórico Vila Caiz

- **Status:** Draft
- **Resume prompt:** ask
- **Next step:** Rever a spec e aprovar o âmbito e a predefinição privada; iniciar a fase 1 com fixtures sintéticas, mantendo a aquisição de fontes em paralelo.
- **Date:** 2026-11-13
- **Spec:** [Arquivo histórico Vila Caiz](../specs/arquivo-historico-vila-caiz.md)

## Approach

Este documento entrega o planeamento pedido; não autoriza executar as fases de
produto. A spec e este plano aguardam aprovação. Separar análise de implementação
em cada fase; usar os modelos de AGENTS.md quando a ferramenta permitir alternar.

Estado observado: só `packages/config`, nenhuma app, bloco `ci`, lessons sem
entradas e nenhum plano anterior aberto. Só existe branch local `main`, sem
remoto ou `develop`; não foi possível confirmar a base solicitada nem os
pré-requisitos integrados. Trabalho documental isolado em
`docs/arquivo-historico-spec`, sem alterar código/configuração gerados.

CLI `elyvan` ausente: tentados `--version`, `list blocks --json`, `new --help`,
`new spec "Arquivo histórico Vila Caiz" --dry-run` e
`new plan "Arquivo histórico Vila Caiz" --dry-run`, todos indisponíveis.
Documentos preenchidos pelos templates locais `.claude/commands/spec.md` e
`plan.md`. O catálogo do CLI não foi confirmado: os comandos abaixo são candidatos
constantes da skill local, a verificar com `--help`, catálogo e `--dry-run` antes
de executar. Nunca presumir que um bloco gera todo o comportamento de domínio.

## Phase status

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 — Especificação e plano (tarefa 01) | Done | — (entrega local sem commit) | Inventário documental e revisão concluídos; validação registada no Log |
| 1 — Contratos e fixtures | Next | — | Depende de aprovação de 0 |
| 2 — API e persistência | Pending | — | Depende de 1 |
| 3 — Autenticação, autorização e auditoria | Pending | — | Depende de 2 |
| 4 — Aquisição e importação de fontes | In progress | — | Inventário parcial em `docs/sources/vila-caiz-inventario.md` (sem fontes primárias acedidas; 39/27/22 livros por reconciliar); importador depende de 2 e 3 |
| 5 — Imagens e armazenamento | Pending | — | Depende de 3; material real depende de direitos em 4 |
| 6 — Gestão editorial e revisão | Pending | — | Depende de 1 e 3; usa fixtures enquanto 4/5 não disponíveis |
| 7 — Pesquisa e consulta | In progress | — | Pesquisa de assentos publicados, API, cliente e frontend (`/`, `/catalogo`, `/assento/[id]`) entregues; ver `../search.md` e o log de #80. Faltam ADR da estratégia, decisão de acesso privado/público, Playwright e dados reais |
| 8 — Publicação, operação e entrega | Pending | — | Depende de 7 e decisão de acesso; direitos apenas para material real |

Estados: `Pending`, `Next`, `In progress`, `Done`, `Blocked`. Cada fase só passa a
`Done` após validar os critérios. Em futuras entregas registar o hash do commit
concluído; esta entrega não cria commit, conforme opção autorizada na tarefa.
Ao iniciar produto, mudar o cabeçalho para `In progress`; ao parar, `Paused` com
próximo passo e log. Só marcar o plano `Done` quando todas as fases terminarem.

## Phases

### Phase 0 — Especificação e plano

- Work: ler regras e contexto, inventariar fontes disponíveis e documentar fluxos,
  acesso, camadas de informação, lacunas, dependências e validação.
- Exit criteria:
  - [x] Spec distingue livros, imagens, índices e transcrições, define assentos,
    proveniência, pesquisa, revisão humana e critérios verificáveis.
  - [x] Quatro fontes inventariadas sem afirmar conteúdo ou direitos não observados.
  - [x] Plano com estados, dependências, critérios e próximo passo; produto em Draft.
- Validation: revisão cruzada com aceitação da tarefa; `pnpm check`,
  `pnpm typecheck`, `pnpm test`, `pnpm build` (resultados no Log).

### Phase 1 — Contratos e fixtures

- Work: confirmar CLI instalado e catálogo; candidato `elyvan add package domain`.
  Definir schemas Zod de fundo, livro, imagem, índice, assento, participante,
  transcrição, proveniência e estados; fixtures sintéticas sem material externo.
- Exit criteria:
  - [ ] Schemas únicos partilháveis; datas incertas e fontes/direitos desconhecidos
    explícitos; índice não é transcrição.
  - [ ] Casos válidos e inválidos testados, incluindo nomes originais e normalizados.
- Validation: `pnpm --filter @hdata/domain test` e quatro comandos de raiz da fase 0.

### Phase 2 — API e persistência

- Work: candidatos `elyvan add app api --template fastify`,
  `elyvan add database --app api`, `elyvan add vitest --app api`.
  Rever wiring gerado, migrações e contratos de catálogo/assentos/proveniência.
- Exit criteria:
  - [ ] Migrações aplicam numa base vazia; relações e versões preservadas em round-trip.
  - [ ] Ambiente Zod, `.env.example` e endpoints operacionais funcionais.
- Validation: quatro comandos de raiz; `pnpm --filter @hdata/api test` com PostgreSQL
  de teste; iniciar build com `pnpm --filter @hdata/api start` e solicitar
  `/health`, `/ready`, `/version` no endereço configurado, incluindo falha de dependência.

### Phase 3 — Autenticação, autorização e auditoria

- Work: candidatos `elyvan add auth --app api`, `elyvan add audit --app api`,
  `elyvan add rate-limit --app api`; implementar papéis e autorização por recurso.
- Exit criteria:
  - [ ] 401/403/5xx distinguíveis; matriz editor/revisor/admin/investigador testada.
  - [ ] Histórico append-only e separação autor/revisor protegidos na API.
- Validation: testes de integração de sessão, permissões, tentativas de alterar
  auditoria e falha técnica; quatro comandos de raiz e smoke operacional da fase 2.

### Phase 4 — Aquisição e importação de fontes

- Work: completar inventário da spec com evidência, datas e direitos por fonte;
  mapear protótipo, catálogo, índices e m0006 apenas quando acessíveis legalmente.
  Importadores são código de domínio, não um bloco presumido do CLI.
- Exit criteria:
  - [ ] Para cada fonte há amostra autorizada ou ausência/restrição documentada;
    ausência não bloqueia as restantes fases com fixtures.
  - [ ] Importação sintética repetida é idempotente; conflitos, erros e lote têm
    proveniência e relatório explícito, sem converter índices em transcrições.
  - [ ] Material real, se importado, tem mapeamento e condições comprovados.
- Validation: testes de reimportação, rollback/erro e correspondência de referências;
  quatro comandos de raiz. Comparar manualmente amostra importada à fonte disponível.

### Phase 5 — Imagens e armazenamento

- Work: candidato `elyvan add storage --app api`; R2 privado, referências de
  fólios/regiões e URLs assinadas condicionadas a autorização.
- Exit criteria:
  - [ ] Fixtures de imagem ligadas ao livro e assentos; restrições independentes.
  - [ ] Utilizador sem autorização não obtém imagem/URL; expiração verificada.
  - [ ] Armazenamento de imagens reais só com condições confirmadas na fase 4.
- Validation: integração de armazenamento de teste e acesso/expiração; quatro
  comandos de raiz. Não depender de credenciais de produção na suite.

### Phase 6 — Gestão editorial e revisão

- Work: candidatos `elyvan add app web --template nextjs`,
  `elyvan add web-auth --app web`, `elyvan add tailwind --app web`,
  `elyvan add package ui`, `elyvan add package api-client` e bloco `playwright`.
  Reutilizar schemas e componentes; implementar rascunho, submissão, decisão e versões.
- Exit criteria:
  - [ ] Editor cria assento e evidências; revisor distinto decide com motivo.
  - [ ] Correção cria versão sem apagar a publicada; proveniência navegável.
- Validation: testes de componentes e Playwright dos percursos editor/revisor;
  quatro comandos de raiz, incluindo export/build web e API.

### Phase 7 — Pesquisa e consulta

- Work: ADR da estratégia de pesquisa após consulta à documentação oficial e teste
  com fixtures; avaliar PostgreSQL FTS/unaccent sem os assumir aprovados.
  Implementar catálogo, filtros, paginação, variantes e apresentação de fontes.
- Exit criteria:
  - [x] Critérios de pesquisa da spec demonstrados em fixtures com acentos e variantes (`apps/api/src/search/search.test.ts`).
  - [x] Sem fugas por resultados, contagens, excertos ou URLs de imagens: só a última revisão publicada é lida (exportações não existem).
  - [ ] Consulta privada funciona; modo público permanece desativado por predefinição.
- Validation: testes de pesquisa e permissões na API, Playwright de consulta e
  falha técnica; quatro comandos de raiz e smoke operacional.

### Phase 8 — Publicação, operação e entrega

- Work: documentar decisão de acesso por ADR (candidato `elyvan new adr`), incluindo
  escolha de manter privado. Candidatos `docker`, `railway`, `sentry` via
  `elyvan add <block> --app <app>` conforme catálogo e compatibilidade.
  Preparar backups R2 separados e restauro, observabilidade e documentação operacional.
  Deploy/publicação externa exige autorização própria; este plano não a concede.
- Exit criteria:
  - [ ] Decisão de acesso explícita; se público, direitos e regra temporal comprovados
    por camada; caso contrário entrega privada completa.
  - [ ] Critérios da spec executados; falhas de fontes documentadas sem dados inventados.
  - [ ] Build e smoke operacionais, backup encriptado e restauro de teste demonstrados;
    retenção 7 diários/4 semanais/6 mensais e teste mensal documentados.
- Validation: quatro comandos de raiz; testes de acesso público/privado, smoke
  `/health`, `/ready`, `/version`, ensaio de restauro em ambiente isolado e revisão
  da documentação de operação. Não publicar automaticamente.

## Risks

Fontes indisponíveis são tratadas na fase 4 em paralelo, não como dependência de
schemas ou interfaces sintéticas. Direitos desconhecidos bloqueiam apenas usos
reais que deles dependem. A aprovação de publicação não é presumida. A fase 7
valida a estratégia de pesquisa antes de a fixar. CLI e versão do runtime devem
ser disponibilizados antes do scaffolding de produto; rever este plano perante
qualquer divergência do catálogo. Confirmar base `develop` quando houver remoto.

## Out of scope

Implementar fases 1–8 nesta tarefa, OCR/HTR, genealogia, scraping, outros fundos,
publicação externa e alterações à configuração gerada apenas para documentação.

## Log

- 2026-11-13 — Análise e entrega documental concluídas pelos templates locais;
  CLI ausente e fontes externas não verificadas. Sem troca de modelo disponível;
  análise separada da redação. Base disponível: main local sem remoto, não develop.
  Produto permanece Draft; próxima ação: revisão/aprovação, depois fase 1.
- 2026-11-14 — Inventário de fontes de Vila Caiz (tarefa 10), a partir do fundo PT/ADPRT/PRQ/PAMT38.
  Feito: `docs/sources/vila-caiz-inventario.md` e `.csv` com termos, fontes, tipologias, homónimos,
  bloqueios e lacunas. Evidência apenas de trechos de pesquisa web: Digitarq, ADPRT e tombo.pt não
  acedidos (CONNECT 403 no ambiente). Fundo: 27 volumes (ADPRT via pesquisa); tombo.pt por contagem
  de linhas 8+9+5=22; a base da tarefa diz 39. Divergência por resolver: falta a lista nominal de
  unidades de instalação do Digitarq. Sem conteúdo de assentos lido. Pendente: reconciliar 39 livros,
  ler condições de acesso/reutilização (ADPRT), verificar Repositório Histórico e registo civil.
  Base: branch local `docs/inventario-fontes-vila-caiz` a partir de `main`; `develop` e a #79 não
  existem neste clone. Próxima ação: abrir o Digitarq a partir de ambiente autorizado e atualizar o CSV.
- 2026-11-13 — Validação: `pnpm install`, `pnpm check`, `pnpm typecheck`,
  `pnpm test` e `pnpm build` terminaram com código 0. Biome verificou 6 ficheiros;
  Turbo não executou tarefas nos quatro comandos (só existe `@hdata/config`).
  Revisão documental cobriu os critérios desta tarefa; critérios funcionais da
  spec ficam para as fases futuras. `node --version` no shell: v22.23.3, inferior
  ao Node 24 requerido; não se certifica aqui a execução em Node 24.
  `elyvan doctor` não foi validado: postinstall termina mesmo sem CLI disponível.

- 2026-11-14 — Tarefa 11: executor de lotes sobre a extração existente, orçamento
  persistente, direitos por fonte/imagem, retoma e export de propostas/revisão.
  Manifesto e cobertura das oito entradas em `docs/sources/vila-caiz-lote.json` e
  `vila-caiz-cobertura.json`. Não há páginas enumeradas/autorizadas: fases de
  aquisição e medição real permanecem incompletas. Ver `../extraction-batch.md`.
- 2026-11-14 — Tarefa 12: verificação local dos pré-requisitos e da cobertura.
  O único mecanismo de pesquisa identificado é a normalização em `domain/search.ts`;
  não há pesquisa integrada de assentos, transcrições e metadados, nem controlo de
  acesso para os seus resultados. O inventário I01–I03 fornece apenas contagens
  não verificadas para batismos, casamentos e óbitos; I04 pode sobrepor-se-lhes,
  I05–I07 não têm conteúdo confirmado e I08 pode repetir I01–I03. Não há lista
  nominal de livros, páginas enumeradas, índices recuperados ou transcrições reais
  disponíveis para medir cobertura, verificar ligações ou demonstrar um nome novo.
  Os 22 volumes estimados por série não reconciliam com os 27 do fundo e os 39
  referidos na tarefa anterior. Nenhuma percentagem de cobertura é justificável.
  Antes de lançamento e deploy (#83/#84), obter e verificar catálogo nominal,
  direitos, imagens e índices; importar e rever os dados; implementar pesquisa
  autorizada e reconciliação; medir por livro e fonte e demonstrar o nome novo.
  Não considerar a fase 7 nem os critérios de aceitação concluídos.

- 2026-11-14 — #80 (frontend de pesquisa e catálogo): `GET /search`, `GET /search/coverage`
  e `GET /records/:id` na API (apenas última revisão `published`), `search`/`coverage`/`record`
  no `api-client`, e no web a homepage "Memória de Vila Caiz" com pesquisa (nome, familiares,
  lugar, profissão, data; filtros tipo/livro/período; paginação; estados de carregamento,
  vazio e erro), `/catalogo` com contagens reais e "pesquisar neste livro", e `/assento/[id]`
  com ficha oficial, visualizador e imagem. Texto dos manuscritos fica fora (#87). Validado
  ponta a ponta com Fastify + Next.js em produção sobre PGlite (motor PostgreSQL em WASM);
  **não** contra um servidor PostgreSQL, indisponível no ambiente. Decisão a confirmar: a
  consulta serve dados publicados sem sessão (a publicação exige validação e direitos
  conhecidos); o modo privado/investigador por âmbito continua por implementar. Antes de #83/#84:
  ADR da estratégia de pesquisa, Playwright e dados reais importados.

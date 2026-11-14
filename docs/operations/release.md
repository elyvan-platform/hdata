# Lançamento do arquivo — runbook

Estado em 2026-11-14: preparação local; **não autoriza publicação**.
Decisão e evidência: [readiness](../readiness/2026-11-14-lancamento-arquivo.md).
O piloto de extração fica fora do lançamento. Fixtures não são acervo.

## Ambiente e infraestrutura

Exigir Node 24 e pnpm 12.14.0. Usar develop com pré-requisitos 02–07 integrados,
registar commit e versão anterior; este clone só fornece main sem remoto.
Antes de expor serviços resolver o acesso privado da spec: a consulta atual não
exige sessão. Não presumir que direitos conhecidos equivalem a autorização pública.

O CLI Elyvan não está disponível; `elyvan doctor`, `elyvan list blocks --json`,
`elyvan new readiness` e dry-runs docker (api/web), railway (api), sentry (api)
não executaram (127). `pnpm dlx elyvan@0.8.0 --help` devolveu 404.
Não existem blocos Docker/Railway/Sentry instalados. Quando disponível, rever o
catálogo e gerar pelos comandos `elyvan add <block> --app <app> --dry-run`, depois
aplicar. Docker e Railway para api/web; Sentry para Fastify conforme suporte do
catálogo. Rever wiring, recolha/redação de dados pessoais e testar um erro técnico
sem conteúdo histórico ou tokens. Não afirmar observabilidade antes desse ensaio.

Conferir os schemas `apps/{api,web}/src/env/schema.ts` e exemplos gerados:

| Serviço | Variáveis | Regra para o alvo |
|---|---|---|
| API | NODE_ENV, HOST, PORT | production; interface/porta do serviço |
| API | DATABASE_URL | Segredo obrigatório do PostgreSQL alvo; nunca default localhost |
| Ambos | COMMIT_SHA | Mesmo commit de release; conferir /version |
| Web | API_URL | URL interna alcançável da API, só no servidor; nunca default localhost |
| API | DIGITARQ_CATALOG_URL, DIGITARQ_FONDS_REFERENCE, DIGITARQ_TIMEOUT_MS | Endpoint e contrato confirmados; fundo PT/ADPRT/PRQ/PAMT38; timeout limitado |
| API | CATALOG_REFRESH_TOKEN | Segredo com pelo menos 16 caracteres; ausente desativa refresh |
| API | EDITORIAL_ACTORS | Segredo JSON de atores/tokens/papéis; ausente desativa revisão |
| API | ANTHROPIC_API_KEY | Ausente: worker desligado neste lançamento |
| API | EXTRACTION_MODEL, EXTRACTION_MAX_ATTEMPTS, EXTRACTION_TIMEOUT_MS | Não configurar para ativar piloto; defaults não arrancam worker sem chave |
| API futura | SENTRY_DSN | Ainda não suportada pelo schema; configurar só após bloco e wiring validados |

Não guardar valores no Git, logs ou bundle cliente. Regenerar `.env.example` pelo
script da app se o schema mudar. Variáveis documentadas não provam configuração remota.

## Migração

1. Suspender escritas editoriais, importadores e consumidores; registar início da janela.
2. Fazer backup e comprovar restauro antes de qualquer migração.
3. Num job único, com dependências de desenvolvimento instaladas e DATABASE_URL
   explicitamente apontado ao alvo, executar `pnpm --filter @hdata/api db:migrate`.
   O script usa drizzle-kit (devDependency); não presumir que existe numa imagem
   de produção. Validar o job/pre-deploy gerado antes de escolher a imagem.
4. Conferir journal Drizzle e migrações 0000–0007; guardar resultado sem credenciais.
   Não editar migrações já aplicadas. Falha interrompe o lançamento.
5. Executar os smokes e só depois retomar escritas.

## Backups e teste de restauro

Procedimento obrigatório ainda não implementado nem ensaiado neste clone:
`pg_dump` diário em formato custom, encriptar antes de enviar para bucket R2
separado do armazenamento da aplicação; retenção 7 diários / 4 semanais / 6 mensais.
Definir responsável operacional, alertas de falha, chave em cofre separado e
responsável substituto com acesso testado. Não apagar cópias antes de verificar
integridade e sucesso do upload. Escolher ferramentas de encriptação/upload no
ambiente autorizado e registar comandos/versões exatos no relatório do ensaio.

Mensalmente e antes do primeiro lançamento: descarregar e verificar checksum,
desencriptar em ambiente isolado e restaurar com pg_restore numa base nova vazia.
Comparar contagens de source, book, archive_record, record_revision, participant,
record_revision_image, revision_event, historical_entry e catalog_version com o
snapshot do backup. Conferir referências, versão publicada e proveniência por
amostra. Numa transação de ensaio confirmar que UPDATE/DELETE de snapshots e
eventos append-only são recusados; fazer rollback. Executar pesquisa e ficha
contra a base restaurada. Registar data UTC, origem do backup, hash, versões,
duração, contagens esperadas/observadas, erros e responsável, sem dados pessoais.
Uma cópia sem restauro comprovado não cumpre o critério de backup.

## Smoke e percurso até à fonte

Após deploy autorizado, pedir `/health`, `/ready`, `/version` em ambos os serviços;
exigir HTTP 200 e COMMIT_SHA esperado. A readiness web só valida ambiente: exigir
a da API também. Falhas técnicas não são resultados vazios de pesquisa.

Para batismo, casamento e óbito, com e sem assentos indexados, registar:

| Data UTC / revisão | Fonte / direitos | Consulta e filtros | ID / livro / fólio | Esperado | Observado / URL oficial aberta |
|---|---|---|---|---|---|
| Pendente | Pendente | Pendente | Pendente | Pendente | Não executado |

Usar dados reais importados e publicados após revisão, com direitos confirmados.
Testar nomes, período que exclui datas desconhecidas, filtros combinados, livro
com zero resultados, links ausentes, reimportação repetida e correção editorial
(rascunho preserva leitura publicada; republicação muda pesquisa).
Num ambiente isolado simular timeout/5xx do Digitarq: refresh falha explicitamente,
catálogo fica stored_copy, IDs e pesquisa publicada mantêm-se.
Fixtures automatizadas cobrem lógica; não demonstram links reais nem navegação de browser.

## Rollback

Suspender escritas/consumidores. Repor imagem anterior apenas com schema compatível.
Caso contrário restaurar backup verificado numa base nova, reconciliar escritas
posteriores com registo auditável e trocar DATABASE_URL controladamente. Nunca
apagar revisões para reverter uma publicação; nunca presumir que imagem reverte
migração. Repetir smoke, contagens e percurso de pesquisa antes de reabrir escritas.
Guardar evidência de ensaio e tempo de recuperação; nenhum rollback foi executado aqui.

## P0 — assets e smoke pós-deploy (2026-11-14)

Plano desta intervenção: uma fase para verificar os PNGs e empacotamento,
implementar um smoke de leitura sobre contratos existentes e registar evidência.
Skills consultadas: elyvan-cli, project-conventions e monorepo. O comando
`elyvan new readiness "Assets e smoke de produção" --dry-run` devolveu 127;
a evidência foi acrescentada a este runbook existente. Não foi possível trocar
modelos; análise precedeu implementação. Não se alteraram os planos editoriais.

### Evidência pública e bloqueios

Leitura ao vivo via Firecrawl (`maxAge: 0`) em 2026-11-14:

| URL em https://hdata.up.railway.app | Observado | Evidência (scrapeId) |
| --- | --- | --- |
| `/` | HTTP 200; «Ainda não há assentos publicados» | `01a1d971-84e0-72b8-bc19-a39cc0469874` |
| `/brand/memoria-de-caiz-texto.png` | HTTP 404, HTML em vez de PNG | `01a1d972-5a9e-7189-9a5d-441d46ea88d2` |
| `/version` | HTTP 200; `@hdata/web`, `0.0.0`, sem commit | `01a1d972-a9ee-7578-b454-5011754e6cca` |

Base local: `397aadf`. Não há PNGs da marca em `git ls-files`, nem diretório
`apps/web/public`, remoto Git, histórico da #89 ou configuração Docker/Railway
neste clone. Não é possível atribuir a falha apenas ao empacotamento Railway:
os ficheiros já faltam na origem disponível. Não foram fabricados substitutos
para os PNGs finais. Recuperar os originais da #89 e versioná-los em:

- `apps/web/public/brand/memoria-de-caiz-icone.png`
- `apps/web/public/brand/memoria-de-caiz-texto.png`

O favicon configurado em `layout.tsx` usa o mesmo PNG do ícone. O serviço deve
construir a app a partir do monorepo e iniciar `pnpm --filter @hdata/web start`,
com `apps/web/public` incluído no artefacto. Se for usado standalone, copiar
explicitamente `public` e `.next/static` para as posições correspondentes na
imagem standalone; Next não os copia automaticamente. Este clone usa `next start`,
sem `output: standalone`: não ativar esse modo apenas para corrigir os PNGs.
Conferir a configuração real do serviço antes de mudar a infraestrutura.

**Lançamento não validado.** Ícone, favicon, desktop/telemóvel, contagens remotas,
fontes, revisão/publicação e integração da #91 permanecem por demonstrar. A versão
remota não identifica o commit. Não houve deploy nem escrita remota. A mensagem
pública não substitui uma contagem SQL/API do acervo.

### Executar o smoke no ambiente com acesso aos dois serviços

Depois do build das dependências, com Node 24, executar a partir da raiz:

```sh
pnpm --filter @hdata/web... build
pnpm --filter @hdata/web exec node src/smoke-cli.ts /dados/smoke-real.json > /dados/smoke-evidencia.json
```

O JSON de entrada deve conter `webUrl`, `apiUrl`, `commit` esperado, contagens
inteiras positivas `books`, `viewers`, `publishedRecords`, `publishedPages` e
`examples`: lista de `{recordId, query: {q, type, book, from, to}}`. Usar UUIDs e
nomes reais já revistos; `type` é `baptism`, `marriage` ou `death`; `book` é a
referência oficial. Cada exemplo deve aparecer na primeira página da pesquisa
por nome e na pesquisa com os filtros combinados. Incluir exemplos das três
tipologias. As contagens devem vir de inventário/reconciliação autorizados;
39/27 são referências históricas, não uma medição da implantação. Nunca usar
fixtures ou inventar assentos para conseguir um resultado verde.

O comando é só de leitura, limita cada pedido a 15 segundos e termina com erro
em caso de HTTP não 2xx, versão diferente, PNG ausente/HTML, favicon incorreto,
catálogo ausente, contagens divergentes, exemplo não encontrado, ficha ou fonte
inacessível. Reutiliza api-client e schemas domain. Não recebe tokens editoriais.
O relatório inclui data, URLs, commit, contagens observadas e verificações pendentes.
Guardar o resultado junto da evidência da release, sem dados pessoais desnecessários.

O smoke HTTP não substitui o ensaio de browser: abrir desktop e telemóvel e
confirmar imagens descodificadas, proporções e ausência de overflow. Abrir fichas
e visualizadores oficiais, confirmar conteúdo e páginas (HTTP 200 não demonstra
que um visualizador carregou). Num ambiente autorizado isolado ensaiar falha da
fonte e revisão → validação → publicação com identidades apropriadas. Registar
IDs/revisões antes/depois e confirmar pesquisa após publicação, conforme as secções
anteriores. Apenas depois anexar essa evidência, confirmar #91 e decidir lançamento.

### Validação local desta intervenção

`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm typecheck`, `pnpm test` e
`pnpm build`: exit 0. Web: 16 testes, incluindo 7 do smoke; API: 61 testes.
`pnpm check` conserva três avisos preexistentes. `pnpm --filter @hdata/web start`
iniciou o build; GET local `/health`: HTTP 200, `{"status":"ok"}`.
A CLI sem argumento foi executada e recusou a chamada com instrução de uso
(exit 1 esperado). Ambiente disponível: Node 22.23.3 / pnpm 12.14.0; Node 24
não ensaiado. Os testes do smoke usam respostas sintéticas e não constituem
acervo real ou validação de produção. Não há manifesto real aprovado nem URL
operacional da API para executar o percurso integral. A tentativa de recuperar
#89 via GitHub em `fabio7maia/hdata` devolveu 404; não se assumiu que esse
repositório vazio fosse a origem dos assets. Nenhuma escrita externa foi feita.

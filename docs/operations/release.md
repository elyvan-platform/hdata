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

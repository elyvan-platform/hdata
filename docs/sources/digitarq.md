# Fonte — Digitarq (PT/ADPRT/PRQ/PAMT38)

- **Estado:** adaptador implementado; **endpoint real e condições de uso por confirmar**.

## O que não foi verificado

O ambiente desta entrega não tem acesso verificado ao Digitarq nem a um ambiente alojado
autorizado. Por isso **não foram confirmados** o endpoint, a paginação, os identificadores técnicos,
as URLs de ficha e visualizador, nem as condições de reutilização dos metadados (distintas das das
imagens). Nenhum URL foi presumido: o endpoint vem de `DIGITARQ_CATALOG_URL`; sem ele, a
atualização falha com `not_configured`. O inventário secundário nominal de 39 livros / 27 visualizadores está na
[evidência pública](../readiness/catalogo-railway-evidencia.md), mas ainda exige reconciliação
com as fichas oficiais. Esses totais são a base de comparação (`knownCatalogBaseline`), não
um snapshot importável; a reconciliação por referência compara com os livros já guardados.

## Contrato esperado do adaptador

JSON validado por `catalogSnapshotSchema` (`packages/domain/src/catalog.ts`): `fondsReference`,
`expectedBookCount` e `books[]` com `referenceCode` (identidade oficial), `title`, `shelfmark`,
`folioCount`, `recordUrl` (ficha) e `viewerUrl` (visualizador). Se o Digitarq publicar outro formato,
adaptar `apps/api/src/catalog/digitarq-adapter.ts` (camada de tradução) sem mexer no resto.

## Criar o catálogo: passo a passo

«Sem catálogo válido» / «Último sucesso: nunca» significa que ainda não foi guardado um
snapshot válido nesta base de dados. O arranque da API não importa o catálogo automaticamente.
As variáveis abaixo foram confirmadas nos schemas e no código; os valores efetivamente
configurados no Railway não foram inspecionados.

### 1. Configurar os serviços

No Railway, definir em **Variables** do serviço correspondente e aplicar o redeploy:

| Serviço | Variável | Valor / requisito |
|---|---|---|
| API | `DATABASE_URL` | Ligação PostgreSQL da base que vai guardar o catálogo; usar a referência ao serviço PostgreSQL do mesmo ambiente. |
| API | `DIGITARQ_CATALOG_URL` | URL HTTP(S) alcançável pela API que devolva o JSON completo descrito abaixo. Sem valor, o refresh falha com `not_configured`. |
| API | `CATALOG_REFRESH_TOKEN` | Segredo aleatório com pelo menos 16 caracteres. Sem valor, o refresh está desativado (403). |
| API | `DIGITARQ_FONDS_REFERENCE` | `PT/ADPRT/PRQ/PAMT38` (já é o default). |
| API | `DIGITARQ_TIMEOUT_MS` | `10000` por pedido (default); permitido entre 100 e 120000 ms. |
| Web | `API_URL` | URL base da API alcançável pelo servidor Next.js, incluindo protocolo e porta quando necessária. Em produção não usar `http://localhost:3001`. |

`NODE_ENV=production`, `HOST=0.0.0.0` e a porta do serviço completam a configuração de
execução. `COMMIT_SHA` é opcional para identificar a revisão. `OPENROUTER_API_KEY` e
`EDITORIAL_ACTORS` não são necessários para criar o catálogo; servem para extração e revisão.
O token de refresh fica apenas na API e no ambiente seguro do operador, nunca na Web.
Pode gerar-se com `openssl rand -hex 32` e guardar-se no gestor de segredos.

Localmente, copiar os `.env.example` para `apps/api/.env` e `apps/web/.env`, preencher os
valores acima e remover as linhas opcionais vazias que não forem usadas: o schema rejeita
strings vazias. Não versionar esses ficheiros.

### 2. Obter e disponibilizar o JSON completo

**Não existe um endpoint real confirmado neste repositório.** Não usar a página HTML de
Digitarq, `fileViewer`, tombo.pt ou `/catalog` da própria API como `DIGITARQ_CATALOG_URL`.
O adaptador faz um GET com `Accept: application/json`; não faz scraping, não percorre páginas
e não envia credenciais para a fonte.

Obter uma exportação autorizada, conferir cada referência com a ficha oficial e converter
o inventário completo para este contrato. Pode ser servido como ficheiro JSON estático por
HTTP(S), alcançável pelo serviço API, desde que as condições de reutilização o permitam.
Se a fonte tiver paginação, reunir todas as páginas antes de servir o snapshot. Se precisar
de autenticação ou tiver outro formato, é necessário implementar essa integração no adaptador.

Exemplo **sintético, apenas do formato** (não carregar como catálogo real):

```json
{
  "fondsReference": "PT/ADPRT/PRQ/PAMT38",
  "title": "Paróquia de Vila Caiz",
  "expectedBookCount": 1,
  "books": [
    {
      "referenceCode": "PT/ADPRT/PRQ/PAMT38/EXEMPLO",
      "title": "Livro de exemplo"
    }
  ]
}
```

`expectedBookCount` tem de ser o total verificado da fonte e coincidir com `books.length`,
que não pode ser zero. As referências têm de ser únicas e começar pelo identificador do fundo.
Cada livro exige `referenceCode` e `title`; `shelfmark`, `folioCount` (inteiro não negativo),
`recordUrl` e `viewerUrl` (URLs válidas) são opcionais. Omitir os campos desconhecidos; não usar
`null` nem inventar cotas, referências ou contagens. Os 39 livros / 27 visualizadores são uma
referência histórica para revisão, não uma autorização para preencher dados em falta.

### 3. Aplicar as migrações na base correta

Na shell segura com acesso à base PostgreSQL e `DATABASE_URL` exportada no ambiente:

```bash
pnpm --filter @hdata/api db:migrate
```

O comando Drizzle lê `DATABASE_URL` do processo; não carrega automaticamente `apps/api/.env`.
Confirmar que a ligação aponta para a mesma base usada pelo serviço API. Depois de configurar
as variáveis, iniciar/reiniciar API e Web (em desenvolvimento, `pnpm dev`).

### 4. Executar a primeira importação

Na shell do operador, definir `API_BASE_URL` com a URL da **API** e disponibilizar o mesmo
`CATALOG_REFRESH_TOKEN` configurado no serviço, sem o escrever no histórico. Estes comandos
usam curl; `API_BASE_URL` é uma variável auxiliar da shell, não uma env var da aplicação.

```bash
curl --fail-with-body --silent --show-error "$API_BASE_URL/health"
curl --fail-with-body --silent --show-error "$API_BASE_URL/ready"
curl --fail-with-body --silent --show-error \
  --request POST \
  --header "Authorization: Bearer $CATALOG_REFRESH_TOKEN" \
  "$API_BASE_URL/catalog/refresh"
```

O POST não recebe ficheiro nem corpo: a API vai buscar o JSON a `DIGITARQ_CATALOG_URL`.
Usar uma ligação segura para enviar o token fora do ambiente local. A URL pública da Web
(`https://hdata.up.railway.app`) não deve ser presumida como URL da API.

### 5. Confirmar o resultado e repetir quando a fonte mudar

```bash
curl --fail-with-body --silent --show-error "$API_BASE_URL/catalog"
curl --fail-with-body --silent --show-error "$API_BASE_URL/search/coverage"
```

O refresh deve devolver HTTP 200, `bookCount` igual ao total esperado, `status.data="fresh"`,
`lastAttempt.outcome="success"` e `lastSuccessAt` preenchido. Uma repetição sem alterações
pode devolver `unchanged=true`. Rever o relatório `reconciliation`, incluindo `pendingReview`.
Abrir `/catalogo` na Web e confirmar os livros e a data do último sucesso. Se a API tem livros
mas a Web continua sem catálogo, conferir `API_URL`, ambiente/base de dados e rede entre serviços.

O catálogo contém livros e ligações; não cria nem publica assentos pesquisáveis. A pesquisa
pode continuar sem resultados até à importação/transcrição, revisão e publicação dos assentos.
A atualização é manual por POST; não há agendamento automático no arranque.

### Diagnóstico de falhas

| Resultado do refresh | Ação |
|---|---|
| 401 `unauthorized` | Enviar o token correto no header `Authorization: Bearer …`. |
| 403 `forbidden` | Configurar `CATALOG_REFRESH_TOKEN` na API e reiniciar. |
| 503 `not_configured` | Configurar `DIGITARQ_CATALOG_URL` na API e reiniciar. |
| 502 `invalid_format` | Conferir JSON, schema, fundo e referências; uma página HTML não serve. |
| 502 `incomplete` | Conferir total, resposta não vazia e todas as páginas da fonte. |
| 502 `refused` / `rate_limited` | A fonte respondeu 401/403 ou 429; verificar acesso autorizado e limites. |
| 502 `network` / `http_error`, 504 `timeout` | Verificar DNS/TLS/rede, estado da fonte e timeout a partir do serviço API. |
| 500 `storage_error` | Verificar logs da API, ligação PostgreSQL e migrações. |

Registar HTTP e os campos `error` e `message` da resposta, sem tokens. `status.lastAttempt`
usa o campo `errorCode`. Uma falha mantém a última cópia válida (`stored_copy`); se nunca
houve sucesso, continua `none`. `/health` com 200 só confirma o processo vivo, não a carga.

## Comportamento

- `POST /catalog/refresh` (Bearer `CATALOG_REFRESH_TOKEN`; sem token configurado devolve 403) e
  `GET /catalog`. Página web: `/catalogo`.
- Timeout por pedido (`DIGITARQ_TIMEOUT_MS`), uma repetição apenas para falhas transitórias
  (timeout, rede, 5xx). Erros: `timeout`, `network`, `refused` (401/403), `rate_limited`,
  `http_error`, `invalid_format`, `incomplete`, `not_configured`, `storage_error`
  (HTTP 504/502/503/500 na API).
- Resposta incompleta (total anunciado ≠ livros recebidos, duplicados, livros fora do fundo,
  fundo errado) nunca substitui o catálogo válido.
- Promoção transacional com *advisory lock* por fundo; uma resposta mais antiga não sobrepõe uma
  versão promovida entretanto. Reimportação idêntica não cria versão nem altera IDs.
- Livros e ligações desaparecidos **não são apagados**: ficam em `pendingReview` no relatório.
- Estado: última tentativa (sucesso/falha), data do último sucesso e origem dos dados
  (`fresh`, `stored_copy`, `none`). Sem catálogo válido nunca se devolve uma lista vazia "válida".

## Diagnóstico a executar no ambiente alojado (pendente)

Com `DIGITARQ_CATALOG_URL` configurado: `POST /catalog/refresh` e registar abaixo instante UTC,
revisão (`/version`), destino, código HTTP, duração e `errorCode`/`message` devolvidos. Se o
Digitarq recusar (`refused`, `rate_limited`, DNS/TLS → `network`), documentar a evidência e manter
a cópia guardada; não contornar restrições.

| Data (UTC) | Revisão | Resultado | Diagnóstico |
|---|---|---|---|
| — | — | por executar | — |

## Fontes complementares por série

Nenhuma confirmada; por isso nenhuma foi integrada. Para cada uma registar série, cobertura,
responsável, referência, condições de uso e estado.

| Série | Fonte | Cobertura | Responsável | Condições | Estado |
|---|---|---|---|---|---|
| Batismos / casamentos / óbitos / mistos | Índices secundários (ver spec) | desconhecida | desconhecido | desconhecidas | por confirmar |

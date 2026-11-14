# Fonte — Digitarq (PT/ADPRT/PRQ/PAMT38)

- **Estado:** adaptador implementado; **endpoint real e condições de uso por confirmar**.

## O que não foi verificado

O ambiente desta entrega não tem acesso verificado ao Digitarq nem a um ambiente alojado
autorizado. Por isso **não foram confirmados** o endpoint, a paginação, os identificadores técnicos,
as URLs de ficha e visualizador, nem as condições de reutilização dos metadados (distintas das das
imagens). Nenhum URL foi presumido: o endpoint vem de `DIGITARQ_CATALOG_URL`; sem ele, a
atualização falha com `not_configured`. O inventário nominal que sustenta os totais 39 livros /
27 visualizadores não existe no repositório; esses totais são só a base de comparação
(`knownCatalogBaseline`), e a reconciliação por referência compara com os livros já guardados.

## Contrato esperado do adaptador

JSON validado por `catalogSnapshotSchema` (`packages/domain/src/catalog.ts`): `fondsReference`,
`expectedBookCount` e `books[]` com `referenceCode` (identidade oficial), `title`, `shelfmark`,
`folioCount`, `recordUrl` (ficha) e `viewerUrl` (visualizador). Se o Digitarq publicar outro formato,
adaptar `apps/api/src/catalog/digitarq-adapter.ts` (camada de tradução) sem mexer no resto.

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

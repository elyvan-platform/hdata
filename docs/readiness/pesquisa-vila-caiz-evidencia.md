# Pesquisa Vila Caiz — evidência de execução, 2026-11-14

## Verificação externa

Pedidos GET com curl, redirects e timeout de 15–25 segundos. Todos terminaram
com exit 56, HTTP 000, `CONNECT tunnel failed, response 403` do proxy do ambiente.
Isto não demonstra recusa pela fonte, indisponibilidade da fonte ou falta de direitos.

| Inventário | URL consultado | Livro/página | Bloqueio |
|---|---|---|---|
| I01–I03 | https://tombo.pt/f/amt38 | não enumerados | proxy CONNECT 403 |
| I01–I03 | https://digitarq.adporto.arquivos.pt/ | não enumerados | proxy CONNECT 403 |
| I04 | https://www.familysearch.org/search/catalog/1983233 | não enumerados | proxy CONNECT 403 |
| I05 | https://tombo.pt/f/amt38 | localização civil não confirmada | proxy CONNECT 403 |
| I06 | nenhuma fonte identificada no inventário | desconhecidos | sem referência verificável |
| I07 | https://digitarq.arquivos.pt/details?id=4238939 | entrada de Amarante; Vila Caiz não confirmada | proxy CONNECT 403 |
| I08 | https://nosportugueses.pt/pt/paroquiais/200/amarante | não enumerados | proxy CONNECT 403 |

## Lote e limites

Executado o preview do manifesto existente com:

```sh
pnpm --filter @hdata/api extraction:batch ../../docs/sources/vila-caiz-lote.json /tmp/vila-caiz-preview-final.json
```

As oito entradas são fontes/séries com `document`, `page` e `imageId` nulos,
`available: false` e `authorized: false`. Nenhuma página elegível; nenhuma chamada
externa de extração, publicação ou alteração de produção. O relatório anterior
`vila-caiz-cobertura.json` é um relatório de bloqueios, não cobertura de páginas.
Não inventar linhas de livros/páginas nem deduzir direitos da consulta pública.
A enumeração real e o relatório por página continuam bloqueados pelas fontes.

## Aceitação

Teste sintético demonstra um nome só no texto publicado, excerto, localizador,
ligação de imagem e pesquisa de óbitos; rascunhos posteriores ficam privados.
Não é evidência de um nome histórico real nem de pesquisa em produção. Não foi
feito deploy (o pedido proíbe publicar), nem medida a base Railway. Aceitação de
produção permanece pendente. Não é necessária uma decisão de produto para os
bloqueios técnicos, portanto não foi criado NEEDS_INPUT.md.


## Ambiente e ferramentas

Elyvan `new plan 'Pesquisa efetiva Vila Caiz' --dry-run` indisponível (127):
plano e evidência escritos manualmente; lógica de domínio não tem bloco CLI.
Sem troca de modelo disponível; mantida separação análise/plano e implementação.
Runtime disponível Node 22.23.3, pnpm 12.14.0; Node 24 não foi certificado.


## Validação local final

- `pnpm install`: exit 0.
- `pnpm check`: exit 0 (avisos CSS preexistentes).
- `pnpm typecheck`: exit 0.
- `pnpm test`: exit 0; API 61 testes, incluindo 10 de pesquisa.
- `pnpm build`: exit 0, API e Next.js compilados.
- `pnpm --filter @hdata/api start` e GET `http://localhost:3001/health`:
  HTTP 200, `{"status":"ok"}`; processo parado após o ensaio.
- Preview do lote: exit 0; oito entradas blocked.

Testes de persistência usam PGlite, não PostgreSQL/Railway real. Não foram
validados extração paga, direitos, enumeração de páginas ou busca histórica em
produção. O texto continua pesquisado em memória sobre revisões publicadas;
para um acervo maior será necessário medir desempenho e escolher índice SQL.

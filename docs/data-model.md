# Modelo de arquivo

Fontes descrevem a origem e os direitos conhecidos. Fundos e séries formam uma hierarquia; livros pertencem a uma unidade e imagens a um livro. Identificadores externos são únicos por fonte e entidade; identificadores ausentes não são inventados. Uma imagem pode ser associada a várias revisões e vice-versa.

O assento tem identidade estável e cada revisão guarda conteúdo, data parcial, proveniência, menções e referências de imagem. Nomes e texto originais são preservados. Participantes são menções independentes, sem identidade de pessoa nem fusão automática. Uma data desconhecida não implica dia ou mês; o contrato verifica a precisão e o calendário.

A importação serializa alterações por assento com bloqueio de linha. Conteúdo repetido reutiliza a revisão com o mesmo hash; conteúdo diferente cria um rascunho. Regressar a conteúdo anterior reutiliza essa revisão. A base impede alteração ou remoção do conteúdo das revisões e das suas menções; o estado da revisão pode mudar. O fluxo editorial e a auditoria estão descritos em [revisão editorial](editorial-review.md). Direitos desconhecidos não autorizam publicação.

## Catálogo importado (Digitarq)

- `book.viewer_url`: ligação ao visualizador; `book.source_url` guarda a ficha. Identidade do livro:
  `(source_id, external_id)` com `external_id` = referência oficial.
- `catalog_version`: versão válida promovida (hash do conteúdo, contagens, relatório de
  reconciliação). Só é criada quando o conteúdo muda.
- `catalog_refresh`: cada tentativa (sucesso ou falha, código de erro, duração). Uma falha nunca
  altera livros nem versões. Ver `docs/sources/digitarq.md`.

## Índices e transcrições importados

`historical_entry` guarda snapshots imutáveis de entradas de fontes secundárias,
separados dos assentos. Fonte/ID externo/hash garantem reimportação idempotente;
variantes coexistem para revisão sem apagar TIF ou campos originais. Proveniência,
confiança e espécie (índice/transcrição) acompanham cada snapshot. Ver
[comando, mapeamentos e limitações](sources/historical-index.md).

## Propostas de extração

`extraction_run` (imagem, fonte, modelo, versão, prompt, tentativas, erro) e `extraction_proposal`
(assento proposto, região, confiança estimada, estado de revisão) ficam separadas dos assentos: só a
aceitação humana cria uma revisão `draft`. Ver [piloto de extração](extraction-pilot.md).

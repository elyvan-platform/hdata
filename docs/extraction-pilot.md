# Piloto de extração de transcrições

Propõe transcrições de assentos a partir de imagens de manuscritos. Código em
`apps/api/src/extraction/`, contratos em `packages/domain/src/extraction.ts`, tabelas
`extraction_run` e `extraction_proposal` (migração `0005`).

## Fluxo

1. `pnpm --filter @hdata/api extraction:enqueue <image-uuid>` cria (ou encontra) a execução e
   põe-na na fila pg-boss `extraction`. O worker arranca com a API quando `ANTHROPIC_API_KEY` existe.
2. O worker descarrega a imagem (`image_ref.url`), chama o modelo e valida a resposta com
   `modelOutputSchema`. Cada assento fica numa `extraction_proposal` com a região da imagem.
3. Um editor aceita ou rejeita (`reviewProposal`, papel com `edit`). Aceitar cria uma revisão
   `draft` pelo `importRecord`; segue-se o fluxo editorial normal ([revisão](editorial-review.md)).
   **Nada é publicado sem revisão humana**: propostas nunca são `archive_record`.

## Regras do contrato

- Texto em português original, sem modernizar. Trechos ilegíveis levam `[ilegível]`
  (`illegibleMarker`); `has_illegible` marca a proposta, incluindo participantes `uncertain`/`illegible`.
- Confiança por campo (0–1) e por assento = mínimo dos campos. É **estimativa do modelo, não
  probabilidade calibrada** (`confidence_kind = 'estimate'`) até existir calibração medida.
- Cada execução guarda fonte, imagem, SHA-256 da imagem, modelo, versão e versão do prompt.
- Idempotência: chave = imagem + modelo + versão + prompt. Repetir não cria execução nem chama o
  modelo de novo; uma versão nova de modelo ou prompt cria outra execução (as anteriores ficam).
- Tentativas limitadas (`EXTRACTION_MAX_ATTEMPTS`, 3). Erros transitórios (rede, 5xx, 429) relançam
  para o retry com backoff do pg-boss; permanentes (imagem inválida, saída malformada) terminam em
  `failed` com `error_code`/`error_message`. Falhas nunca viram lista vazia.

## Medição do piloto

`evaluate.ts` (`evaluatePilot`) compara propostas com assentos revistos à mão: recall e precisão de
assentos, taxa de erro de caracteres (CER, só assentos emparelhados), exatidão do tipo e relação
entre confiança média e fração com CER ≤ 10 %.

**Estado: não medido.** A imagem `PT-ADPRT-PRQ-PAMT38-001-0001_m0006.jpg` não existe no repositório
nem no ambiente desta implementação, e não havia chave de modelo nem conjunto revisto à mão; por isso
este documento não traz taxas de erro e nenhum número foi inventado. Procedimento para fechar:

1. Registar a imagem em `image_ref` (com URL pública e direitos conhecidos) e executar o enqueue.
2. Um revisor transcreve à mão os assentos da página (conjunto de referência, mínimo 30 assentos
   de pelo menos 3 imagens/mãos) fora do modelo.
3. Correr `evaluatePilot` e acrescentar aqui a tabela de resultados, a data, o modelo e a versão.

## Limitações

- O CLI Elyvan não está instalado: os blocos `jobs` e `storage` não foram gerados; pg-boss foi
  ligado à mão (`worker.ts`) e não foi exercitado contra PostgreSQL real (os testes usam PGlite e
  chamam `processExtraction` diretamente). Sem bloco de storage, só imagens com URL público são lidas
  (`storageKey` precisa de um `ImageLoader` próprio).
- O serviço verifica agora `source.rights_status` e `image_ref.rights_status`: ambos exigem
  `authorized` para processamento externo; o lote exige também evidência no manifesto.
  Ver [operação em lote](extraction-batch.md).
- Sem rotas HTTP nem página para rever propostas: a revisão usa `reviewProposal`.
- O prompt é único (`seats-v1`) e a região devolvida pelo modelo não é verificada.

## Critérios para alargar a cobertura

Alargar a outros livros/mãos apenas quando, num conjunto revisto de forma independente: CER
mediano ≤ 10 % nos assentos emparelhados, recall de assentos ≥ 90 %, nenhuma falha silenciosa nas
execuções, e a confiança separar bem acertos de erros (só então deixa de ser tratada como mera
estimativa e pode ser mostrada como percentagem). Antes disso, rotas de revisão e verificação de
direitos têm de existir.

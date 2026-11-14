# Índices históricos — importação e fontes por verificar

## Inventário (2026-11-14)

| Fonte | Material recuperado | Cobertura e direitos | Resultado |
|---|---|---|---|
| Protótipo | Nenhum JSON, Excel ou transcrição no repositório | Totais fornecidos: 484 batismos / 254 casamentos; autoria, formato e direitos por verificar | Reconciliação real pendente; não foram fabricados registos |
| Casa de fora | Sem ficheiro, URL ou referência verificável | Desconhecidos | Nenhum campo histórico mapeado; aguarda material e evidência de reutilização |
| Repositório Histórico | Sem ficheiro, URL ou referência verificável | Desconhecidos | Nenhum campo histórico mapeado; aguarda material e evidência de reutilização |
| Novas transcrições de óbitos | Nenhuma recuperada | Desconhecidos | Contrato preparado; confiança desconhecida por omissão |

A avaliação é local; não foi consultado um website presumido a partir do nome.
As referências da tarefa 04 disponíveis são as de [Digitarq](digitarq.md).
A branch develop e um remoto não existem nesta cópia; foi usada a base local integrada.

## Pré-visualização local

Depois de `pnpm install` e `pnpm --filter @hdata/domain build`:

```sh
pnpm --filter @hdata/api index:import /caminho/dados.json /caminho/mapping.json /tmp/preview.json
pnpm --filter @hdata/api index:import /caminho/dados.xlsx /caminho/mapping.json /tmp/preview-excel.json
```

Não escreve na base. O relatório é um ficheiro novo com permissões 0600; inclui
os dados originais, e deve ser guardado num local privado, fora do repositório.
O JSON deve ser um array de objetos. XLSX usa a primeira folha ou `sheet` explícita,
com cabeçalhos únicos na primeira linha. Não se adivinham formatos legados sem amostra.
`.xls` binário não é suportado; converter explicitamente para XLSX antes da revisão.

Exemplo de configuração **sintética** (o UUID deve identificar uma fonte real já registada):

```json
{
  "sourceId": "00000000-0000-4000-8000-000000000001",
  "citation": "Exportação sintética para ensaio",
  "reuseEvidence": "Dados de teste criados para este ensaio",
  "kind": "index",
  "recordType": "baptism",
  "columns": {
    "externalId": "id",
    "text": "texto",
    "bookReference": "livro",
    "locator": "folio",
    "tif": "tif",
    "confidence": "confianca"
  }
}
```

`columns.recordType` pode apontar para uma coluna com `baptism`, `marriage`, `death`
ou `undetermined`. Não existe tradução implícita de rótulos. IDs devem ser strings
estáveis da fonte, não números de linha. Campos opcionais vazios ficam ausentes;
confiança é `unknown`, `low`, `medium` ou `high`, por entrada. Para óbitos transcritos
usar `kind: transcription` e `recordType: death`, conservando uma fonte/citação própria.
Datas JSON podem usar o contrato partilhado `partialDateSchema` via `columns.date`.
Datas Excel e fórmulas não são convertidas em factos: valores incompatíveis são rejeitados.
Todo o objeto original é preservado, incluindo colunas sem mapeamento e referências TIF.

## Staging e resolução editorial

Aplicar as migrações com `pnpm --filter @hdata/api db:migrate`. A fonte deve existir
em `source`; a importação não cria fontes, livros ou imagens por inferência.
Adicionar `--database` ao comando para comparar com o staging sem alterar dados;
`--apply` guarda as linhas válidas, inclusive variantes conflituantes, em
`historical_entry`. Usa `DATABASE_URL` do ambiente do processo; o comando local
não expõe rotas públicas. A citação e a evidência de reutilização são obrigatórias,
mas o programa não consegue verificar a veracidade da declaração do operador.

Uma transação e um bloqueio serializam os lotes. Fonte + ID externo + hash do
conteúdo impedem duplicação, preservando todas as variantes. Trigger SQL impede
alterar/apagar snapshots. Um erro técnico faz rollback; linhas inválidas são rejeitadas
individualmente e descritas no relatório. Um relatório vazio pode ficar criado se
ocorrer erro após a abertura; nesse caso o comando falha explicitamente.

O relatório inclui adições, repetições, duplicados no lote, rejeições com linha e
motivo, entradas ausentes, conflitos com ambas as fontes e versões, totais e diferença
para 484/254. Os totais são identidades únicas da fonte em staging + lote, não prova
de exatidão histórica. Coincidência de livro/fólio/tipo é candidata a revisão,
nunca fusão automática (um fólio pode conter vários assentos). Nomes não servem de ID.
Reimportar variantes mantém os conflitos visíveis. Ausências nunca apagam dados.

Para rever, executar `--database` com o lote ou consultar `historical_entry.payload`
por `source_id`/`external_id`: cada variante mantém fonte, citação, confiança, texto,
TIF e os campos originais. Nenhuma versão mais completa é substituída. O staging é
entrada de índice/transcrição, distinta de `archive_record` e das suas revisões;
não produz validação, publicação ou associação automática a imagem. A aplicação da
decisão editorial aos assentos e a interface de resolução são trabalho posterior.

## Verificação real ainda pendente

Recuperar exportações e transcrições autorizadas, documentar cabeçalhos e amostras,
registar fontes e condições e preparar um mapping por formato observado. Executar
pré-visualização, rever todas as diferenças/rejeições/conflitos/duplicados, comparar
amostras e TIF com o original e só então aplicar. O teste 484/254 usa exclusivamente
fixtures sintéticas; não demonstra a reconciliação dos dados históricos ausentes.

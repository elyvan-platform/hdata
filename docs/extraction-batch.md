# Transcrição e indexação em lote

O lote usa `extraction_run` e `extraction_proposal`, o fornecedor HTR existente e
`reviewProposal`. O manifesto é validado pelo contrato partilhado
`extractionBatchSchema`. Não cria assentos validados nem publica conteúdo.

## Operação

1. Aplicar as migrações com `pnpm --filter @hdata/api db:migrate`.
2. Preparar um manifesto como `docs/sources/vila-caiz-lote.json`, enumerando cada
   página conhecida. `metadata` conserva os campos originais do inventário, incluindo
   referência, intervalo, URL, tipologia, evidência e condições de acesso. O documento deve corresponder à referência do livro (ou título
   quando não existe referência) e a página à sequência, fólio ou ID externo da imagem.
   `document` e `page` nulos significam cobertura desconhecida,
   não uma página fictícia. Incluir todas as entradas, mesmo indisponíveis.
3. Rever a cobertura sem base de dados nem chamadas externas:
   `pnpm --filter @hdata/api extraction:batch ../../docs/sources/vila-caiz-lote.json /tmp/cobertura.json`.
4. Para páginas disponíveis e autorizadas, registar imagens no catálogo. Tanto
   `source.rights_status` como `image_ref.rights_status` devem ser `authorized`,
   significando autorização verificada para processamento externo. O manifesto
   exige também `authorized: true` e `rightsEvidence` com a evidência aplicável.
   Consulta pública não basta. Identificadores e direitos são revistos pelo operador.
5. Definir DATABASE_URL e ANTHROPIC_API_KEY no ambiente validado da API, configurar
   o modelo disponível e executar o mesmo comando com `--apply` e um novo caminho
   de relatório. O ficheiro de saída é privado (0600) e nunca sobrescrito.

A aplicação exige uma ligação PostgreSQL de controlo para um advisory lock global;
uma segunda invocação termina explicitamente se houver outro lote ativo. Não
executar enqueue individual para as mesmas imagens enquanto um lote as gere.
O worker normal não recebe jobs deste executor. O executor biblioteca pressupõe
que o chamador mantém esse lock. O limite de concorrência (1–8) aplica-se às
páginas do lote; cada página faz no máximo uma tentativa por invocação. Óbitos têm
prioridade estável. Escolher uma amostra representativa de livros, mãos e datas no
manifesto do piloto antes de alargar; a ausência de dados não permite afirmar
representatividade nem qualidade medidas.

## Retoma, orçamento e reutilização

A identidade do lote vincula o manifesto completo e modelo/versão/prompt. Alterar
qualquer um exige outra identidade; um erro não reinicia silenciosamente o orçamento.
A tabela `extraction_batch_budget` reserva uma chamada **antes** de cada tentativa,
atomicamente, sem reembolso em caso de falha/interrupção. O limite efetivo é o menor
entre `maxTotalAttempts` e `floor(maxCostMicrousd / attemptCostCeilingMicrousd)`.
O teto por tentativa deve ser uma estimativa superior conservadora, confirmada pelo
operador com os preços e limites do modelo escolhido (incluindo imagem e até 8192
tokens de saída). Isto limita reservas, não mede a faturação real do fornecedor;
nenhum preço foi inventado nesta entrega. A reserva inclui tentativas falhadas.
Ao esgotar, as páginas ficam no relatório com `attempt_budget_exhausted`.

Repetir o manifesto retoma execuções em fila e não chama novamente o modelo para
execuções concluídas. Erros transitórios ficam explicitamente em fila até nova
invocação, evitando ciclos apertados de retries; erros permanentes ficam falhados.
As tentativas da execução original são preservadas, incluindo o seu limite inicial.
Uma interrupção durante processamento conserva a tentativa e a reserva. Após 1500
segundos, a concessão expira e outra tentativa pode reclamar a execução; a última
interrupção esgota-a. O número da tentativa protege as propostas contra respostas
de workers antigos. O tempo de concessão excede os dois timeouts máximos atuais.
A migração torna reclamáveis execuções antigas que ficaram em `running`.

Transcrições ligadas à imagem são reutilizadas sem alterar revisões. Exportações
históricas já importadas são comparadas por referência exata de livro e página:
uma transcrição com texto evita nova leitura; um índice é conservado como índice
e não é tratado como transcrição. Correspondências aproximadas não são inferidas.
O fornecedor existente reconhece manuscritos; fontes impressas devem usar um
`ModelProvider` OCR apropriado, com versão própria, em vez de afirmar que foram
processadas por um motor inexistente.

## Entrega e revisão

O JSON contém `pages` (fonte, tipo, documento, página, estado, tentativas e motivo),
`index` (propostas com texto original por campo, imagem, SHA, fonte, modelo, versões,
confiança estimada e estado editorial), `reusedHistory`, `reusedRevisions` e
`reviewQueue` (apenas propostas pendentes). O texto original é preservado na base
em JSONB e no export pesquisável, por exemplo com `rg`, sem normalização destrutiva.
Uma leitura automática continua distinta de um assento validado. A fila é privada:
`reviewProposal` permite aceitar para rascunho ou rejeitar; segue-se o fluxo de
submissão, revisão por outra pessoa e publicação descrito em `editorial-review.md`.
Correções humanas e versões anteriores não são atualizadas pelo lote.

## Cobertura real em 2026-11-14

`docs/sources/vila-caiz-cobertura.json` é o preview executado sobre as oito entradas
do CSV do MVP. Todas permanecem bloqueadas: páginas/documentos não enumerados,
conteúdo não acedido e reutilização não confirmada. São **zero páginas confirmadas
processáveis**, não cobertura de 0% de um denominador conhecido. Índice e fila de
revisão reais vazios; nenhuma transcrição real produzida ou enviada a terceiros.
A execução funcional do piloto de óbitos é demonstrada com fixtures sintéticas
nos testes, sem apresentar resultados sintéticos como acervo histórico.

Falta obter o inventário nominal, imagens/exportações e evidência de direitos para
executar o lote real e medir qualidade; não é uma escolha de produto sem predefinição.
`develop` e remotos ausentes neste clone; implementação parte de main local.

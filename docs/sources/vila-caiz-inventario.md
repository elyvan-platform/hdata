# Inventário de fontes — Vila Caiz (Amarante)

- **Data da consulta:** 2026-11-14 (UTC)
- **Âmbito:** documentos históricos com ligação comprovada à freguesia civil de Vila Caiz, concelho de Amarante (distrito do Porto), incluindo referências em fundos de outras localidades.
- **Base:** fundo `PT/ADPRT/PRQ/PAMT38` (Paróquia de Vila Caiz, Arquivo Distrital do Porto).
- **Estado:** inventário **parcial e não verificado nas fontes primárias**. Todas as evidências abaixo vêm de resultados de pesquisa web (trechos de páginas), não de páginas abertas nem de ficheiros recuperados. Ver [Fontes bloqueadas](#fontes-bloqueadas-e-lacunas).
- **Ficheiro estruturado:** [`vila-caiz-inventario.csv`](vila-caiz-inventario.csv) (mesmas linhas, para reprodução e revisão).

## Como reproduzir

1. Abrir cada ligação da tabela de fontes e registar data, URL final, código HTTP e trecho observado.
2. Pesquisar no Digitarq (`digitarq.arquivos.pt`) pelo código `PT/ADPRT/PRQ/PAMT38` e pelos termos da secção seguinte; registar a lista de unidades de instalação (livros) com cota e datas extremas.
3. Reconciliar com o total de referência (39 livros, ver [Reconciliação](#reconciliação-de-livros)).
4. Atualizar o CSV; não remover linhas — marcar `estado` e `evidencia`.

Não existe script de recolha: a fonte primária não pôde ser acedida a partir deste ambiente (ver bloqueios). Um script só seria reprodutível depois de existir acesso autorizado ao catálogo.

## Termos pesquisados

| Termo | Variante | Resultado |
|---|---|---|
| `PT/ADPRT/PRQ/PAMT38` | código de fundo | Confirmado em resultados do ADPRT e do tombo.pt |
| `Vila Caiz`, `Vila Caíz` | ortografia moderna, com e sem acento | Resultados da freguesia, do concelho e da paróquia |
| `Villa Cahiz` | grafia antiga pesquisada | Sem resultados relevantes |
| `Vila Caiz Amarante` + `batismos`, `casamentos`, `óbitos`, `registo civil`, `tombo`, `inventário` | combinações | Ver fontes |
| `Vila Caiz` + `homónimo` | distinção | Nenhum homónimo encontrado; ver [Homónimos](#homónimos) |

Termos ainda não pesquisados: `Villa Caiz`, `Vila Caes`, `São Miguel de Vila Caiz` (orago citado num registo FamilySearch), pesquisa por nomes de lugares da freguesia e por lista de livros no Digitarq.

## Fontes consultadas

| # | Fonte | Tipo | Estado de acesso | O que foi observado |
|---|---|---|---|---|
| F1 | [Paróquia de Vila Caiz — ADPRT (pesquisa)](https://pesquisa.adporto.arquivos.pt/details?id=537856) | Arquivística (ADPRT) | Trecho de pesquisa; página não aberta | Fundo 1601-05-28 a 1896; séries de batismos, casamentos e óbitos; 27 volumes |
| F2 | [Vila Caiz — tombo.pt (`amt38`)](https://tombo.pt/f/amt38) | Índice publicado | Trecho de pesquisa; página não aberta | Livros paroquiais do ADPRT; registo civil após 1911 a nível concelhio |
| F3 | [Dificuldades a pesquisar paroquiais — ADPRT](https://www.adporto.dglab.gov.pt/index.php/sliders/noticias-destaques/299-digitarq-2) | Orientação do arquivo | Trecho | Pesquisa de paroquiais no Digitarq; não consultada em detalhe |
| F4 | [Acesso aos documentos — ADPRT](https://www.adporto.dglab.gov.pt/index.php/22-acesso-documentos) | Condições de acesso | Trecho | Não lido em detalhe; **condições de reutilização por confirmar** |
| F5 | [FamilySearch — Vila Caiz, Paróquia São Miguel, registros paroquiais 1691–1855](https://www.familysearch.org/search/catalog/1983233) | Catálogo de microfilme/digitalização | Trecho | Intervalo 1691–1855, mais curto que o do ADPRT; pode ser subconjunto |
| F6 | [Nos Portugueses — Amarante, paroquiais](https://nosportugueses.pt/pt/paroquiais/200/amarante) | Índice de terceiros | Trecho | 27 livros, 1 indexado, 488 entradas, 1601–1896 |
| F7 | [Amarante — todos os livros paroquiais on-line (GeneAll)](https://geneall.net/pt/forum/163037/amarante-todos-os-livros-paroquiais-on-line/) | Fórum | Trecho | Indicação de digitalização; não verificada |
| F8 | [Livros paroquiais do concelho de Amarante — Repositório Histórico](https://www.repositoriohistorico.pt/freguesias/107) | Índice publicado | **Não acedido** (sem trecho) | Por verificar |
| F9 | [Vila Caiz — Wikipedia (pt)](https://pt.wikipedia.org/wiki/Vila_Caiz) e [Wikidata Q1023350](https://www.wikidata.org/wiki/Q1023350) | Secundária | Trecho | Identificador INE 130138; população e área referidas com divergências entre fontes |
| F10 | [Torre do Tombo — Memórias Paroquiais (Amarante, 1758)](https://digitarq.arquivos.pt/details?id=4238939) | Arquivística nacional (ANTT) | Trecho | Entrada de Amarante, não de Vila Caiz; **não confirmada** para a freguesia |
| F11 | [Registo civil — Digitarq (documentMigrated)](https://digitarq.arquivos.pt/en/documentMigrated/d2364944b31c46759de73b0a52d7a446) | Arquivística | Trecho sem ligação confirmada a Vila Caiz | Não atribuível a Vila Caiz com os dados disponíveis |

## Inventário por tipologia

Colunas: série/tipologia, intervalo, volumes conforme cada fonte, observações. Os números **não são reconciliados**: fontes diferem (ver abaixo).

| Tipologia | Intervalo (fonte) | Volumes | Fonte | Acesso | Notas |
|---|---|---|---|---|---|
| Registos de batismos (série 001) | 1663-06-09 – 1893 (F1); 1663–1726 e 1889–1893 nos extremos (F2) | 8 (F2, contagem de linhas) | F1, F2 | Digitarq: por confirmar; imagens: por confirmar | Primeiro livro 1663–1726 |
| Registos de casamentos (série 002) | 1602-11-15 – 1896 (F1); 1602–1684 e 1896 nos extremos (F2) | 9 (F2, contagem de linhas) | F1, F2 | por confirmar | Primeiro livro 1602–1684 |
| Registos de óbitos (série 003) | 1601-05-28 – 1896 (F1); 1601–1692 a 1883 (F2) | 5 (F2, contagem de linhas); F1 não separa | F1, F2 | por confirmar | Contagem de F2 é de linhas da página, não confirmada |
| Registos de batismo, casamento e óbito, paroquiais (conjunto) | 1691–1855 (F5, São Miguel) | não contado | F5 | microfilme/digitalização: por confirmar | Intervalo menor; ver homónimos e orago |
| Registo civil (conservatória concelhia) | a partir de 1911-04-01 (F2) | não contado | F2 | **Restrito por lei** (prazos do registo civil a confirmar no texto legal) | Livros de Amarante, não de Vila Caiz; localização a confirmar |
| Tombos, inventários, memórias paroquiais | — | — | F10 | — | Nenhum tombo ou inventário de Vila Caiz confirmado; F2 cita inventários de ADPRT só em geral |

## Reconciliação de livros

| Fonte | Total |
|---|---|
| Base de comparação da tarefa | 39 livros |
| F1 (ADPRT, fundo) | 27 volumes |
| F6 (Nos Portugueses) | 27 livros |
| F2 (tombo.pt, contagem de linhas) | 8 + 9 + 5 = 22 |

**Divergência não resolvida.** 39 ≠ 27 ≠ 22. Nenhum inventário nominal de 39 livros foi encontrado nas fontes acedidas; o total de 39 não pode ser confirmado. Causas prováveis a verificar: volumes contados por unidade de instalação vs. por registo; livros de séries não listados em F2; contagens de F2 feitas a partir de linhas de tabela. **Não se criou nenhum livro para fechar a diferença.** Próximo passo: listar todas as unidades de instalação do fundo no Digitarq com cota e datas e comparar.

## Homónimos

- **Vila Caiz (Amarante, INE 130138):** freguesia alvo deste inventário. Sede a cerca de 12 km de Amarante, limite com Marco de Canaveses (F9).
- **Vila Cã (Pombal, `pbl14`):** freguesia diferente, arquivo ADLRA; **não** é Vila Caiz (F2 em resultados de pesquisa).
- **Cavez (`cbc07`):** resultado de pesquisa sem relação comprovada.
- **Villa Cahiz / grafia antiga:** nenhuma ocorrência ligada a Amarante encontrada.
- **Amarante (Piauí, Brasil):** homónimo do concelho; excluído.

## Fontes bloqueadas e lacunas

| Fonte | Motivo | Ação seguinte |
|---|---|---|
| `digitarq.arquivos.pt` (catálogo nacional) | Acesso direto bloqueado a partir do ambiente (CONNECT 403); só trechos de pesquisa | Consultar a partir de ambiente autorizado; registar URL, data e cotas |
| `pesquisa.adporto.arquivos.pt` e `adporto.dglab.gov.pt` | Idem | Idem; confirmar condições de reutilização (F4) |
| `tombo.pt/f/amt38` | Idem; contagens feitas a partir de trechos, com inconsistências (ex.: óbitos 5 vs. 10 em duas pesquisas) | Abrir a página e contar as linhas |
| `repositoriohistorico.pt` | Não aberto | Verificar se lista os livros de Vila Caiz |
| Câmara Municipal de Amarante, SIPA/DGPC | Não consultados | Verificar inventários de património e arquivo municipal |
| Índices secundários (batismos, casamentos, óbitos) | Não localizados | Identificar autor, cobertura e condições |
| Imagens dos livros | Não localizadas; direitos desconhecidos | Confirmar condições por imagem |
| Registo civil de Amarante (após 1911) | Localização e prazos não confirmados | Consultar a conservatória ou o arquivo competente |
| Outros fundos (ANTT, distritais, eclesiásticos) | Nenhuma referência a Vila Caiz confirmada | Pesquisar por nome de lugar e de pessoas da freguesia |

**Lacuna de conteúdo:** nenhum assento foi lido. Este inventário descreve **metadados de fontes**, não factos sobre pessoas.

## Motivo para documentos sem acesso ao conteúdo

Todos os livros listados estão sem acesso ao conteúdo: as páginas de catálogo e índices não foram abertas, e as imagens não foram localizadas. O motivo é a falta de acesso verificado a partir deste ambiente, não uma restrição confirmada da fonte.

## Riscos

- Os intervalos e volumes vêm de trechos de pesquisa e de agregadores; podem estar errados.
- Os totais 39/27/22 divergem; enquanto não houver lista nominal, o total não está validado.
- O intervalo do registo paroquial (1691–1855) pode indicar uma coleção distinta; não se fundiu com o fundo do ADPRT.

## Readiness do lançamento (2026-11-14)

| Fonte | Cobertura demonstrada nesta entrega | Limitação |
|---|---|---|
| Catálogo ADPRT/Digitarq | Nenhum percurso real até à fonte validado | 39/27/22 por reconciliar; endpoint e direitos por confirmar |
| Protótipo / índices secundários | Nenhum ficheiro recuperado | 484/254 não importados nem validados |
| Transcrições de óbitos / piloto | Nenhuma medição real | Páginas e direitos não disponíveis; piloto excluído |

Não foram consultadas contagens de uma implantação. Ausência de evidência local
não prova zero assentos num serviço remoto. Ver [readiness](../readiness/2026-11-14-lancamento-arquivo.md).

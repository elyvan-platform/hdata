# Modelo de arquivo

Fontes descrevem a origem e os direitos conhecidos. Fundos e séries formam uma hierarquia; livros pertencem a uma unidade e imagens a um livro. Identificadores externos são únicos por fonte e entidade; identificadores ausentes não são inventados. Uma imagem pode ser associada a várias revisões e vice-versa.

O assento tem identidade estável e cada revisão guarda conteúdo, data parcial, proveniência, menções e referências de imagem. Nomes e texto originais são preservados. Participantes são menções independentes, sem identidade de pessoa nem fusão automática. Uma data desconhecida não implica dia ou mês; o contrato verifica a precisão e o calendário.

A importação serializa alterações por assento com bloqueio de linha. Conteúdo repetido reutiliza a revisão com o mesmo hash; conteúdo diferente cria um rascunho. Regressar a conteúdo anterior reutiliza essa revisão. A base impede alteração ou remoção do conteúdo das revisões e das suas menções; o estado da revisão pode mudar. O fluxo de decisão editorial e a auditoria serão implementados posteriormente. Direitos desconhecidos não autorizam publicação.

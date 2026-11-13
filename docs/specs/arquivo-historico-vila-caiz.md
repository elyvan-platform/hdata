# Spec — Arquivo histórico Vila Caiz

- **Date:** 2026-11-13
- **Status:** Draft
- **Plan:** [Plano de implementação](../plans/arquivo-historico-vila-caiz.md)

## Objective

Especificar o catálogo e a consulta do arquivo Memória de Vila Caiz, tomando
PT/ADPRT/PRQ/PAMT38 como identificador de fundo fornecido pela tarefa, ainda não
confirmado na fonte. Permitir assentos estruturados, proveniência rastreável e
transcrições com validação humana, sem confundir fontes primárias e derivadas.

## Users and context

Visitantes consultam apenas conteúdo explicitamente publicado. Investigadores
autenticados consultam conteúdo privado autorizado. Editores introduzem dados;
revisores validam-nos; administradores gerem permissões e publicação.
Não existem apps no estado atual: apenas `packages/config`, bloco `ci` e templates
de documentação. Não foram encontrados protótipo, exportações, imagens ou índices
na pesquisa local de 2026-11-13. Não houve consulta externa nem validação de licenças.

## Scope

### Inventário e lacunas por fonte

| Material | Localização e disponibilidade | Formato / volume | Reutilização | Lacunas e ação seguinte |
|---|---|---|---|---|
| Protótipo Memória de Vila Caiz | Não disponível no repositório; URL não fornecida | Desconhecidos | Desconhecida | Obter acesso/exportação autorizada, inventariar páginas, campos, relações, autoria e licença; mapear sem presumir equivalência com a fonte primária |
| Metadados do fundo PT/ADPRT/PRQ/PAMT38 | Identificador fornecido; catálogo externo não consultado | Descrição, hierarquia, datas e número de livros por confirmar | Desconhecida | Confirmar identificador, instituição, referência, cotas e URL canónica; registar data da consulta |
| Imagens do mesmo fundo | Não disponíveis no repositório | Formatos, resolução, sequência e volume desconhecidos | Reprodução, armazenamento e publicação por confirmar separadamente | Obter condições e referências por imagem; não presumir que consulta online autoriza cópia |
| Índices secundários | Não disponíveis; autores/localização desconhecidos | Estrutura e cobertura desconhecidas | Licença/autoria por confirmar | Inventariar cada índice individualmente, cobertura, erros conhecidos e correspondência livro/fólio |
| Amostra manuscrita m0006 | Apenas designação fornecida; ficheiro ausente | Formato, páginas, legibilidade e livro desconhecidos | Desconhecida | Obter amostra autorizada e identificar origem, fólio, data e relação com o fundo; não deduzir conteúdo do nome |

O inventário guarda responsável, data de verificação, evidência das condições de
uso e restrições por material. Ausência ou direitos desconhecidos permitem
inventariar e desenvolver com dados sintéticos, mas nunca autorizam importar,
armazenar ou publicar material externo. Aquisição externa não é pré-requisito
para schemas, autenticação, pesquisa ou fluxo editorial.

### Modelo de informação

- **Metadados de livros:** fundo → série → livro/unidade de instalação; identificador
  interno estável, código de referência, título, datas extremas, cota, folhas e URL
  de origem. Séries como batismos, casamentos, óbitos ou mistos são hipóteses de
  classificação a confirmar, não um inventário já observado.
- **Imagens:** entidade distinta ligada ao livro, sequência, fólio/frente/verso,
  origem, resolução, direitos e eventual objeto de armazenamento. Um assento pode
  apontar a várias imagens/regiões; uma imagem pode conter vários assentos.
- **Índices secundários:** entradas com texto original, autor/fonte, referência a
  livro/fólio e ligação opcional ao assento. Uma ligação não transforma o índice
  em transcrição nem comprova a leitura manuscrita.
- **Transcrições:** texto diplomático e/ou normalizado, convenção de leitura,
  segmentos ilegíveis/incertos, versão, autor, estado e referências às imagens.
  A forma normalizada nunca substitui a diplomática.

Assentos têm tipo (batismo, casamento, óbito ou não determinado), data do ato com
precisão/incerteza, livro, fólio, lugar, notas marginais e participantes com papel
(batizado, pais, padrinhos, nubentes, testemunhas, defunto, pároco). Preservar nomes
como escritos e formas normalizadas separadas. Não inferir identidades familiares
por coincidência de nome. Campos históricos desconhecidos são explícitos; não
inventar datas exatas ou referências para satisfazer validações.

## Out of scope

HTR/OCR automático, árvores genealógicas, outros fundos, edição pública aberta,
recolha automática externa e implementação de apps nesta tarefa. A amostra m0006
serve futuramente para avaliação humana; não constitui um conjunto de treino.

## Product rules

### Consulta e acesso

A decisão de publicação está pendente. A predefinição de implementação é consulta
privada com autenticação e autorização; nenhum material fica público por existir
no catálogo. Quando aprovada a consulta pública, o visitante navega fundo/livro,
pesquisa e abre um assento apenas se a política de publicação permitir. Metadados
podem ser publicados independentemente das imagens; cada camada tem política
própria. Assentos e transcrições públicos exigem validação e autorização de
reutilização; imagens exigem também autorização específica. Autenticação não
substitui direitos de uso. A política temporal para dados pessoais fica por definir;
conteúdo sem avaliação mantém-se restrito.

O investigador autorizado percorre o mesmo catálogo privado e vê apenas o seu
âmbito. Pesquisa, contagens, excertos, exportações e URLs de imagens respeitam as
mesmas permissões; não revelar a existência de itens restritos por esses canais.

### Edição, proveniência e validação humana

O editor autenticado cria ou importa um rascunho, associa evidências e submete-o.
Estados: `rascunho → em revisão → validado | rejeitado`. Rejeição exige motivo;
correção cria nova versão em rascunho, preservando a anterior. Edição de versão
validada exige nova revisão, sem alterar silenciosamente o conteúdo publicado.
O revisor é pessoa diferente do autor da versão, inclusive quando administrador;
registar decisão, comentário, identidade, data e versão revista. Administração
não permite contornar esta separação.

Cada facto e correção conserva fonte (imagem, índice, protótipo, transcrição),
localizador, autor, instante, método (manual/importação; OCR/HTR apenas futuro),
incerteza e ligação à versão anterior. Guardar lote de importação e identificador
externo para repetição idempotente. Divergências entre fontes coexistem com notas,
sem sobrescrita silenciosa. Auditoria append-only para alterações, decisões e
permissões; correções são novos eventos, acesso ao histórico é autorizado.

### Pesquisa

Pesquisar por nome e variantes documentadas, com comparação insensível a acentos,
tipo, intervalo de datas, lugar, papel, livro e fólio; combinar filtros e paginar
com ordenação estável. Preservar a grafia original na apresentação. Resultados
identificam origem (índice ou transcrição), referência e estado de validação.
Não apresentar correspondência aproximada como identidade comprovada. Mostrar
estado vazio apenas para pesquisa bem-sucedida sem resultados; erros são explícitos.

## Technical rules

Reutilizar configuração existente; introduzir os futuros apps/pacotes com Elyvan.
Um schema Zod por payload no futuro `@hdata/domain`, partilhado entre formulários
e API; entidades distintas para Livro, Imagem, EntradaIndice, Assento,
Participante, Transcricao, Proveniencia e validação. Next.js, Fastify,
PostgreSQL/Drizzle, Better Auth e R2 seguem AGENTS.md. Dependências só no catálogo
pnpm. Escolha de pesquisa e extensões PostgreSQL exige validação documental e ADR
na fase correspondente; FTS/unaccent são candidatos, não decisões confirmadas.

Autorização na API, URLs assinadas de curta duração após autorização, segredos
apenas no servidor. Distinguir 401 (sem sessão), 403 (sem permissão) e 5xx (falha
técnica), sem converter falhas em listas vazias. Apps terão Zod para ambiente,
`.env.example`, scripts uniformes e `/health`, `/ready`, `/version` nos servidores.

## Acceptance criteria

- [ ] Catálogo com dados sintéticos permite percorrer fundo/série/livro e exibe referência, datas e origem, incluindo desconhecidos explícitos.
- [ ] Livro, imagem, índice e transcrição têm identificadores distintos; importar índice nunca cria transcrição validada.
- [ ] Editor cria assento com participantes/papéis e grafias original/normalizada; erro de payload é rejeitado pelo schema partilhado.
- [ ] Cada facto apresentado permite chegar à fonte e versão; correção conserva valor anterior, autor, método e instante.
- [ ] Reimportar o mesmo lote não duplica registos; conflito de fontes é visível para revisão.
- [ ] Pesquisa por nome com/sem acento e filtros combinados devolve a mesma referência esperada, paginada, com origem e estado explícitos.
- [ ] Autor não valida a própria versão; outro revisor valida ou rejeita com motivo; alteração posterior cria rascunho sem apagar a decisão anterior.
- [ ] Sem decisão de publicação, visitante não acede a dados privados nem por busca, contagens ou URL de imagem; investigador só vê âmbito autorizado.
- [ ] Quando publicação for aprovada, apenas camadas autorizadas são expostas; transcrições/assentos exigem versão validada e imagens exigem direitos confirmados.
- [ ] Rotas editoriais devolvem 401 sem sessão e 403 com papel insuficiente; indisponibilidade técnica é 5xx e não resultado vazio.
- [ ] Cada fonte do inventário tem estado, lacunas e condições de uso explícitas; fonte ausente não impede demonstração com fixtures sintéticas.

## Risks

Direitos e dados pessoais podem impedir publicação, mas não trabalho sintético.
Índices podem conter erros ou referências incompatíveis; validar amostras antes da
importação real. Manuscritos ilegíveis exigem incerteza e revisão, não preenchimento
inferido. Não existe atualmente comportamento executável que valide estes fluxos.

## Open questions

- Que público e camadas serão autorizados para consulta pública? Proposta: privado
  inicialmente, publicação seletiva após aprovação documentada.
- Quais são os direitos de cada material e a regra temporal de dados pessoais?
- Onde estão o protótipo, os índices e m0006, em que formatos e sob que condições?
- O identificador do fundo, séries, volumes e correspondências de fólio são exatos?
- Quem assume revisão e decisão de publicação? Registar a decisão no plano/ADR
  antes de ativar acesso público; nenhuma destas perguntas bloqueia esta especificação.

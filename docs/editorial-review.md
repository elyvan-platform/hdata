# Revisão editorial

Fila, ficha, edição e decisões sobre as revisões de assentos. API em `apps/api/src/routes/review.ts`,
regras em `apps/api/src/editorial/`, contratos em `packages/domain/src/editorial.ts`, páginas em
`apps/web/src/app/revisao`.

## Papéis e autorização

| Papel | Ações |
|---|---|
| `editor` | ver, editar, submeter |
| `reviewer` | ver, editar, submeter, validar, rejeitar |
| `publisher` | ver, publicar |
| `admin` | todas |

Sem credenciais → 401; papel sem permissão → 403. O autenticador é uma função
(`Authenticator`); a implementação atual usa tokens Bearer pessoais de `EDITORIAL_ACTORS` (JSON
`[{"token","id","role"}]`; sem a variável, `/review` fica desligado). O bloco Better Auth do CLI
Elyvan não estava disponível: uma sessão Better Auth entra substituindo apenas essa função.
A página web guarda o token num cookie httpOnly e nunca o expõe ao cliente.

## Fluxo

`draft → in_review → validated → published`; `draft|in_review → rejected` (nota obrigatória).
Editar cria sempre uma nova revisão `draft` (o conteúdo das revisões é imutável) a partir da
revisão em que o editor se baseou (`baseRevisionId`). Publicar exige direitos conhecidos na fonte
e nas imagens (422 `rights_unknown`).

## Concorrência e conflitos

Cada operação bloqueia a linha do assento (`FOR UPDATE`). Se existir uma revisão mais recente que a
base, a edição é fundida campo a campo (três vias): alterações em campos diferentes são
combinadas (evento `merged`); o mesmo campo alterado de forma diferente devolve 409 `conflict`
com `conflicts` (base/minha/outra) e a revisão atual, sem escrever nada. Resolução: voltar a
submeter com `baseRevisionId` = revisão atual e o texto escolhido. Decisões sobre uma revisão que
já não é a última devolvem 409 `stale_revision`; transições inválidas 409 `invalid_transition`.

## Auditoria

`revision_event` (append-only, protegida por trigger): revisão, ação, autor, papel, estado
anterior e novo, nota e data. A revisão guarda também `recorded_by`/`recorded_at`.

## Ficha

`GET /review/records/:id` separa `humanReading` (revisão manual), `automaticProposal` (revisão
importada) e `secondaryIndex` (entradas históricas com o mesmo ID externo e livro), e devolve a
referência ao documento (livro, ligação oficial, localizador e imagens).

## Limitações

- Testes de concorrência usam PGlite com uma ligação e um mutex que simula o bloqueio de linha;
  falta validar com ligações independentes em PostgreSQL.
- O formulário web edita folio, local, texto e notas marginais; participantes e imagens são
  editáveis pela API.
- Os documentos de plano foram criados à mão: o CLI Elyvan não está instalado.

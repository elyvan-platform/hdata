# Pesquisa efetiva de Vila Caiz

- **Status:** Paused
- **Resume prompt:** never
- **Next step:** Enumerar livros/páginas num ambiente com acesso às fontes e validar um nome real em produção.

## Plano

Uma fase de implementação após análise: estender contrato em domain, serviço de
pesquisa API e apresentação partilhada web; testar texto exclusivo do manuscrito,
óbitos e isolamento de rascunhos. Reutilizar revisões e ligações de imagens, sem
publicar propostas automaticamente. Validar check, typecheck, test, build e health.
Não há troca de modelo disponível; análise/plano precedem implementação.
Elyvan `new plan 'Pesquisa efetiva Vila Caiz' --dry-run`: comando ausente (127).

### Fase 1 — Done

- [x] Pesquisa e excerto de texto publicado ligados à UI e protegidos por testes.
- [x] Cobertura de páginas distinta de contagem de séries/assentos.
- [x] Validação completa e relatório dos bloqueios externos.

## Riscos

O manifesto tem oito entradas de fontes/séries, não páginas enumeradas.
Acesso a tombo.pt em 2026-11-14: proxy CONNECT 403, HTTP 000.
Sem prova de direitos não executar processamento externo. Não presumir acesso à
produção nem confundir testes sintéticos com aceitação real. Não fazer deploy.

## Log

- 2026-11-14 — Revistos inventário, manifesto, planos e serviço. Pesquisa excluía
  explicitamente original_text. Plano aberto de extração e plano geral relacionados
  abrangidos pelo pedido atual; restantes planos não retomados.

- 2026-11-14 — Implementados contrato, pesquisa original_text publicada, excerto
  limitado, UI partilhada e cobertura de imagens distintas por livro. Testes de
  nome só na transcrição, óbitos, pontuação e isolamento de rascunhos passaram.
  `pnpm install`, `pnpm check`, `pnpm typecheck`, `pnpm test` e `pnpm build`:
  exit 0 na validação final. API compilada iniciada com
  `pnpm --filter @hdata/api start`; GET /health: 200, {"status":"ok"}.
  Preview do lote: exit 0, oito fontes bloqueadas, nenhuma página elegível.
  Primeira tentativa de testes/preview antes do build falhou por dist ausente;
  resolvido compilando as dependências. Ajustadas expectativas de cobertura ao
  novo campo e validada pesquisa só com pontuação. Nenhum teste removido.
  Evidência externa em docs/readiness/pesquisa-vila-caiz-evidencia.md.
  Implementação local concluída; plano pausado pela aceitação histórica real
  pendente. Sem commit (opcional no pedido), push, publicação ou deploy.

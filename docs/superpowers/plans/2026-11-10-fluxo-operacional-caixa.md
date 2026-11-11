# Fluxo operacional do caixa — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma primeira interface do caixa com visão operacional de mesas, transferência/mesclagem, conferência e registro de pagamento externo seguido da liberação da mesa.

**Architecture:** Manter React/TypeScript/Vite e o armazenamento local atual. As regras de domínio cuidam da transferência e do fechamento; a interface existente recebe ações explícitas para transferir, conferir itens e registrar a forma de pagamento já recebida externamente.

**Tech Stack:** React 19, TypeScript, Vite, CSS existente, node:test.

**Spec:** `docs/superpowers/specs/2026-11-10-fluxo-operacional-caixa-design.md`

## Global Constraints

- Dados são fictícios e locais ao navegador.
- O sistema não processa nem simula transações; apenas registra Pix, dinheiro ou cartão (débito/crédito) já recebido fora dele.
- Só liberar mesa após confirmar o registro da forma de pagamento; guardar extrato imutável.
- Reutilizar catálogo, promoções, métodos e componentes existentes; preservar o preço de item em correção apenas de quantidade.
- Atualizar o repositório privado `mconecta230-del/sistema` após `npm test` e `npm run build`.

## Review Focus

- Origem livre, destino em fechamento ou mesma mesa: rejeitar a transferência sem alterar mesas (teste de domínio).
- Destino ocupado: somar itens sem perder identidade, preço ou histórico (teste de domínio).
- Corrigir quantidade versus trocar produto com promoção ativa: manter preço antigo no primeiro caso e aplicar preço atual no segundo (teste de domínio/formulário).
- Pagamento sem forma selecionada: impedir fechamento e manter mesa ocupada/em fechamento (teste de fluxo).
- Dados anteriores sem snapshot de itens: preservar leitura compatível dos extratos antigos (teste de regressão).

---

### Task 1: Regras de transferência e testes de domínio

**Files:**
- Modify: `src/domain.ts`
- Modify: `tests/domain.test.mjs`

**Interfaces:**
- Produces: `transferTable(tables: Table[], sourceId: number, destinationId: number, actor: string, at: string): Table[]`; transfere para mesa livre ou mescla em mesa ocupada e retorna nova lista, sem mutar a entrada.

- [x] Escrever testes para transferência a mesa livre, junção em mesa ocupada, bloqueios (mesma mesa, livre, fechamento) e preservação do preço/identidade dos itens.
- [x] Rodar `npm test` e confirmar que os novos casos falham antes da implementação.
- [x] Implementar `transferTable` com validação de status e eventos nos históricos de origem e destino.
- [x] Rodar `npm test` e confirmar os casos de transferência aprovados.

### Task 2: Fluxo da interface do salão e caixa

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `transferTable` e tipos de `src/domain.ts`.
- Produces: ação “Transferir mesa” na mesa selecionada; modal de destino elegível; fluxo de fechamento com resumo detalhado, forma externa Pix/dinheiro/débito/crédito e botão de registro/fechamento.

- [x] Adicionar teste de domínio para snapshot do extrato após pagamento externo e transição de mesa para livre, preservando compatibilidade do histórico antigo.
- [x] Executar `npm test` e confirmar a falha inicial do teste novo.
- [x] Implementar a seleção de destino e a transferência/junção com atualização da mesa selecionada e aviso visível.
- [x] Atualizar o modal de fechamento para mostrar linhas, total, método de registro, aviso de pagamento recebido fora do sistema e confirmação obrigatória da forma.
- [x] Ajustar a área do caixa para expor resumo operacional, mesas em andamento e últimos pagamentos sem mudar o foco para módulos de cliente.
- [x] Dar estilo responsivo para o monitor do caixa e manter adaptações móveis existentes.
- [x] Rodar `npm test` e `npm run build`.

### Task 3: Prévia e publicação

**Files:**
- Verify: `src/App.tsx`, `src/style.css`, `src/domain.ts`, `tests/domain.test.mjs`

- [x] Verificar se o servidor Vite local está ativo em `http://127.0.0.1:5173/`; reiniciar se necessário.
- [x] Abrir/atualizar a prévia no navegador interno e inspecionar a primeira tela do caixa e o fluxo de mesa selecionada.
- [x] Confirmar `npm test` e `npm run build` aprovados.
- [x] Registrar as alterações no `main` do repositório privado `mconecta230-del/sistema` e conferir o commit remoto.




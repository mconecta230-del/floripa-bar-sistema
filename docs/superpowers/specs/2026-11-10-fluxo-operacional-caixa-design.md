# Design: fluxo operacional do caixa

**Data:** 2026-11-10  
**Projeto:** Floripa Bar — protótipo local

## Objetivo

Concentrar no computador do caixa a leitura do salão e o ciclo de atendimento: acompanhar mesas e pedidos em aberto, conferir ou corrigir itens, transferir/mesclar consumo, registrar a forma de pagamento já recebida fora do sistema e liberar a mesa.

## Escopo desta etapa

- Organizar a visão do caixa para mostrar rapidamente mesas livres, ocupadas e em fechamento, com acesso ao consumo e total.
- Permitir transferir uma mesa ocupada para uma mesa livre ou juntar o consumo a outra mesa ocupada; bloquear origem/destino em fechamento e registrar a ação no histórico.
- Permitir revisar e corrigir produto/quantidade antes do fechamento. Ao trocar o produto, usar o preço vigente (incluindo promoção ativa); ao corrigir apenas a quantidade, preservar o preço unitário já lançado.
- No fechamento, mostrar os produtos consumidos e o total da conta. O operador recebe o pagamento fora do sistema (Pix, dinheiro ou maquininha) e então registra a forma usada no sistema.
- Oferecer Pix, dinheiro e cartão (débito/crédito) como formas de registro. O sistema não cobra, autoriza, confirma nem integra pagamentos. Não controla troco ou comprovante.
- Após o operador confirmar o registro da forma de pagamento, fechar a conta, salvar o extrato imutável com itens/valores/método/horário e liberar a mesa.
- Persistir os dados de demonstração no armazenamento local já usado pelo protótipo.

## Fora de escopo e restrições

- Nenhuma transação financeira ou simulação de transação, emissão fiscal, impressão, integração, autenticação, sincronização entre computadores ou backend.
- Delivery, estoque, relatórios e cadastro completo de produtos ficam para etapas posteriores.
- Dados continuam fictícios e locais. O Anota Aí serve como referência funcional, sem copiar seus elementos proprietários.

## Abordagens consideradas

1. **Fechar o ciclo do caixa sobre a tela existente (escolhida):** acrescentar visão operacional, transferência/mesclagem, conferência e registro de pagamento externo. Menor mudança e validação mais direta com o protótipo existente.
2. **Redesenhar primeiro uma tela geral de pedidos:** melhora a leitura da fila, mas adia as ações que efetivamente concluem o atendimento.

A abordagem 1 combina a visão de salão com o fluxo do caixa, conforme a prioridade do usuário.

## Critérios de conclusão

- Transferência e junção mantêm itens, totais e histórico corretos; mesas bloqueadas não podem ser movidas.
- A conta permite revisar itens e consultar o total antes de concluir.
- O fechamento registra a forma do pagamento externo e um extrato detalhado; só então a mesa volta a livre.
- Testes de domínio e build passam; a prévia local abre no navegador interno e a atualização é registrada no repositório privado `mconecta230-del/sistema`.

## Decisões a cargo da implementação

- Reutilizar componentes, estilos, tipos e persistência existentes; manter a interface em português e responsiva para o monitor do caixa.
- Tornar obrigatória a seleção da forma usada antes de fechar. “Cartão” terá opções de débito/crédito para fins de registro, sem comunicação com a maquininha.

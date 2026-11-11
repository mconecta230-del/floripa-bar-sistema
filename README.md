# Floripa Bar Plataforma

Protótipo local de gestão de salão e caixa. Desenvolvimento pausado em 10/11/2026.

## Como retomar

Use Node.js 22.12 ou superior. Abra um terminal nesta pasta e execute:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

Abra http://127.0.0.1:5180/. Se o servidor já estiver rodando, abra a prévia diretamente. Use o mesmo endereço e navegador para recuperar os dados da sessão anterior. Execute `npm test` para rodar os testes e `npm run build` para gerar a versão de produção em `dist`.

## O que está disponível

| Área | Recursos |
| --- | --- |
| Caixa | Consumo em aberto, mesas por situação, atalhos para pedidos e fechamento, pagamentos recebidos por forma e extrato de contas fechadas. |
| Salão / Mesas | Mapa com 30 mesas, busca e filtro por situação, consumo por mesa, garçom por item, correção por categoria, remoção, item avulso, transferência de mesa ou itens e histórico. |
| Pedidos | Consulta dos pedidos em aberto e acesso às mesas. |
| Promoções | Cadastro por data ou dias da semana. O preço registrado fica na comanda. |
| Configurações | Gestão do cardápio com 138 produtos em 10 categorias. Permite cadastrar produtos e ajustar nome, preço, foto e peso por porção. Os nomes e preços vieram do PDF do Floripa Bar. As fotos do PDF ficaram fora da importação. |
| Relatórios | Filtros para hoje, últimos 7 dias, mês atual e datas personalizadas. Exibe faturamento recebido, ticket médio, formas de pagamento, ranking de comidas e bebidas, produtos, quantidades, peso registrado, movimento diário e detalhes das contas fechadas. |

O faturamento do período usa as contas fechadas. O consumo em aberto é um indicador da situação atual. O relatório calcula quilos a partir do peso por porção registrado no lançamento. Contas antigas sem detalhes ainda entram no faturamento e nas formas de pagamento.

O visual segue as referências do Caixa e do Salão, com menu azul-marinho, logo do Floripa Bar e cores suaves para as situações das mesas. Delivery, Garçons e o cadastro de acessos ainda dependem de implementação. Estoque e Pedidos Agendados foram retirados da navegação.

## Dados e operação

A aplicação inicia com dados de demonstração. Alterações feitas pela interface, como comandas, preços, fotos adicionadas no cadastro e pagamentos registrados, ficam no armazenamento local do navegador. Copiar a pasta do projeto não transfere esses dados. A aplicação registra a forma de pagamento recebida no caixa ou na maquininha e libera a mesa ao finalizar a conta.

A próxima etapa de operação compartilhada inclui banco de dados, sincronização entre dispositivos, autenticação e permissões. Impressão e integrações externas permanecem fora do protótipo atual.

## Arquivos de referência

- `src/App.tsx` e `src/style.css`: interface, navegação e tema.
- `src/domain.ts` e `src/store.ts`: regras operacionais, dados de demonstração e armazenamento local.
- `src/catalog-data.ts`: catálogo inicial do Floripa Bar.
- `src/Reports.tsx`: filtros, indicadores e detalhes dos relatórios.
- `public/floripa-marca.png`: logo da referência visual do salão.
- `docs/superpowers`: especificação e plano históricos da etapa de Caixa. O README descreve o estado atual.
- `tests/domain.test.mjs`: testes de domínio e catálogo. A última alteração de código passou nos 13 testes e na compilação de produção.

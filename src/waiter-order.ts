import { changeItem, makeItem, type Table, type Product, type Promotion } from './domain.ts'

export function submitWaiterOrder(table: Table, cart: {product:number; quantity:number}[], promotions: Promotion[], catalog: Product[], waiter: string, now: Date): Table {
  if (!cart.length) throw new Error('Adicione pelo menos um item ao pedido.')
  return cart.reduce((current, line) => changeItem(current, { ...makeItem(line.product, line.quantity, promotions, now, catalog), server: waiter }, undefined, waiter, now.toLocaleString('pt-BR')), table)
}

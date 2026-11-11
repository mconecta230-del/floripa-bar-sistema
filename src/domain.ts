import { menuCatalog } from './catalog-data.ts'
export type Status = 'livre' | 'ocupada' | 'fechando'
export type Method = 'Dinheiro' | 'Pix' | 'Débito' | 'Crédito'
export type Item = { id: string; product: number; name: string; quantity: number; cents: number; category?: string; server?:string; grams?:number }
export type Table = { id: number; status: Status; waiter: string; opened: string; items: Item[]; history: string[] }
export type Promotion = { id: string; product: number; cents: number; days: number[]; date: string }
export type Payment = { id: string; table: number; cents: number; method: Method; at: string; items?: Item[] }
export type Product = { id:number; category:string; name:string; cents:number; image?:string; grams?:number }
export const catalog: Product[] = menuCatalog
export const categories = [...new Set(catalog.map(p => p.category))]
export const productsForCategory = (category: string, products:Product[]=catalog) => products.filter(p => p.category === category)
export const methods: Method[] = ['Dinheiro', 'Pix', 'Débito', 'Crédito']
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export const total = (items: Item[]) => items.reduce((sum, item) => sum + item.cents * item.quantity, 0)
export const localDate = (now: Date) => [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(v => String(v).padStart(2, '0')).join('-')
export function active(p: Promotion, now: Date) {
  return p.days.length ? p.days.includes(now.getDay()) : p.date === localDate(now)
}
export function makeItem(product: number, quantity: number, promotions: Promotion[], now: Date, products:Product[]=catalog): Item {
  const entry = products.find(p => p.id === product)
  if (!entry || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Produto ou quantidade inválida.')
  const offer = promotions.findLast(p => p.product === product && active(p, now))
  return { id: crypto.randomUUID(), product, name: entry.name, category:entry.category, grams:entry.grams, cents: offer?.cents ?? entry.cents, quantity }
}
export function makeCustomItem(name: string, category: string, cents: number, quantity: number, server?:string): Item {
  if (!name.trim()) throw new Error('Informe o nome do item.')
  if (!Number.isSafeInteger(cents) || cents < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Preço ou quantidade inválida.')
  return { id:crypto.randomUUID(), product:0, name:name.trim(), category, cents, quantity, server }
}
export function changeItem(table: Table, item: Item, oldId: string | undefined, actor: string, at: string): Table {
  if (table.status === 'fechando') throw new Error('Reabra a mesa antes de editar.')
  const old = table.items.find(line => line.id === oldId)
  if (oldId && !old) throw new Error('Item não encontrado.')
  const items = old ? table.items.map(line => line.id === oldId ? item : line) : [...table.items, item]
  const event = old ? `Corrigiu ${old.quantity}× ${old.name} para ${item.quantity}× ${item.name}` : `Adicionou ${item.quantity}× ${item.name}`
  return { ...table, status: 'ocupada', opened: table.opened || at, waiter: table.waiter || actor, items, history: [`${event} • ${actor} • ${at}`, ...table.history] }
}
export function editItem(table: Table, old: Item, product: number, quantity: number, promotions: Promotion[], actor: string, at: string, now: Date, products:Product[]=catalog): Table {
  const oldCategory = old.category ?? products.find(p => p.id === old.product)?.category
  const newCategory = products.find(p => p.id === product)?.category
  if (oldCategory && newCategory !== oldCategory) throw new Error('O produto substituto precisa ser da mesma categoria.')
  const item = makeItem(product, quantity, promotions, now, products)
  item.server = old.server
  if (old.product === product) {
    item.cents = old.cents
    item.grams = old.grams
  }
  return changeItem(table, item, old.id, actor, at)
}
export function removeItem(table: Table, itemId: string, actor: string, at: string): Table {
  if (table.status === 'fechando') throw new Error('Reabra a mesa antes de editar.')
  const old = table.items.find(item => item.id === itemId)
  if (!old) throw new Error('Item não encontrado.')
  return {...table, items:table.items.filter(item=>item.id!==itemId), history:[`Removeu ${old.quantity}× ${old.name} • ${actor} • ${at}`,...table.history]}
}
export function transferTable(tables: Table[], sourceId: number, destinationId: number, actor: string, at: string): Table[] {
  if (sourceId === destinationId) throw new Error('Escolha mesas diferentes.')
  const source = tables.find(table => table.id === sourceId)
  const destination = tables.find(table => table.id === destinationId)
  if (!source || !destination) throw new Error('Mesa não encontrada.')
  if (source.status === 'fechando' || destination.status === 'fechando') throw new Error('Mesa em fechamento não pode ser transferida.')
  if (source.status !== 'ocupada' || !source.items.length) throw new Error('A mesa de origem precisa estar ocupada.')
  if (destination.status !== 'livre' || destination.items.length) throw new Error('A mesa de destino precisa estar livre.')

  const event = `Transferência para Mesa ${destinationId} • ${actor} • ${at}`
  const targetEvent = `Consumo recebido da Mesa ${sourceId} • ${actor} • ${at}`
  return tables.map(table => {
    if (table.id === sourceId) return { ...table, status: 'livre', waiter: '', opened: '', items: [], history: [event, ...table.history] }
    if (table.id === destinationId) return {
      ...table,
      status: 'ocupada',
      waiter: table.waiter || source.waiter,
      opened: table.opened || source.opened,
      items: [...table.items, ...source.items.map(item => ({ ...item }))],
      history: [targetEvent, ...table.history],
    }
    return table
  })
}
export function transferItems(tables: Table[], sourceId: number, destinationId: number, itemIds: string[], actor: string, at: string): Table[] {
  if (sourceId === destinationId) throw new Error('Escolha mesas diferentes.')
  const source=tables.find(t=>t.id===sourceId), destination=tables.find(t=>t.id===destinationId)
  if (!source || !destination) throw new Error('Mesa não encontrada.')
  if (source.status!=='ocupada' || destination.status==='fechando') throw new Error('Confira o estado das mesas antes de transferir itens.')
  if (!itemIds.length || itemIds.some(id=>!source.items.some(item=>item.id===id))) throw new Error('Selecione itens válidos para transferir.')
  const moved=source.items.filter(item=>itemIds.includes(item.id)).map(item=>({...item}))
  const remaining=source.items.filter(item=>!itemIds.includes(item.id))
  return tables.map(t=>{
    if(t.id===sourceId) return {...t,status:remaining.length?'ocupada':'livre',waiter:remaining.length?t.waiter:'',opened:remaining.length?t.opened:'',items:remaining,history:[`Transferiu ${moved.map(i=>i.name).join(', ')} para Mesa ${destinationId} • ${actor} • ${at}`,...t.history]}
    if(t.id===destinationId) return {...t,status:'ocupada',waiter:t.waiter||source.waiter,opened:t.opened||source.opened,items:[...t.items,...moved],history:[`Recebeu ${moved.map(i=>i.name).join(', ')} da Mesa ${sourceId} • ${actor} • ${at}`,...t.history]}
    return t
  })
}
export function settleSplit(table: Table, parts: { method: Method; cents: number }[], at: string): { table: Table; payments: Payment[] } {
  if (table.status !== 'fechando' || !table.items.length) throw new Error('Mesa não está pronta para pagamento.')
  if (!parts.length) throw new Error('Adicione ao menos uma forma de pagamento.')
  for (const p of parts) {
    if (!methods.includes(p.method)) throw new Error('Selecione uma forma de pagamento válida.')
    if (p.cents <= 0) throw new Error('O valor de cada pagamento deve ser maior que zero.')
  }
  const tableTotal = total(table.items)
  const paidTotal = parts.reduce((sum, p) => sum + p.cents, 0)
  if (paidTotal < tableTotal) throw new Error(`Valor insuficiente. Faltam ${money(tableTotal - paidTotal)}.`)

  const payments: Payment[] = parts.map(p => ({
    id: crypto.randomUUID(),
    table: table.id,
    cents: p.cents,
    method: p.method,
    at,
    items: table.items.map(item => ({ ...item })),
  }))

  const summary = parts.length === 1
    ? parts[0].method
    : parts.map(p => `${p.method} (${money(p.cents)})`).join(', ')

  const historyMsg = `Conta encerrada • Forma registrada: ${summary} • ${money(paidTotal)} • ${at}`
  const freedTable: Table = {
    ...table,
    status: 'livre',
    items: [],
    opened: '',
    waiter: '',
    history: [historyMsg, ...table.history],
  }
  return { table: freedTable, payments }
}

export function settle(table: Table, method: Method, at: string): { table: Table; payment: Payment } {
  if (!methods.includes(method)) throw new Error('Selecione uma forma de pagamento válida.')
  const res = settleSplit(table, [{ method, cents: total(table.items) }], at)
  return { table: res.table, payment: res.payments[0] }
}

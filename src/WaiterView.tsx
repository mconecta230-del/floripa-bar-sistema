import { useState } from 'react'
import { demoRepository } from './store'
import { money, total } from './domain'
import { submitWaiterOrder } from './waiter-order'

export function WaiterView({ logout }: {logout: () => void}) {
  const [state, setState] = useState(demoRepository.load)
  const [selected, setSelected] = useState<number | null>(null)
  const [cart, setCart] = useState<{product:number; quantity:number}[]>([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const table = state.tables.find(t => t.id === selected)
  const price = (id:number) => state.catalog.find(p => p.id === id)?.cents ?? 0
  const add = (product:number) => setCart(c => c.some(item => item.product === product) ? c.map(item => item.product === product ? {...item, quantity:item.quantity + 1} : item) : [...c, {product, quantity:1}])
  const adjust = (product:number, delta:number) => setCart(c => c.map(item => item.product === product ? {...item, quantity:item.quantity + delta} : item).filter(item => item.quantity > 0))
  function submit() {
    if (!table) return
    try {
      const latest = demoRepository.load()
      const currentTable = latest.tables.find(t => t.id === table.id)
      if (!currentTable) throw new Error('Mesa não encontrada.')
      const updated = submitWaiterOrder(currentTable, cart, [], latest.catalog, 'Garçom 1', new Date())
      const next = {...latest, tables:latest.tables.map(t => t.id === updated.id ? updated : t)}
      demoRepository.save(next)
      setState(next)
      setCart([])
      setSelected(null)
      setMessage(`Pedido gerado para Mesa ${updated.id}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o pedido.') }
  }
  return <main className="waiter-view"><header><h1>{table ? `Mesa ${table.id}` : 'Mesas'}</h1><button className="outline" onClick={table ? () => {setSelected(null); setCart([]); setMessage('')} : logout}>{table ? 'Voltar às mesas' : 'Sair'}</button></header>
    <p className="waiter-demo">Demonstração local: os pedidos ficam apenas neste navegador.</p>
    {message && <p role="status">{message}</p>}
    {!table ? <div className="table-grid">{state.tables.map(t => <button className={`table-card ${t.status}`} key={t.id} onClick={() => {setSelected(t.id);setMessage('')}}><span><strong>Mesa {t.id}</strong><small>{t.status === 'livre' ? 'Livre' : t.status === 'ocupada' ? 'Ocupada' : 'Em fechamento'}</small></span></button>)}</div> : <>
      {table.status === 'fechando' ? <p>Esta mesa está em fechamento e não pode receber novos pedidos.</p> : <><label className="waiter-search">Buscar no cardápio<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do produto" /></label>
      <div className="waiter-products">{state.catalog.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).map(p => <button className="outline waiter-product" key={p.id} onClick={() => add(p.id)}><span><strong>{p.name}</strong><small>{p.category}</small></span><b>{money(price(p.id))} +</b></button>)}</div>
      <section className="panel waiter-cart"><h2>Pedido</h2>{cart.length ? cart.map(item => {const product=state.catalog.find(p => p.id===item.product);return <div className="waiter-cart-row" key={item.product}><span>{product?.name} · {money(price(item.product)*item.quantity)}</span><button className="outline" aria-label={`Diminuir ${product?.name}`} onClick={() => adjust(item.product,-1)}>−</button><strong>{item.quantity}</strong><button className="outline" aria-label={`Aumentar ${product?.name}`} onClick={() => adjust(item.product,1)}>+</button></div>}) : <p>Nenhum item adicionado.</p>}
      <strong>Total: {money(cart.reduce((sum,item)=>sum+price(item.product)*item.quantity,0))}</strong><button className="primary full" disabled={!cart.length} onClick={submit}>Gerar pedido</button></section></>}
      {table.items.length > 0 && <p>Consumo atual da mesa: {money(total(table.items))}</p>}
    </>}
  </main>
}

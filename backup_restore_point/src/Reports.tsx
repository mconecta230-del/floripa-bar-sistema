import { useState } from 'react'
import { localDate, methods, money, type Payment, type Product } from './domain'

const drinks = new Set(['CERVEJAS', 'REFRIGERANTE', 'ÁGUAS', 'SUCOS', 'DRINKS DOSES', 'CAIPIRINHAS'])
const foods = new Set(['FRUTOS DO MAR', 'PORÇÕES', 'LANCHES'])
const classify = (category: string) => drinks.has(category) ? 'Bebidas' : foods.has(category) ? 'Comidas' : 'Outros'
const brNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

function paymentDay(at: string) {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?=,|\s|$)/.exec(at)
  return parts ? [parts[3], parts[2].padStart(2, '0'), parts[1].padStart(2, '0')].join('-') : ''
}

export function Reports({ payments, catalog, now, openTotal }: { payments: Payment[]; catalog: Product[]; now: Date; openTotal: number }) {
  const [period, setPeriod] = useState('today')
  const today = localDate(now)
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 6)
  const from = period === 'custom' ? start : period === 'week' ? localDate(weekStart) : period === 'month' ? today.slice(0, 7) + '-01' : today
  const to = period === 'custom' ? end : today
  const valid = Boolean(from && to && from <= to)
  const closed = valid ? payments.filter(payment => {
    const day = paymentDay(payment.at)
    return day >= from && day <= to
  }) : []
  const revenue = closed.reduce((sum, payment) => sum + payment.cents, 0)
  const products = new Map<string, { name: string; category: string; units: number; cents: number; grams: number }>()
  const days = new Map<string, { accounts: number; cents: number }>()
  const byId = new Map(catalog.map(product => [product.id, product]))
  let weighedUnits = 0
  for (const payment of closed) {
    const day = paymentDay(payment.at)
    const daily = days.get(day) ?? { accounts: 0, cents: 0 }
    daily.accounts++
    daily.cents += payment.cents
    days.set(day, daily)
    for (const item of payment.items ?? []) {
      const category = item.category || byId.get(item.product)?.category || 'Sem categoria'
      const key = JSON.stringify([item.product, item.name, category])
      const row = products.get(key) ?? { name: item.name, category, units: 0, cents: 0, grams: 0 }
      row.units += item.quantity
      row.cents += item.cents * item.quantity
      if (item.grams) {
        row.grams += item.grams * item.quantity
        weighedUnits += item.quantity
      }
      products.set(key, row)
    }
  }
  const ranking = [...products.values()].sort((a, b) => b.units - a.units || b.cents - a.cents || a.name.localeCompare(b.name, 'pt-BR'))
  const units = ranking.reduce((sum, row) => sum + row.units, 0)
  const grams = ranking.reduce((sum, row) => sum + row.grams, 0)
  const legacyCount = closed.filter(payment => !payment.items?.length).length
  const displayDay = (day: string) => day.split('-').reverse().join('/')

  return <div className="reports">
    <section className="panel module">
      <div className="section-title"><h2>Relatório de vendas</h2><label>Período <select value={period} onChange={event => setPeriod(event.target.value)}><option value="today">Hoje</option><option value="week">Últimos 7 dias</option><option value="month">Este mês</option><option value="custom">Personalizado</option></select></label></div>
      {period === 'custom' && <div className="report-dates"><label>De <input type="date" value={start} onChange={event => setStart(event.target.value)}/></label><label>Até <input type="date" value={end} onChange={event => setEnd(event.target.value)}/></label></div>}
      {valid ? <p>{displayDay(from)} a {displayDay(to)} · Contas fechadas no período</p> : <p role="alert">Informe um intervalo de datas válido.</p>}
      {valid && !closed.length && <p>Nenhuma conta fechada neste período.</p>}
    </section>
    {valid && <>
      <div className="report-metrics">
        {[['Faturamento recebido', money(revenue)], ['Contas fechadas', closed.length], ['Ticket médio', money(closed.length ? Math.round(revenue / closed.length) : 0)], ['Unidades detalhadas', units], ['Peso registrado', weighedUnits ? brNumber.format(grams / 1000) + ' kg' : '—'], ['Consumo em aberto agora', money(openTotal)]].map(([label, value]) => <div className="panel" key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      <p className="report-note">Peso calculado para {weighedUnits} de {units} unidades detalhadas, conforme os gramas cadastrados no lançamento. {legacyCount > 0 && `${legacyCount} conta(s) antiga(s) sem itens detalhados entram no faturamento e nas formas de pagamento.`}</p>
      <div className="report-columns">
        <section className="panel module"><h2>Formas de pagamento</h2>{methods.map(method => {
          const entries = closed.filter(payment => payment.method === method)
          return <div className="list-row" key={method}><span>{method}<small>{entries.length} conta(s)</small></span><strong>{money(entries.reduce((sum, payment) => sum + payment.cents, 0))}</strong></div>
        })}</section>
        <section className="panel module"><h2>Comidas, bebidas e outros</h2>{['Comidas', 'Bebidas', 'Outros'].map(group => {
          const rows = ranking.filter(row => classify(row.category) === group)
          return <div className="list-row" key={group}><span>{group}<small>{rows.reduce((sum, row) => sum + row.units, 0)} unidades</small></span><strong>{money(rows.reduce((sum, row) => sum + row.cents, 0))}</strong></div>
        })}</section>
      </div>
      <div className="report-columns">
        {['Comidas', 'Bebidas'].map(group => <section className="panel module" key={group}><h2>{group === 'Comidas' ? 'Comidas mais vendidas' : 'Bebidas mais vendidas'}</h2>{ranking.filter(row => classify(row.category) === group).slice(0, 5).map(row => <div className="list-row" key={row.name + row.category}><span>{row.name}</span><strong>{row.units} un.</strong></div>)}{!ranking.some(row => classify(row.category) === group) && <p>Sem vendas detalhadas.</p>}</section>)}
      </div>
      <section className="panel module report-table"><h2>Todos os produtos vendidos</h2><table><thead><tr><th>Produto</th><th>Categoria</th><th>Unidades</th><th>Peso</th><th>Total</th></tr></thead><tbody>{ranking.map((row, index) => <tr key={index}><td>{row.name}</td><td>{row.category}</td><td>{row.units}</td><td>{row.grams ? brNumber.format(row.grams / 1000) + ' kg' : '—'}</td><td>{money(row.cents)}</td></tr>)}</tbody></table>{!ranking.length && <p>Sem produtos detalhados no período.</p>}</section>
      <section className="panel module"><h2>Movimento por dia</h2>{[...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, row]) => <div className="list-row" key={day}><span>{displayDay(day)}<small>{row.accounts} conta(s)</small></span><strong>{money(row.cents)}</strong></div>)}{!days.size && <p>Sem movimento no período.</p>}</section>
      <section className="panel module"><h2>Contas do período</h2>{closed.map(payment => <details key={payment.id} className="report-receipt"><summary>Mesa {payment.table} · {payment.at} · {payment.method} · {money(payment.cents)}</summary>{payment.items?.length ? payment.items.map(item => <div className="list-row" key={item.id}><span>{item.quantity}× {item.name}</span><strong>{money(item.quantity * item.cents)}</strong></div>) : <p>Conta sem itens detalhados.</p>}</details>)}{!closed.length && <p>Sem contas para exibir.</p>}</section>
    </>}
  </div>
}


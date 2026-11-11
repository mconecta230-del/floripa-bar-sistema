import { Reports } from './Reports'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Armchair, ClipboardList, CalendarDays, CreditCard, Utensils, Tag, ChartNoAxesColumn, Users, Settings, Plus, Search, Clock, Hourglass, Pencil, History, ReceiptText, X, ChevronDown, CircleUser, Menu, Bell, ArrowRight, ArrowRightLeft, Trash2, KeyRound, UserCheck, UserX } from 'lucide-react'
import { active, catalog, categories, changeItem, editItem, localDate, makeItem, makeCustomItem, methods, money, removeItem, settle, settleSplit, total, transferItems, transferTable, productsForCategory, type Item, type Method, type Payment, type Status, type Table } from './domain'
import { demoRepository, type Waiter } from './store'

const nav = [
  ['Caixa', CreditCard], ['Salão / Mesas', Armchair], ['Pedidos', ClipboardList], ['Promoções', Tag], ['Relatórios', ChartNoAxesColumn], ['Garçons', Users], ['Configurações', Settings],
] as const
type Module = typeof nav[number][0]
const labels: Record<Status, string> = { livre: 'Livre', ocupada: 'Ocupada', fechando: 'Fechando conta' }
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
type Dialog = { kind: 'item' | 'custom' | 'edit' | 'receipt' | 'history' | 'pay' | 'transferTable' | 'transferItems' | 'remove'; table: number; item?: Item } | { kind: 'promotion' | 'notices' | 'pick' } | { kind: 'paidReceipt'; paymentId: string }
const stamp = () => new Date().toLocaleString('pt-BR')

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  useEffect(() => {
    const el = document.querySelector<HTMLDialogElement>('dialog')
    el?.showModal()
    return () => el?.close()
  }, [])
  return <dialog onCancel={e => { e.preventDefault(); close() }} aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button type="button" className="icon" onClick={close} aria-label="Fechar janela"><X size={20}/></button></div>{children}</dialog>
}

function PaymentDialog({
  table,
  onSettle,
}: {
  table: Table
  onSettle: (payments: Payment[], freedTable: Table) => void
}) {
  const tableTotal = total(table.items)
  const [parts, setParts] = useState<{ id: string; method: Method; cents: number }[]>([])
  const [method, setMethod] = useState<Method>('Pix')
  const [amountStr, setAmountStr] = useState(() => (tableTotal / 100).toFixed(2))
  const [cashGivenStr, setCashGivenStr] = useState('')

  const paidCents = parts.reduce((sum, p) => sum + p.cents, 0)
  const remainingCents = Math.max(0, tableTotal - paidCents)

  const handleSplitBy = (people: number) => {
    if (people <= 1 || remainingCents <= 0) return
    const portion = Math.ceil(remainingCents / people)
    setAmountStr((portion / 100).toFixed(2))
  }

  const handleAddPart = () => {
    const cents = Math.round(Number(amountStr.replace(',', '.')) * 100)
    if (isNaN(cents) || cents <= 0) return
    const toPay = Math.min(cents, remainingCents)
    if (toPay <= 0) return

    const newParts = [...parts, { id: crypto.randomUUID(), method, cents: toPay }]
    setParts(newParts)
    const newRemaining = Math.max(0, remainingCents - toPay)
    setAmountStr((newRemaining / 100).toFixed(2))
    setCashGivenStr('')
  }

  const handleRemovePart = (id: string) => {
    const newParts = parts.filter(p => p.id !== id)
    setParts(newParts)
    const newPaid = newParts.reduce((s, p) => s + p.cents, 0)
    const newRemaining = Math.max(0, tableTotal - newPaid)
    setAmountStr((newRemaining / 100).toFixed(2))
  }

  const handleFinalize = () => {
    const finalParts = parts.length > 0 ? parts : [{ id: crypto.randomUUID(), method, cents: tableTotal }]
    const result = settleSplit(table, finalParts, new Date().toLocaleString('pt-BR'))
    onSettle(result.payments, result.table)
  }

  const cashGivenCents = Math.round(Number(cashGivenStr.replace(',', '.')) * 100)
  const inputCents = Math.round(Number(amountStr.replace(',', '.')) * 100)
  const changeCents = method === 'Dinheiro' && cashGivenCents > inputCents ? cashGivenCents - inputCents : 0

  return (
    <div className="payment-dialog-content">
      <p className="external-payment-note">
        Confira o consumo e registre os pagamentos recebidos (integrais ou divididos).
      </p>

      <div className="checkout-lines">
        {table.items.map(item => (
          <div className="list-row" key={item.id}>
            <span>
              {item.quantity}× {item.name}
              <small>{money(item.cents)} cada</small>
            </span>
            <strong>{money(item.quantity * item.cents)}</strong>
          </div>
        ))}
      </div>

      <div className="split-summary-box">
        <div className="split-summary-row">
          <span>Total da mesa:</span>
          <strong>{money(tableTotal)}</strong>
        </div>
        {parts.length > 0 && (
          <div className="split-summary-row text-success">
            <span>Já recebido:</span>
            <strong>{money(paidCents)}</strong>
          </div>
        )}
        <div className={`split-summary-row split-balance-row ${remainingCents === 0 ? 'paid-complete' : 'pending'}`}>
          <span>{remainingCents === 0 ? 'Conta totalmente quitada!' : 'Saldo restante:'}</span>
          <b>{money(remainingCents)}</b>
        </div>
      </div>

      {parts.length > 0 && (
        <div className="parts-list">
          <small className="parts-title">Pagamentos adicionados:</small>
          {parts.map((p, idx) => (
            <div key={p.id} className="part-card">
              <span className={`method-pill ${p.method.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{p.method}</span>
              <span className="part-idx">#{idx + 1}</span>
              <strong className="part-val">{money(p.cents)}</strong>
              <button
                type="button"
                className="icon delete-part-btn"
                title="Remover pagamento"
                onClick={() => handleRemovePart(p.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {remainingCents > 0 && (
        <div className="split-add-section">
          <div className="split-fast-row">
            <span className="split-fast-label">Rachar saldo em:</span>
            <div className="split-btn-group">
              {[2, 3, 4, 5].map(n => (
                <button
                  type="button"
                  key={n}
                  className="split-pill-btn"
                  onClick={() => handleSplitBy(n)}
                >
                  {n} pessoas ({money(Math.ceil(remainingCents / n))})
                </button>
              ))}
            </div>
          </div>

          <div className="split-form-row">
            <label className="split-field">
              <span>Forma de pagamento</span>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as Method)}
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Débito">Cartão de débito</option>
                <option value="Crédito">Cartão de crédito</option>
              </select>
            </label>

            <label className="split-field">
              <span>Valor a lançar (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={(remainingCents / 100).toFixed(2)}
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
              />
            </label>
          </div>

          {method === 'Dinheiro' && (
            <div className="cash-calculator">
              <label className="split-field">
                <span>Valor entregue pelo cliente (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 50,00"
                  value={cashGivenStr}
                  onChange={e => setCashGivenStr(e.target.value)}
                />
              </label>
              {changeCents > 0 && (
                <div className="change-badge">
                  <span>Troco a devolver:</span>
                  <strong>{money(changeCents)}</strong>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="outline full add-payment-button"
            onClick={handleAddPart}
            disabled={!amountStr || Number(amountStr) <= 0}
          >
            <Plus size={16} />
            Adicionar pagamento de {money(Math.round(Number(amountStr || 0) * 100))} no {method}
          </button>
        </div>
      )}

      {remainingCents === 0 ? (
        <button
          type="button"
          className="primary full finalize-btn"
          onClick={handleFinalize}
        >
          <CreditCard size={18} />
          Concluir recebimentos e liberar Mesa {table.id}
        </button>
      ) : parts.length === 0 ? (
        <button
          type="button"
          className="primary full finalize-btn"
          onClick={handleFinalize}
        >
          <CreditCard size={18} />
          Receber valor total no {method} ({money(tableTotal)}) e liberar mesa
        </button>
      ) : (
        <p className="split-pending-warning">
          Faltam <strong>{money(remainingCents)}</strong> para quitar a conta e liberar a mesa.
        </p>
      )}
    </div>
  )
}


export function App() {
  const [state, setState] = useState(demoRepository.load)
  const [page, setPage] = useState<Module>('Caixa')
  const [tab, setTab] = useState('Mesas')
  const [selected, setSelected] = useState(5)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Status | ''>('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [notice, setNotice] = useState('')
  const [menu, setMenu] = useState(false)
  const [moveIds, setMoveIds] = useState<string[]>([])
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { try { demoRepository.save(state) } catch { setNotice('O navegador não conseguiu salvar os dados locais.') } }, [state])

  const table = state.tables.find(t => t.id === selected)!
  const open = state.tables.filter(t => t.status !== 'livre')
  const offer = state.promotions.findLast(p => active(p, now))
  const offerProduct = state.catalog.find(p => p.id === offer?.product)
  const counts = { livre: 0, ocupada: 0, fechando: 0 }
  state.tables.forEach(t => counts[t.status]++)
  const openTotal = open.reduce((sum, t) => sum + total(t.items), 0)
  const todayLabel = now.toLocaleDateString('pt-BR')
  const paymentsToday = state.payments.filter(payment => payment.at.startsWith(todayLabel))
  const receivedToday = paymentsToday.reduce((sum,payment)=>sum+payment.cents,0)
  const go = (module: Module) => { setPage(module); setMenu(false); if (module === 'Salão / Mesas') setTab('Mesas') }
  const pick = (id: number) => { setSelected(id); go('Salão / Mesas') }
  const close = () => setDialog(null)
  const update = (next: Table) => setState(s => ({ ...s, tables: s.tables.map(t => t.id === next.id ? next : t) }))
  const startClose = (t: Table) => {
    if (t.status === 'ocupada') update({ ...t, status: 'fechando', history: [`Conferência de conta iniciada • Gerente • ${stamp()}`, ...t.history] })
    setDialog({ kind: 'pay', table: t.id })
  }
  const transfer = (sourceId: number, destinationId: number) => {
    try {
      const tables = transferTable(state.tables, sourceId, destinationId, 'Gerente', stamp())
      setState(s => ({ ...s, tables }))
      setSelected(destinationId)
      setDialog(null)
      setNotice(`Consumo da Mesa ${sourceId} transferido para a Mesa ${destinationId}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível transferir a mesa.')
    }
  }
  const moveItems = (sourceId:number,destinationId:number) => { try { setState(s=>({...s,tables:transferItems(s.tables,sourceId,destinationId,moveIds,'Gerente',stamp())})); setDialog(null); setMoveIds([]); setNotice(`Itens transferidos da Mesa ${sourceId} para a Mesa ${destinationId}.`) } catch(e) { setNotice(e instanceof Error?e.message:'Não foi possível transferir os itens.') } }
  const deleteItem = (t:Table,item:Item) => { try { update(removeItem(t,item.id,'Gerente',stamp())); setDialog(null); setNotice('Item removido e registrado no histórico.') } catch(e) { setNotice(e instanceof Error?e.message:'Não foi possível remover o item.') } }
  const dialogTable = dialog && 'table' in dialog ? state.tables.find(t => t.id === dialog.table)! : null
  const paidReceipt = dialog?.kind === 'paidReceipt' ? state.payments.find(payment => payment.id === dialog.paymentId) : null
  const visible = state.tables.filter(t => (!filter || t.status === filter) && (!query.trim() || `mesa ${t.id}`.includes(query.trim().toLowerCase())))
  const tableList = (rows: Table[], cashier = false) => rows.length ? <div className="list">{rows.map(t => <div className="list-row" key={t.id}><div><strong>Mesa {t.id}</strong><small>{labels[t.status]} · {t.items.length} itens</small></div><strong>{money(total(t.items))}</strong><button className="outline" onClick={() => cashier ? startClose(t) : pick(t.id)}>{cashier ? t.status === 'fechando' ? 'Continuar fechamento' : 'Conferir conta' : 'Ver mesa'}</button></div>)}</div> : <p className="empty">Nenhuma mesa com consumo em aberto.</p>

  function submitItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!dialogTable || !dialog || !('item' in dialog || dialog.kind === 'item')) return
    const data = new FormData(e.currentTarget)
    const old = dialog.item
    const product = Number(data.get('product'))
    const quantity = Number(data.get('quantity'))
    const next = old
      ? editItem(dialogTable, old, product, quantity, state.promotions, 'Gerente', stamp(), new Date(),state.catalog)
      : changeItem(dialogTable, {...makeItem(product, quantity, state.promotions, new Date(),state.catalog),server:String(data.get('server')||dialogTable.waiter||'Gerente')}, undefined, 'Gerente', stamp())
    setState(s => ({ ...s, tables: s.tables.map(t => t.id === next.id ? next : t), notices: old ? [`Mesa ${next.id} • ${next.history[0]} • Caixa atualizado: ${money(total(next.items))}`, ...s.notices] : s.notices }))
    setNotice(old ? 'Item corrigido. Caixa e histórico atualizados.' : 'Item adicionado à mesa.')
    close()
  }
  function submitCustomItem(e:FormEvent<HTMLFormElement>) { e.preventDefault(); if(!dialogTable)return; const data=new FormData(e.currentTarget); const cents=Math.round(Number(data.get('price'))*100); try { const item=makeCustomItem(String(data.get('name')),String(data.get('category')),cents,Number(data.get('quantity')),String(data.get('server')||dialogTable.waiter||'Gerente')); const next=changeItem(dialogTable,item,undefined,'Gerente',stamp()); update(next); setNotice('Item avulso adicionado à mesa.'); close() } catch(error) {setNotice(error instanceof Error?error.message:'Não foi possível adicionar o item.')} }
  const updateProduct=(id:number,patch:Partial<(typeof catalog)[number]>)=>setState(s=>({...s,catalog:s.catalog.map(p=>p.id===id?{...p,...patch}:p)}))
  const addProduct=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const d=new FormData(e.currentTarget);const name=String(d.get('name')).trim(),category=String(d.get('category')).trim(),cents=Math.round(Number(d.get('price'))*100);if(!name||!category||cents<1){setNotice('Preencha nome, categoria e preço do produto.');return}setState(s=>({...s,catalog:[...s.catalog,{id:Math.max(0,...s.catalog.map(p=>p.id))+1,name,category,cents,image:String(d.get('image')||'')||undefined}]}));setNotice('Produto cadastrado no cardápio local.')}
  const addWaiter=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const d=new FormData(e.currentTarget);const name=String(d.get('name')||'').trim(),login=String(d.get('login')||'').trim().toLowerCase(),pin=String(d.get('pin')||'').trim();if(!name||!login||!pin){setNotice('Preencha nome, usuário e senha de 4 a 6 dígitos.');return}if(state.waiters.some(w=>w.login===login)){setNotice('Já existe um garçom com esse usuário de login.');return}const newWaiter:Waiter={id:crypto.randomUUID(),name,login,pin,active:true,createdAt:new Date().toLocaleDateString('pt-BR')};setState(s=>({...s,waiters:[...s.waiters,newWaiter]}));(e.target as HTMLFormElement).reset();setNotice(`Garçom ${name} cadastrado com sucesso.`)}
  const toggleWaiter=(id:string)=>setState(s=>({...s,waiters:s.waiters.map(w=>w.id===id?{...w,active:!w.active}:w)}))
  const removeWaiter=(id:string)=>{const target=state.waiters.find(w=>w.id===id);if(window.confirm(`Remover o acesso de ${target?.name}?`)){setState(s=>({...s,waiters:s.waiters.filter(w=>w.id!==id)}));setNotice('Acesso removido com sucesso.')}}

  return <div className="shell">
    <aside className={menu ? 'sidebar shown' : 'sidebar'}>
      <div className="brand" role="img" aria-label="Floripa Bar"/>
      <nav aria-label="Módulos">{nav.map(([label, Icon]) => <button key={label} className={page === label ? 'nav active' : 'nav'} onClick={() => go(label)} aria-current={page === label ? 'page' : undefined}><Icon size={21}/>{label}</button>)}</nav>
      <div className="profile"><CircleUser size={24}/><span><strong>Gerente</strong><small>Operador do Caixa</small></span></div>
    </aside>
    <main className="workspace">
      <header className={page === 'Caixa' ? 'top cash-top' : 'top'}><button className="icon mobile-menu" aria-label="Abrir menu" onClick={() => setMenu(!menu)}><Menu/></button><div className="heading"><span className="heading-icon"><Armchair size={27}/></span><div><h1>{page === 'Salão / Mesas' ? 'Gestão do Salão' : page}</h1><p>{page === 'Salão / Mesas' ? 'Mesas e comandas' : page === 'Caixa' ? 'Controle de contas, pagamentos e fechamento de caixa' : 'Floripa Bar · Operação'}</p></div></div>
        <div className="metrics">{([['livre','Livres', Armchair],['ocupada','Ocupadas',Armchair],['fechando','Fechando conta',Hourglass]] as const).map(([key,title,Icon]) => <button key={key} className={`metric ${key}`} aria-pressed={page === 'Salão / Mesas' && filter === key} onClick={() => { go('Salão / Mesas'); setFilter(filter === key ? '' : key) }}><Icon size={21}/><span><strong>{title}</strong><small>{counts[key]} mesas</small></span></button>)}</div>
        <div className="clock"><small>{now.toLocaleDateString('pt-BR', { weekday:'short',day:'2-digit',month:'2-digit',year:'numeric' })}</small><strong>{now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong></div><div className="top-end"><span className="demo">Modo demonstração</span><button className="icon" aria-label="Avisos da gerência" onClick={() => setDialog({kind:'notices'})}><Bell size={18}/>{state.notices.length > 0 && <b>{state.notices.length}</b>}</button></div>
      </header>
      <div className="content">
        {page === 'Salão / Mesas' && <>
          <div className="toolbar"><div className="tabs" aria-label="Visão do salão">{[['Mesas',Armchair],['Comandas',ReceiptText],['Pedidos do Dia',ClipboardList]].map(([name, Icon]) => { const Label = Icon as typeof Armchair; return <button key={String(name)} className={tab === name ? 'selected' : ''} aria-pressed={tab === name} onClick={() => setTab(String(name))}><Label size={20}/>{name === 'Mesas' ? 'Mesas (30)' : String(name)}</button> })}</div><label className="search"><Search size={18}/><input aria-label="Buscar mesa" placeholder="Buscar mesa..." value={query} onChange={e => { setQuery(e.target.value); setTab('Mesas') }}/></label><button className="primary amber" onClick={() => setDialog({kind:'pick'})}><Plus size={21}/>Novo pedido</button></div>
          {tab === 'Mesas' ? <div className="floor"><section aria-label="Mesas do salão"><div className="table-grid">{visible.map(t => <button key={t.id} className={`table-card ${t.status} ${selected === t.id ? 'chosen' : ''}`} aria-pressed={selected === t.id} onClick={() => setSelected(t.id)}><Armchair size={24}/><span><strong>Mesa {t.id}</strong><small>{labels[t.status]}</small>{t.status !== 'livre' && <b>{money(total(t.items))}</b>}</span></button>)}</div>{!visible.length && <p className="empty">Nenhuma mesa encontrada.</p>}</section>
          <section className="panel detail" aria-label={`Detalhes da mesa ${table.id}`}><div className="detail-heading"><Armchair size={27}/><h2>Mesa {table.id}</h2><span className={`badge ${table.status}`}>{labels[table.status]}</span></div>
            <p className="meta"><Clock size={16}/>{table.opened ? `Abertura: ${table.opened} · Garçom: ${table.waiter}` : 'Disponível para atendimento'}</p>
            <div className="consumption"><h3>Pedidos da mesa</h3>{table.items.length ? table.items.map(item => <div className="item" key={item.id}><b>{item.quantity}×</b><span>{item.name}<small className="item-server">Lançado por {item.server||table.waiter}</small></span><strong>{money(item.quantity * item.cents)}</strong><button className="icon" title="Corrigir item" aria-label={`Corrigir ${item.name}`} disabled={table.status === 'fechando'} onClick={() => setDialog({kind:'edit',table:table.id,item})}><Pencil size={16}/></button><button className="icon" title="Remover item" aria-label={`Remover ${item.name}`} disabled={table.status === 'fechando'} onClick={() => setDialog({kind:'remove',table:table.id,item})}><Trash2 size={16}/></button></div>) : <p className="empty">Nenhum item lançado nesta mesa.</p>}</div>
            <div className="total"><strong>Total da mesa</strong><b>{money(total(table.items))}</b></div>
            <button className="primary full" disabled={!table.items.length} onClick={() => startClose(table)}><CreditCard size={20}/>{table.status === 'fechando' ? 'Continuar fechamento' : 'Conferir conta e fechar mesa'}</button>
            <div className="detail-actions"><button className="outline" disabled={table.status !== 'ocupada' || !table.items.length} onClick={() => setDialog({kind:'transferTable',table:table.id})}><ArrowRightLeft size={17}/>Transferir mesa</button><button className="outline" disabled={table.status !== 'ocupada' || !table.items.length} onClick={() => {setMoveIds([]);setDialog({kind:'transferItems',table:table.id})}}><ArrowRightLeft size={17}/>Transferir item</button></div>
            <div className="detail-actions"><button className="outline" disabled={table.status === 'fechando'} onClick={() => setDialog({kind:'item',table:table.id})}><Plus size={18}/>Adicionar pedido</button><button className="outline" disabled={!table.items.length || table.status === 'fechando'} onClick={() => setDialog({kind:'edit',table:table.id})}><Pencil size={16}/>Editar itens</button><button className="outline" onClick={() => setDialog({kind:'receipt',table:table.id})}><ReceiptText size={16}/>Ver extrato</button><button className="outline" onClick={() => setDialog({kind:'history',table:table.id})}><History size={16}/>Histórico</button></div>
            {table.status === 'fechando' && <button className="text-action" onClick={() => update({...table,status:'ocupada',history:[`Mesa reaberta • Gerente • ${stamp()}`,...table.history]})}>Reabrir mesa para editar</button>}
          </section></div> : <section className="panel module"><h2>{tab}</h2>{tab === 'Comandas' && <p>Consumo em aberto por mesa. Comandas individuais serão incluídas na próxima etapa.</p>}{tableList(open)}{tab === 'Pedidos do Dia' && <p>{state.payments.length} pagamentos simulados registrados neste navegador.</p>}</section>}
          <div className="promostrip"><div className="panel offer"><span className="offer-icon"><Tag size={26}/></span><div><small>PREÇO DO DIA</small><h3>{offerProduct?.name ?? 'Sem promoção ativa'}</h3></div>{offer && offerProduct && <p><del>{money(offerProduct.cents)}</del><ArrowRight size={15}/><strong>{money(offer.cents)}</strong></p>}</div><div className="panel schedule"><CalendarDays size={23}/><div><strong>Promoções programadas</strong><small>{state.promotions.length} na demonstração</small></div><button className="outline" onClick={() => go('Promoções')}>Gerenciar</button></div></div>
        </>}
        {page === 'Promoções' && <section className="panel module"><div className="section-title"><div><h2>Promoções programadas</h2><p>Preços para novos pedidos conforme o dia. Pedidos já lançados preservam seu valor.</p></div><button className="primary amber" onClick={() => setDialog({kind:'promotion'})}><Plus size={18}/>Nova promoção</button></div><div className="list">{state.promotions.map(p => { const product = state.catalog.find(x => x.id === p.product); return <div className="list-row" key={p.id}><div><strong>{product?.name??'Produto removido do cardápio'}</strong><small>{p.days.length ? p.days.map(d => weekdays[d]).join(', ') : p.date.split('-').reverse().join('/')} · {active(p, now) ? 'Ativa hoje' : 'Fora da validade hoje'}</small></div><del>{product?money(product.cents):'—'}</del><strong>{money(p.cents)}</strong></div> })}</div></section>}
        {page === 'Caixa' && <>
          <section className="cash-stats" aria-label="Mesas por situação">
            {([['livre','Mesas livres',Armchair],['ocupada','Ocupadas',Armchair],['fechando','Em fechamento',Clock]] as const).map(([key,label,Icon])=><button key={key} className={`cash-stat ${key}`} onClick={()=>{go('Salão / Mesas');setFilter(key)}}><i><Icon/></i><span><small>{label}</small><strong>{counts[key]}</strong></span></button>)}
          </section>
          <div className="cash-layout">
            <div className="cash-main">
              <section className="panel cash-overview"><div><h2>Consumo em aberto</h2><strong>{money(openTotal)}</strong><p>Total das mesas ocupadas e em fechamento.</p></div><div>Contas fechadas hoje<b>{paymentsToday.length}</b></div><div>Faturamento (hoje)<b>{money(receivedToday)}</b></div></section>
              <div className="cash-shortcuts">
                <button className="primary" onClick={()=>{go('Salão / Mesas');setFilter('ocupada')}}><ClipboardList/>Conferir contas</button>
                <button className="outline" onClick={()=>{go('Salão / Mesas');setFilter('fechando')}}><CreditCard/>Continuar fechamentos</button>
                <button className="outline" onClick={()=>setDialog({kind:'pick'})}><Plus/>Novo pedido</button>
                <button className="outline" onClick={()=>{go('Salão / Mesas');setFilter('')}}><Armchair/>Visualizar salão</button>
              </div>
              <section className="panel module cash-tables"><div className="section-title"><h2>Mesas em atendimento</h2><button className="cash-link" onClick={()=>{go('Salão / Mesas');setFilter('')}}>Ver todas</button></div><table><thead><tr><th>Mesa</th><th>Consumo</th><th>Abertura</th><th>Status</th></tr></thead><tbody>{open.slice(0,4).map(t=><tr key={t.id}><th><button className="cash-link" onClick={()=>startClose(t)}>Mesa {String(t.id).padStart(2,'0')}</button></th><td>{money(total(t.items))}</td><td>{t.opened.includes(',') ? t.opened.split(',').at(-1)?.trim().slice(0,5) : t.opened || '—'}</td><td><span className={`badge ${t.status}`}>{labels[t.status]}</span></td></tr>)}</tbody></table>{!open.length&&<p>Nenhuma mesa em atendimento.</p>}</section>
            </div>
            <section className="panel module cash-summary"><h2>Resumo do caixa (hoje)</h2><div className="cash-inset"><div className="list-row"><span>Consumo em aberto</span><strong>{money(openTotal)}</strong></div><div className="list-row"><span>Contas fechadas</span><strong>{paymentsToday.length}</strong></div><div className="list-row"><b>Pagamentos recebidos</b><strong>{money(receivedToday)}</strong></div></div>
            <div className="cash-inset"><h2>Formas de pagamento</h2>{[['Pix',['Pix']],['Cartão',['Débito','Crédito']],['Dinheiro',['Dinheiro']]].map(([label,group])=><div key={String(label)} className="list-row"><span>{label}</span><strong>{money(paymentsToday.filter(p=>group.includes(p.method)).reduce((sum,p)=>sum+p.cents,0))}</strong></div>)}</div>
            <p className="cash-note">ⓘ O sistema registra os pagamentos, mas não realiza cobranças.</p>
            {!!state.payments.length&&<details><summary>Últimas contas fechadas</summary>{state.payments.slice(0,5).map(payment=><div className="list-row paid-row" key={payment.id}><span>Mesa {payment.table}<small>{payment.method} · {payment.at}</small></span><strong>{money(payment.cents)}</strong><button className="icon" aria-label={`Ver extrato da Mesa ${payment.table}`} onClick={()=>setDialog({kind:'paidReceipt',paymentId:payment.id})}><ReceiptText size={17}/></button></div>)}</details>}
            </section>
          </div>
        </>}
        {page === 'Relatórios' && <Reports payments={state.payments} catalog={state.catalog} now={now} openTotal={openTotal}/> }
        {page === 'Pedidos' && <section className="panel module"><h2>Pedidos em aberto</h2>{tableList(open)}</section>}
        {page === 'Configurações' && <section className="panel module"><h2>Configurações</h2><p>Cardápio e produtos · alterações ficam salvas neste navegador.</p><form className="product-create" onSubmit={addProduct}><label>Nome<input name="name" required/></label><label>Categoria<input name="category" list="menu-categories" required/><datalist id="menu-categories">{[...new Set(state.catalog.map(p=>p.category))].map(c=><option key={c} value={c}/>)}</datalist></label><label>Preço (R$)<input name="price" type="number" min="0.01" step="0.01" required/></label><label>Imagem (URL opcional)<input name="image" type="url"/></label><button className="primary"><Plus size={17}/>Adicionar produto</button></form><div className="menu-admin">{[...new Set(state.catalog.map(p=>p.category))].map(category=><section key={category} className="category-admin-card"><div className="category-admin-header"><h3>{category}</h3><span className="category-count-badge">{state.catalog.filter(p=>p.category===category).length} itens</span></div>{state.catalog.filter(p=>p.category===category).map(p=><div className="product-admin" key={p.id}>{p.image&&<img src={p.image} alt=""/>}<label>Nome<input defaultValue={p.name} onBlur={e=>{if(e.target.value.trim())updateProduct(p.id,{name:e.target.value.trim()})}}/></label><label>Preço (R$)<input type="number" min="0.01" step="0.01" defaultValue={(p.cents/100).toFixed(2)} onBlur={e=>{const cents=Math.round(Number(e.target.value)*100);if(cents>0)updateProduct(p.id,{cents})}}/></label><label>Peso por porção (g)<input type="number" min="1" step="1" defaultValue={p.grams} onBlur={e=>{const grams=e.currentTarget.valueAsNumber;if(!e.currentTarget.value)updateProduct(p.id,{grams:undefined});else if(Number.isSafeInteger(grams)&&grams>0)updateProduct(p.id,{grams})}}/></label><label>Foto<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file){const reader=new FileReader();reader.onload=()=>updateProduct(p.id,{image:String(reader.result)});reader.readAsDataURL(file)}}}/></label></div>)}</section>)}</div></section>}
        {page === 'Garçons' && <section className="panel module">
          <div className="section-title">
            <div>
              <h2>Acesso de Garçons · Aplicativo Android</h2>
              <p>Cadastre login e senha (PIN) para os garçons acessarem o app nos celulares e registrarem pedidos diretamente nas mesas.</p>
            </div>
          </div>

          <form className="waiter-create-form" onSubmit={addWaiter}>
            <h3>Novo Garçom</h3>
            <div className="waiter-form-fields">
              <label>
                <span>Nome completo</span>
                <input name="name" placeholder="Ex: João da Silva" required />
              </label>
              <label>
                <span>Usuário de Login</span>
                <input name="login" placeholder="Ex: joao" required pattern="[a-zA-Z0-9_.-]+" title="Letras, números, ponto ou traço" />
              </label>
              <label>
                <span>Senha / PIN de acesso</span>
                <input name="pin" type="password" placeholder="Ex: 1234" required minLength={4} maxLength={8} />
              </label>
            </div>
            <button className="primary" type="submit"><Plus size={17}/>Cadastrar garçom</button>
          </form>

          <div className="waiters-list-section">
            <h3>Garçons Cadastrados ({state.waiters.length})</h3>
            <div className="waiters-grid">
              {state.waiters.map(w => (
                <div key={w.id} className={`waiter-card ${w.active ? 'active-waiter' : 'inactive-waiter'}`}>
                  <div className="waiter-card-header">
                    <div>
                      <strong>{w.name}</strong>
                      <span className="waiter-login-tag"><KeyRound size={13}/> @{w.login}</span>
                    </div>
                    <span className={`badge ${w.active ? 'ocupada' : 'fechando'}`}>
                      {w.active ? 'Acesso Ativo' : 'Bloqueado'}
                    </span>
                  </div>
                  <div className="waiter-card-body">
                    <p><small>Senha / PIN:</small> <code>•••• ({w.pin})</code></p>
                    <p><small>Cadastrado em:</small> {w.createdAt}</p>
                  </div>
                  <div className="waiter-card-actions">
                    <button
                      type="button"
                      className="outline btn-sm"
                      onClick={() => toggleWaiter(w.id)}
                      title={w.active ? 'Bloquear acesso ao app' : 'Ativar acesso ao app'}
                    >
                      {w.active ? <><UserX size={15}/> Bloquear</> : <><UserCheck size={15}/> Ativar</>}
                    </button>
                    <button
                      type="button"
                      className="icon delete-part-btn"
                      onClick={() => removeWaiter(w.id)}
                      title="Excluir garçom"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!state.waiters.length && <p className="empty">Nenhum garçom cadastrado ainda.</p>}
          </div>
        </section>}
        {!['Salão / Mesas','Promoções','Caixa','Pedidos','Configurações','Relatórios','Garçons'].includes(page) && <section className="panel module"><h2>{page}</h2><p>Módulo reservado para uma próxima etapa. Use o Salão para experimentar os fluxos desta versão.</p><button className="outline" onClick={() => go('Salão / Mesas')}>Voltar ao salão</button></section>}
        <footer>Floripa Bar <span>Dados fictícios · Protótipo local</span></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status">{notice}<button className="icon" aria-label="Dispensar aviso" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {dialog && <Modal key={dialog.kind + (dialog.kind === 'edit' || dialog.kind === 'remove' ? dialog.item?.id ?? '' : '')} title={dialog.kind === 'item' || dialog.kind === 'custom' ? 'Adicionar item' : dialog.kind === 'edit' ? 'Corrigir item' : dialog.kind === 'pay' ? `Fechar Mesa ${dialog.table}` : dialog.kind === 'transferTable' ? 'Transferir mesa' : dialog.kind === 'transferItems' ? 'Transferir itens' : dialog.kind === 'remove' ? 'Remover item' : dialog.kind === 'receipt' ? 'Extrato da mesa' : dialog.kind === 'paidReceipt' ? 'Extrato do pagamento' : dialog.kind === 'history' ? 'Histórico da mesa' : dialog.kind === 'promotion' ? 'Programar promoção' : dialog.kind === 'pick' ? 'Escolher mesa do pedido' : 'Avisos da gerência'} close={close}>
      {paidReceipt && <>
        <p>Mesa {paidReceipt.table} · {paidReceipt.method} · {paidReceipt.at}</p>
        {paidReceipt.items ? paidReceipt.items.map(item => <div className="list-row" key={item.id}><span>{item.quantity}× {item.name} <small>{money(item.cents)} por unidade</small></span><strong>{money(item.quantity * item.cents)}</strong></div>) : <p className="muted">Este pagamento foi registrado antes do detalhamento por item.</p>}
        <div className="total"><strong>Total registrado</strong><b>{money(paidReceipt.cents)}</b></div>
      </>}
      {dialog.kind === 'pick' && <div className="pick-grid">{state.tables.filter(t => t.status !== 'fechando').map(t => <button key={t.id} className="outline" onClick={() => { pick(t.id); setDialog({kind:'item',table:t.id}) }}>Mesa {t.id}</button>)}</div>}
      {dialog.kind === 'transferTable' && dialogTable && <><p>A comanda inteira da Mesa {dialogTable.id} será movida. Escolha uma mesa livre.</p><div className="transfer-targets">{state.tables.filter(t=>t.id!==dialogTable.id&&t.status==='livre').map(t=><button className="transfer-target" key={t.id} onClick={()=>transfer(dialogTable.id,t.id)}><span><strong>Mesa {t.id}</strong><small>Livre</small></span><b>Transferir comanda</b></button>)}</div></>}
      {dialog.kind === 'transferItems' && dialogTable && <><p>Selecione os itens lançados nesta mesa e a mesa que deve recebê-los. A mesa de destino pode estar livre ou ocupada.</p>{dialogTable.items.map(item=><label className="transfer-check" key={item.id}><input type="checkbox" checked={moveIds.includes(item.id)} onChange={e=>setMoveIds(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/>{item.quantity}× {item.name} · {money(item.quantity*item.cents)}</label>)}<label>Mesa de destino<select id="destination-table" defaultValue=""> <option value="" disabled>Escolha uma mesa</option>{state.tables.filter(t=>t.id!==dialogTable.id&&t.status!=='fechando').map(t=><option key={t.id} value={t.id}>Mesa {t.id} · {t.status==='livre'?'Livre':'Ocupada'}</option>)}</select></label><button className="primary full" disabled={!moveIds.length} onClick={()=>{const id=Number((document.getElementById('destination-table') as HTMLSelectElement)?.value);if(id)moveItems(dialogTable.id,id)}}>Transferir itens selecionados</button></>}
      {dialog.kind === 'remove' && dialogTable && dialog.item && <><p>Remover <strong>{dialog.item.quantity}× {dialog.item.name}</strong> da Mesa {dialogTable.id}? A ação ficará registrada no histórico.</p><button className="primary full" onClick={()=>deleteItem(dialogTable,dialog.item!)}>Confirmar remoção</button></>}
      {dialog.kind === 'edit' && !dialog.item && <div className="list">{dialogTable?.items.map(item => <button className="outline" key={item.id} onClick={() => setDialog({...dialog,item})}>{item.quantity}× {item.name}</button>)}</div>}
      {(dialog.kind === 'item' || (dialog.kind === 'edit' && dialog.item)) && <><form onSubmit={submitItem}><label>Produto<select name="product" defaultValue={dialog.item?.product ?? state.catalog[0]?.id}>{(dialog.item ? productsForCategory(dialog.item.category ?? state.catalog.find(p=>p.id===dialog.item?.product)?.category ?? '',state.catalog) : state.catalog).map(p => <option key={p.id} value={p.id}>{p.category} · {p.name} · {money(p.cents)}</option>)}</select></label>{dialog.kind==='item'&&<label>Garçom que lançou<input name="server" defaultValue={dialogTable?.waiter||'Carlos'} required/></label>}<label>Quantidade<input name="quantity" type="number" min="1" max="999" required defaultValue={dialog.item?.quantity ?? 1}/></label><p className="muted">{dialog.item ? 'As alternativas ficam limitadas à categoria original.' : 'Promoções vigentes são aplicadas aos itens do cardápio.'} Preços já lançados são preservados ao alterar só a quantidade.</p><button className="primary full">{dialog.item ? 'Salvar correção' : 'Adicionar à mesa'}</button></form>{dialog.kind==='item'&&<button className="outline full" onClick={()=>setDialog({kind:'custom',table:dialog.table})}>Lançar item avulso</button>}</>}
      {dialog.kind==='custom'&&<form onSubmit={submitCustomItem}><label>Nome do item<input name="name" required autoFocus/></label><label>Categoria<select name="category" defaultValue={state.catalog[0]?.category}>{[...new Set(state.catalog.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select></label><label>Preço unitário (R$)<input name="price" type="number" min="0.01" step="0.01" required/></label><label>Garçom que lançou<input name="server" defaultValue={dialogTable?.waiter||'Carlos'} required/></label><label>Quantidade<input name="quantity" type="number" min="1" max="999" defaultValue="1" required/></label><p className="muted">Item avulso desta conta; não será cadastrado permanentemente no cardápio.</p><button className="primary full">Adicionar à mesa</button></form>}
      {dialog.kind === 'pay' && dialogTable && (
        <PaymentDialog
          table={dialogTable}
          onSettle={(payments, freedTable) => {
            setState(s => ({
              ...s,
              tables: s.tables.map(t => t.id === freedTable.id ? freedTable : t),
              payments: [...payments, ...s.payments],
            }))
            setSelected(freedTable.id)
            const methodsUsed = [...new Set(payments.map(p => p.method))].join(', ')
            setNotice(`Pagamento (${methodsUsed}) registrado com sucesso. Mesa ${freedTable.id} liberada.`)
            close()
          }}
        />
      )}
      {dialog.kind === 'receipt' && dialogTable && <><p>Mesa {dialogTable.id} · Consumo atual</p>{dialogTable.items.map(item => <div className="list-row" key={item.id}><span>{item.quantity}× {item.name}</span><strong>{money(item.quantity * item.cents)}</strong></div>)}<div className="total"><strong>Total</strong><b>{money(total(dialogTable.items))}</b></div></>}
      {dialog.kind === 'history' && <ul className="events">{(dialogTable?.history.length ? dialogTable.history : ['Nenhum evento registrado.']).map((v,i) => <li key={i}>{v}</li>)}</ul>}
      {dialog.kind === 'notices' && <ul className="events">{(state.notices.length ? state.notices : ['Nenhuma correção registrada.']).map((v,i) => <li key={i}>{v}</li>)}</ul>}
      {dialog.kind === 'promotion' && <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const product=Number(data.get('product')); const cents=Math.round(Number(data.get('price'))*100); const days=data.getAll('day').map(Number); const date=String(data.get('date')); const entry=state.catalog.find(p=>p.id===product); if (!entry||cents<1 || cents>=entry.cents || (!days.length && !date)) {setNotice('Informe um preço abaixo do normal e uma data ou dias da semana.');return} setState(s=>({...s,promotions:[...s.promotions,{id:crypto.randomUUID(),product,cents,days,date}]})); close(); setNotice('Promoção programada.'); }}><label>Produto<select name="product" defaultValue={3}>{state.catalog.map(p => <option key={p.id} value={p.id}>{p.name} · {money(p.cents)}</option>)}</select></label><label>Preço promocional (R$)<input type="number" name="price" min="0.01" step="0.01" required placeholder="35,00"/></label><label>Data avulsa<input type="date" name="date" defaultValue={localDate(now)}/></label><fieldset><legend>Recorrência semanal (opcional, substitui a data)</legend><div className="week">{weekdays.map((d,i) => <label key={d}><input type="checkbox" name="day" value={i}/>{d}</label>)}</div></fieldset><button className="primary full">Salvar promoção</button></form>}
    </Modal>}
  </div>
}


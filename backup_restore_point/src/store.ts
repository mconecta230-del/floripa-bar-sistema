import { catalog, localDate, type Table, type Promotion, type Payment, type Product } from './domain.ts'

export type State = { tables: Table[]; promotions: Promotion[]; payments: Payment[]; notices: string[]; catalog:Product[]; catalogVersion:number }
const occupied = [3, 5, 7, 12, 15, 20, 24, 27, 29, 30]
const seed = (): State => ({
  tables: Array.from({ length: 30 }, (_, i): Table => {
    const id = i + 1
    const status = [10, 18].includes(id) ? 'fechando' : occupied.includes(id) ? 'ocupada' : 'livre'
    const items = status === 'livre' ? [] : (id === 5 ? [catalog.find(p=>p.id===1)!, catalog.find(p=>p.id===2)!, catalog.find(p=>p.id===3)!] : [catalog.find(p=>p.id===1)!, catalog.find(p=>p.id===5)!]).map((p, j) => ({
      id: `${id}-${j}`, product: p.id, name: p.name, category:p.category, server:id%2?'Carlos':'Marina', cents: p.cents, quantity: id === 5 ? (j === 2 ? 1 : 2) : (id + j) % 3 + 1,
    }))
    return { id, status, items, waiter: status === 'livre' ? '' : id % 2 ? 'Carlos' : 'Marina', opened: status === 'livre' ? '' : '14:26', history: status === 'livre' ? [] : ['Mesa aberta • 14:26 • demonstração'] }
  }),
  promotions: [{ id: 'demo', product: 3, cents: 3500, days: [], date: localDate(new Date()) }],
  payments: [], notices: [], catalog:catalog.map(p=>({...p})), catalogVersion:2,
})
const key = 'floripa-bar-demo-v1'
export const demoRepository = {
  load(): State {
    try { const raw = localStorage.getItem(key); if (raw) { const state=JSON.parse(raw) as State; if(state.catalogVersion===3)return state; const old=state.catalog||[]; const legacyNames=new Set(['Cerveja Original 600 ml','Copo (unidade)','Camarão M','Camarão G','Porção de fritas']); const base=state.catalogVersion===2?old:catalog.map(p=>({...p})); const extra=state.catalogVersion===2?old.filter(p=>p.id>138):old.filter(p=>!legacyNames.has(p.name)).map((p,i)=>({...p,id:Math.max(...catalog.map(c=>c.id))+i+1})); const tables=state.tables.map(table=>({...table,items:table.items.map((item,index)=>{if(item.id!==`${table.id}-${index}`)return item;const product=catalog.find(p=>p.id===item.product);return product?{...item,name:product.name,category:product.category,cents:product.cents,server:item.server||table.waiter}:item})})); return {...state,tables,catalog:[...base,...extra],catalogVersion:3} } } catch { /* storage unavailable */ }
    return seed()
  },
  save(state: State) { localStorage.setItem(key, JSON.stringify(state)) },
}

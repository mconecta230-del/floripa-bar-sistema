import test from 'node:test'
import assert from 'node:assert/strict'
import * as domain from '../src/domain.ts'
import { demoRepository } from '../src/store.ts'
const { changeItem, makeItem, settle, total, catalog } = domain
const product = name => catalog.find(p => p.name === name)

test('promotion expires without changing a registered price', () => {
  const shrimp = product('CAMARÃO AMILANESA M')
  const offers = [{id:'p', product:shrimp.id, cents:3500, days:[], date:'2026-11-07'}]
  const registered = makeItem(shrimp.id, 2, offers, new Date(2026,10,7,23))
  assert.equal(total([registered]), 7000)
  assert.equal(makeItem(shrimp.id, 1, offers, new Date(2026,10,8)).cents, 6500)
  assert.equal(registered.cents, 3500)
})
test('correction replaces one line, records the operator and settles the new total', () => {
  const now = new Date(2026,10,7)
  const old = makeItem(product('CAMARÃO AMILANESA M').id, 1, [], now)
  const table = { id:5, status:'ocupada', waiter:'Carlos', opened:'14:26', items:[old], history:[] }
  const next = changeItem(table, makeItem(product('CAMARÃO AMILANESA G').id, 1, [], now), old.id, 'Gerente', '15:00')
  assert.equal(next.items.length, 1)
  assert.match(next.history[0], /Gerente.*15:00/)
  assert.throws(() => settle(next, 'Pix', '15:01'))
  const result = settle({...next,status:'fechando'}, 'Pix', '15:01')
  assert.equal(result.payment.cents, 11000)
  assert.equal(result.table.status, 'livre')
  assert.equal(result.table.items.length, 0)
  assert.deepEqual(result.payment.items, next.items)
  next.items[0].cents = 0
  assert.equal(result.payment.items[0].cents, 11000)
})

test('transfers an occupied table into a free table and records both histories', () => {
  const item = { id: 'item-a', product: 3, name: 'Camarão M', quantity: 2, cents: 3500 }
  const tables = [
    { id: 1, status: 'ocupada', waiter: 'Carlos', opened: '14:00', items: [item], history: [] },
    { id: 2, status: 'livre', waiter: '', opened: '', items: [], history: [] },
  ]
  const result = domain.transferTable(tables, 1, 2, 'Gerente', '15:00')
  assert.equal(result[0].status, 'livre')
  assert.deepEqual(result[0].items, [])
  assert.equal(result[1].status, 'ocupada')
  assert.deepEqual(result[1].items, [item])
  assert.equal(result[1].items[0].id, 'item-a')
  assert.equal(result[1].waiter, 'Carlos')
  assert.match(result[0].history[0], /Mesa 2/)
  assert.match(result[1].history[0], /Mesa 1/)
  assert.deepEqual(tables[0].items, [item])
  item.cents = 0
  assert.equal(result[1].items[0].cents, 3500)
})

test('rejects transferring an entire table into an occupied table', () => {
  const sourceItem = { id: 'source-item', product: 3, name: 'Camarão M', quantity: 1, cents: 3500 }
  const targetItem = { id: 'target-item', product: 1, name: 'Cerveja', quantity: 2, cents: 1490 }
  const tables = [
    { id: 1, status: 'ocupada', waiter: 'Carlos', opened: '14:00', items: [sourceItem], history: [] },
    { id: 2, status: 'ocupada', waiter: 'Marina', opened: '13:30', items: [targetItem], history: [] },
  ]
  assert.throws(() => domain.transferTable(tables, 1, 2, 'Gerente', '15:00'), /livre/)
  assert.equal(tables[0].items[0].id, 'source-item')
})

test('rejects invalid table transfer without changing input tables', () => {
  const tables = [
    { id: 1, status: 'livre', waiter: '', opened: '', items: [], history: [] },
    { id: 2, status: 'fechando', waiter: 'Marina', opened: '14:00', items: [{ id: 'x', product: 1, name: 'Cerveja', quantity: 1, cents: 1490 }], history: [] },
    { id: 3, status: 'ocupada', waiter: 'Carlos', opened: '14:30', items: [{ id: 'y', product: 1, name: 'Cerveja', quantity: 1, cents: 1490 }], history: [] },
  ]
  const before = structuredClone(tables)
  assert.throws(() => domain.transferTable(tables, 1, 1, 'Gerente', '15:00'), /diferentes/)
  assert.throws(() => domain.transferTable(tables, 1, 3, 'Gerente', '15:00'), /ocupada/)
  assert.throws(() => domain.transferTable(tables, 2, 1, 'Gerente', '15:00'), /fechamento/)
  assert.deepEqual(tables, before)
})

test('requires a recorded external payment method before freeing the table', () => {
  const table = { id: 4, status: 'fechando', waiter: 'Carlos', opened: '14:00', items: [{ id: 'item', product: 1, name: 'Cerveja', quantity: 1, cents: 1490 }], history: [] }
  assert.throws(() => domain.settle(table, '', '15:00'), /forma de pagamento/i)
  assert.throws(() => domain.settle(table, 'Boleto', '15:00'), /forma de pagamento/i)
  assert.equal(table.status, 'fechando')
  const result = domain.settle(table, 'Pix', '15:01')
  assert.equal(result.table.status, 'livre')
  assert.equal(result.payment.method, 'Pix')
  assert.match(result.table.history[0], /Forma registrada: Pix/)
})

test('editing quantity preserves its price and same-category replacement applies promotion', () => {
  const now = new Date(2026, 10, 7, 15)
  const beer = product('ORIGINAL 600 ML')
  const shrimp = product('CAMARÃO AMILANESA M')
  const old = { id: 'old', product: beer.id, category: beer.category, name: beer.name, quantity: 1, cents: 1290 }
  const table = { id: 5, status: 'ocupada', waiter: 'Carlos', opened: '14:00', items: [old], history: [] }
  const offers = [{ id: 'promo', product: shrimp.id, cents: 3500, days: [], date: '2026-11-07' }]
  const quantityOnly = domain.editItem(table, old, beer.id, 3, offers, 'Gerente', '15:01', now)
  assert.equal(quantityOnly.items[0].quantity, 3)
  assert.equal(quantityOnly.items[0].cents, 1290)
  const shrimpOld = {...old,product:shrimp.id,category:shrimp.category,name:shrimp.name}
  const shrimpChanged = domain.editItem({...table,items:[shrimpOld]}, shrimpOld, product('CAMARÃO AMILANESA G').id, 1, offers, 'Gerente', '15:03', now)
  assert.equal(shrimpChanged.items[0].name, 'CAMARÃO AMILANESA G')
})

test('catalog products are grouped by category for item correction', () => {
  const beers = domain.productsForCategory('CERVEJAS')
  assert.ok(beers.length >= 1)
  assert.ok(beers.every(p => p.category === 'CERVEJAS'))
  assert.ok(!beers.some(p => p.category === 'PORÇÕES'))
  const beer = product('ORIGINAL 600 ML')
  const shrimp = product('CAMARÃO AMILANESA M')
  const table = { id: 5, status: 'ocupada', waiter: 'Carlos', opened: '14:00', items: [{ id:'b', product:beer.id, name:beer.name, category:beer.category, quantity:1, cents:beer.cents }], history:[] }
  assert.throws(() => domain.editItem(table, table.items[0], shrimp.id, 1, [], 'Gerente', '15:00', new Date()), /categoria/i)
})

test('PDF catalog imports 138 products across the 10 documented categories', () => {
  assert.equal(catalog.length, 138)
  assert.deepEqual(Object.fromEntries(domain.categories.map(c=>[c,catalog.filter(p=>p.category===c).length])), {
    CERVEJAS:12,'FRUTOS DO MAR':24,'PORÇÕES':23,LANCHES:14,REFRIGERANTE:17,ÁGUAS:5,SUCOS:9,'DRINKS DOSES':13,CAIPIRINHAS:9,ADICIONAIS:12,
  })
  assert.equal(product('ORIGINAL 600 ML').cents,1600)
  assert.equal(product('CAMARÃO AMILANESA G').cents,11000)
})

test('catalog migration refreshes untouched demo rows and preserves edited order snapshots', () => {
  const oldStorage=globalThis.localStorage
  const legacy={tables:[{id:5,status:'ocupada',waiter:'Carlos',opened:'14:26',history:['Mesa aberta • demonstração'],items:[
    {id:'5-0',product:1,name:'Cerveja Original 600 ml',quantity:2,cents:1490},
    {id:'edited-line',product:1,name:'Original 600 ML',quantity:1,cents:1490},
  ]}],catalog:[
    {id:1,name:'Cerveja Original 600 ml',cents:1490},{id:2,name:'Copo (unidade)',cents:300},{id:3,name:'Camarão M',cents:6500},{id:4,name:'Camarão G',cents:8910},{id:5,name:'Porção de fritas',cents:3200},
  ],promotions:[],payments:[],notices:[]}
  globalThis.localStorage={getItem:()=>JSON.stringify(legacy),setItem:()=>{}}
  try {
    const migrated=demoRepository.load()
    assert.equal(migrated.catalog.length,138)
    assert.equal(migrated.tables[0].items[0].name,'ORIGINAL 600 ML')
    assert.equal(migrated.tables[0].items[0].cents,1600)
    assert.equal(migrated.tables[0].items[1].cents,1490)
  } finally { if(oldStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage=oldStorage }
})

test('adds an ad hoc item with its own name, category and unit price', () => {
  const extra = domain.makeCustomItem('Energético novo', 'REFRIGERANTE', 1250, 2)
  assert.equal(extra.name, 'Energético novo')
  assert.equal(extra.category, 'REFRIGERANTE')
  assert.equal(extra.cents, 1250)
  assert.equal(total([extra]), 2500)
  assert.throws(() => domain.makeCustomItem(' ', 'REFRIGERANTE', 1250, 1), /nome/i)
})

test('removes a mistakenly launched line and records it without changing the input', () => {
  const beer = { id:'beer', product:1, name:'ORIGINAL 600 ML', category:'CERVEJAS', quantity:2, cents:1600 }
  const fries = { id:'fries', product:2, name:'FRITAS M', category:'PORÇÕES', quantity:1, cents:2500 }
  const table = { id:5, status:'ocupada', waiter:'Carlos', opened:'14:00', items:[beer,fries], history:[] }
  const next = domain.removeItem(table, 'beer', 'Gerente', '15:00')
  assert.deepEqual(next.items, [fries])
  assert.equal(total(next.items), 2500)
  assert.match(next.history[0], /Removeu 2× ORIGINAL 600 ML/)
  assert.equal(table.items.length, 2)
  assert.throws(() => domain.removeItem({...table,status:'fechando'}, 'beer', 'Gerente', '15:01'), /reabra/i)
})

test('transfers selected item lines between tables and frees an emptied source', () => {
  const beer = { id:'beer', product:1, name:'ORIGINAL 600 ML', category:'CERVEJAS', quantity:1, cents:1600 }
  const fries = { id:'fries', product:2, name:'FRITAS M', category:'PORÇÕES', quantity:1, cents:2500 }
  const target = { id:'target', product:3, name:'COCA LATA', category:'REFRIGERANTE', quantity:1, cents:600 }
  const tables = [
    { id:15, status:'ocupada', waiter:'Carlos', opened:'14:00', items:[beer,fries], history:[] },
    { id:7, status:'ocupada', waiter:'Marina', opened:'13:30', items:[target], history:[] },
  ]
  const partial = domain.transferItems(tables, 15, 7, ['beer'], 'Gerente', '15:00')
  assert.deepEqual(partial[0].items, [fries])
  assert.equal(partial[1].items.length, 2)
  assert.equal(total(partial[1].items), 2200)
  assert.match(partial[0].history[0], /Mesa 7/)
  assert.match(partial[1].history[0], /Mesa 15/)
  const final = domain.transferItems(partial, 15, 7, ['fries'], 'Gerente', '15:01')
  assert.equal(final[0].status, 'livre')
  assert.deepEqual(final[0].items, [])
})

test('settles table with multiple split payment methods (Pix + Dinheiro)', () => {
  const table = {
    id: 3,
    status: 'fechando',
    waiter: 'Carlos',
    opened: '14:00',
    items: [{ id: 'i1', product: 1, name: 'ORIGINAL 600 ML', quantity: 2, cents: 1000 }],
    history: []
  }

  assert.throws(() => domain.settleSplit(table, [{ method: 'Pix', cents: 500 }], '15:00'), /insuficiente/i)
  assert.throws(() => domain.settleSplit(table, [{ method: 'Boleto', cents: 2000 }], '15:00'), /forma de pagamento/i)

  const result = domain.settleSplit(table, [
    { method: 'Pix', cents: 1200 },
    { method: 'Dinheiro', cents: 800 }
  ], '15:05')

  assert.equal(result.table.status, 'livre')
  assert.equal(result.payments.length, 2)
  assert.equal(result.payments[0].method, 'Pix')
  assert.equal(result.payments[0].cents, 1200)
  assert.equal(result.payments[1].method, 'Dinheiro')
  assert.equal(result.payments[1].cents, 800)
  assert.match(result.table.history[0], /Forma registrada: Pix/)
  assert.match(result.table.history[0], /Dinheiro/)
})

test('existing local data gains tables 31 to 40 without changing existing tables', () => {
  const saved = {tables: [{id: 5, status:'ocupada', waiter:'Ana', opened:'10:00', items:[], history:[]}], catalogVersion:4, waiters:[], catalog:[], promotions:[], payments:[], notices:[]}
  globalThis.localStorage = { getItem: () => JSON.stringify(saved), setItem: () => {} }
  const loaded = demoRepository.load()
  assert.equal(loaded.tables.length, 40)
  assert.equal(loaded.tables.find(t => t.id === 5).waiter, 'Ana')
  assert.equal(loaded.tables.find(t => t.id === 40).status, 'livre')
})

test('demo login accepts only the requested test credentials', async () => {
  const { isDemoLogin } = await import('../src/demo-login.ts')
  assert.equal(isDemoLogin('admin', '123'), true)
  assert.equal(isDemoLogin('admin', 'wrong'), false)
  assert.equal(isDemoLogin('garcom', '123'), false)
})

test('waiter order adds all selected products to the chosen table', async () => {
  const { submitWaiterOrder } = await import('../src/waiter-order.ts')
  const table = { id: 1, status: 'livre', waiter: '', opened: '', items: [], history: [] }
  const result = submitWaiterOrder(table, [{product:catalog[0].id, quantity:2}, {product:catalog[1].id, quantity:1}], [], catalog, 'Garçom 1', new Date(2026,10,13))
  assert.equal(result.status, 'ocupada')
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0].quantity, 2)
  assert.equal(result.items[0].server, 'Garçom 1')
  assert.throws(() => submitWaiterOrder(table, [], [], catalog, 'Garçom 1', new Date()))
  assert.throws(() => submitWaiterOrder({...table,status:'fechando'}, [{product:catalog[0].id,quantity:1}], [], catalog, 'Garçom 1', new Date()))
})

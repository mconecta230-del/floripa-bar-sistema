import { useState, type FormEvent } from 'react'
import { App } from './App'
import { isDemoLogin, isDemoWaiterLogin } from './demo-login'
import { WaiterView } from './WaiterView'

export function DemoLogin() {
  const [loggedIn, setLoggedIn] = useState<'admin' | 'waiter' | null>(null)
  const [error, setError] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (isDemoLogin(String(fields.get('user') || ''), String(fields.get('password') || ''))) {
      setLoggedIn('admin')
      setError(false)
    } else if (isDemoWaiterLogin(String(fields.get('user') || ''), String(fields.get('password') || ''))) { setLoggedIn('waiter'); setError(false) } else setError(true)
  }
  if (loggedIn === 'admin') return <App />
  if (loggedIn === 'waiter') return <WaiterView logout={() => setLoggedIn(null)} />
  return <main className="demo-login"><form onSubmit={submit} className="panel">
    <h1>Floripa Bar</h1>
    <p>Acesso de demonstração neste navegador.</p>
    <p>Este acesso é apenas para testes e não protege dados nem sincroniza aparelhos.</p>
    <label>Usuário<input name="user" autoComplete="username" required /></label>
    <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p role="alert">Usuário ou senha incorretos.</p>}
    <button className="primary" type="submit">Entrar</button>
  </form></main>
}

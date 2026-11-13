// Local demonstration only. This does not authenticate against Supabase.
export function isDemoLogin(user: string, password: string): boolean {
  return user === 'admin' && password === '123'
}

export function isDemoWaiterLogin(user: string, password: string): boolean {
  return user === 'garcom' && password === '123'
}

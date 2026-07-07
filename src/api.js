const SUPABASE_URL = 'https://aleebzkvwychuafczvcn.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZWViemt2d3ljaHVhZmN6dmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzE2NzcsImV4cCI6MjA5ODU0NzY3N30.5OzV2IEfPCP_43AHmb85elkK8oVgI3ixtlpLZTGhTVU'

const TOKEN_KEY = 'fs-panel-token'
const LOGIN_KEY = 'fs-panel-login'

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) || '' },
  get login() { return localStorage.getItem(LOGIN_KEY) || '' },
  set({ token, login }) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(LOGIN_KEY, login)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LOGIN_KEY)
  },
}

async function call(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      ...(session.token ? { 'x-admin-token': session.token } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && fn === 'admin-api') {
    session.clear()
    window.dispatchEvent(new Event('fs-logout'))
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(data.error || `http_${res.status}`)
  return data
}

export const api = {
  login: (login, password) => call('admin-auth', { action: 'login', login, password }),
  logout: () => call('admin-auth', { action: 'logout', token: session.token }).catch(() => {}),
  check: () => call('admin-auth', { action: 'check', token: session.token }),

  listBookings: () => call('admin-api', { action: 'listBookings' }),
  decideBooking: (id, status, note = '', customTime, carId) =>
    call('admin-api', {
      action: 'decideBooking',
      id,
      status,
      note,
      ...(customTime !== undefined ? { customTime } : {}),
      ...(carId !== undefined ? { carId } : {}),
    }),
  deleteBooking: (id) => call('admin-api', { action: 'deleteBooking', id }),

  listEvents: () => call('admin-api', { action: 'listEvents' }),
  saveEvent: (ev) => call('admin-api', { action: 'saveEvent', ...ev }),
  deleteEvent: (id) => call('admin-api', { action: 'deleteEvent', id }),

  listCars: () => call('admin-api', { action: 'listCars' }),
  saveCar: (car) => call('admin-api', { action: 'saveCar', ...car }),
  deleteCar: (id) => call('admin-api', { action: 'deleteCar', id }),

  getSettings: () => call('admin-api', { action: 'getSettings' }),
  saveSettings: (entries) => call('admin-api', { action: 'saveSettings', entries }),
  testEmail: (to) => call('admin-api', { action: 'testEmail', to }),

  listAdmins: () => call('admin-api', { action: 'listAdmins' }),
  createAdmin: (login, password) => call('admin-api', { action: 'createAdmin', login, password }),
  deleteAdmin: (id) => call('admin-api', { action: 'deleteAdmin', id }),
}

export const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

export function plDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`
}

export function plDateTime(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  return `${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]} ${dt.getFullYear()}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

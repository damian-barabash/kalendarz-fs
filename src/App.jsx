import React, { useCallback, useEffect, useState } from 'react'
import { api, session } from './api.js'
import { ToastProvider } from './ui.jsx'
import Login from './pages/Login.jsx'
import Bookings from './pages/Bookings.jsx'
import Events from './pages/Events.jsx'
import Cars from './pages/Cars.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { id: 'rezerwacje', label: 'Rezerwacje' },
  { id: 'terminy', label: 'Terminy' },
  { id: 'samochody', label: 'Samochody' },
  { id: 'ustawienia', label: 'Ustawienia' },
]

export default function App() {
  const [logged, setLogged] = useState(!!session.token)
  const [tab, setTab] = useState('rezerwacje')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const onLogout = () => setLogged(false)
    window.addEventListener('fs-logout', onLogout)
    return () => window.removeEventListener('fs-logout', onLogout)
  }, [])

  // walidacja sesji w tle — bez blokowania UI (optymistycznie pokazujemy panel)
  useEffect(() => {
    if (!logged) return
    api.check().catch(() => {})
  }, [logged])

  const logout = useCallback(() => {
    api.logout()
    session.clear()
    setLogged(false)
  }, [])

  if (!logged) return <ToastProvider><Login onLogin={() => setLogged(true)} /></ToastProvider>

  return (
    <ToastProvider>
      <header className="hdr">
        <div className="hdr-logo"><img src="/logo.png" alt="Fastline Supercars" /></div>
        <nav className="hdr-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'rezerwacje' && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="hdr-user">
          <span>Zalogowano: <b>{session.login}</b></span>
          <button className="btn ghost sm" onClick={logout}>Wyloguj</button>
        </div>
      </header>
      <main className="page">
        {tab === 'rezerwacje' && <Bookings onPendingCount={setPendingCount} />}
        {tab === 'terminy' && <Events />}
        {tab === 'samochody' && <Cars />}
        {tab === 'ustawienia' && <Settings />}
      </main>
    </ToastProvider>
  )
}

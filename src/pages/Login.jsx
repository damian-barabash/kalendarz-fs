import React, { useState } from 'react'
import { api, session } from '../api.js'

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!login || !password || busy) return
    setBusy(true)
    setErr('')
    try {
      const res = await api.login(login.trim(), password)
      session.set({ token: res.token, login: res.login })
      onLogin()
    } catch (ex) {
      setErr(ex.message === 'invalid_credentials'
        ? 'Nieprawidłowy login lub hasło.'
        : 'Błąd połączenia. Spróbuj ponownie.')
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        <div className="login-logo"><img src="/logo.png" alt="Fastline Supercars" /></div>
        {err && <div className="login-err">{err}</div>}
        <div className="field">
          <label>Login</label>
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label>Hasło</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={busy}>
          {busy ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  )
}

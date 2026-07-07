import React, { useEffect, useState } from 'react'
import { api, session } from '../api.js'
import { Confirm, useToast } from '../ui.jsx'

const PLACEHOLDERS = '{{imie}}, {{tytul}}, {{tor}}, {{data}}, {{godzina}}, {{godzina_linia}}, {{samochod}}, {{samochod_linia}}, {{okrazenia}}, {{okrazenia_linia}}, {{uwaga}}'

export default function Settings() {
  const [s, setS] = useState(null)
  const [admins, setAdmins] = useState(null)
  const [newAdmin, setNewAdmin] = useState({ login: '', password: '' })
  const [delAdmin, setDelAdmin] = useState(null)
  const [testTo, setTestTo] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.getSettings().then((r) => setS(r.settings)).catch(() => toast('Błąd pobierania ustawień.', 'err'))
    api.listAdmins().then((r) => setAdmins(r.admins)).catch(() => {})
  }, [])

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }))

  const save = () => {
    setBusy(true)
    api.saveSettings(s)
      .then(() => toast('Ustawienia zapisane.', 'ok'))
      .catch(() => toast('Błąd zapisu.', 'err'))
      .finally(() => setBusy(false))
  }

  const sendTest = () => {
    if (!testTo.trim()) return
    toast(`Wysyłam test na ${testTo}…`)
    api.testEmail(testTo.trim())
      .then((r) => toast(r.ok ? 'Test wysłany — sprawdź skrzynkę.' : `Błąd wysyłki: ${r.emailError}`, r.ok ? 'ok' : 'err'))
      .catch(() => toast('Błąd wysyłki.', 'err'))
  }

  const addAdmin = () => {
    const { login, password } = newAdmin
    if (login.trim().length < 3 || password.length < 8) {
      toast('Login min. 3 znaki, hasło min. 8 znaków.', 'err')
      return
    }
    // optymistycznie
    const optimistic = { id: `temp-${Date.now()}`, login: login.trim(), created_at: new Date().toISOString() }
    const prev = admins
    setAdmins([...(admins || []), optimistic])
    setNewAdmin({ login: '', password: '' })
    api.createAdmin(login.trim(), password)
      .then(() => { toast('Administrator dodany.', 'ok'); return api.listAdmins() })
      .then((r) => setAdmins(r.admins))
      .catch((e) => {
        setAdmins(prev)
        toast(e.message === 'login_taken' ? 'Ten login jest już zajęty.' : 'Błąd — nie dodano.', 'err')
      })
  }

  const removeAdmin = (a) => {
    const prev = admins
    setAdmins(admins.filter((x) => x.id !== a.id))
    setDelAdmin(null)
    api.deleteAdmin(a.id).catch((e) => {
      setAdmins(prev)
      toast(e.message === 'last_admin' ? 'Nie można usunąć ostatniego administratora.'
        : e.message === 'cannot_delete_self' ? 'Nie możesz usunąć samego siebie.'
        : 'Błąd usuwania.', 'err')
    })
  }

  if (!s) return <><div className="page-h"><h1>Ustawienia</h1></div><div className="spin" /></>

  return (
    <>
      <div className="page-h">
        <h1>Ustawienia</h1>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz zmiany'}</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>E-mail potwierdzenia rezerwacji</h3>
        <div className="field">
          <label>Temat</label>
          <input value={s.email_confirm_subject || ''} onChange={(e) => set('email_confirm_subject', e.target.value)} />
        </div>
        <div className="field">
          <label>Treść</label>
          <textarea rows={8} value={s.email_confirm_body || ''} onChange={(e) => set('email_confirm_body', e.target.value)} />
          <div className="hint">Dostępne pola: {PLACEHOLDERS}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>E-mail odrzucenia rezerwacji</h3>
        <div className="field">
          <label>Temat</label>
          <input value={s.email_reject_subject || ''} onChange={(e) => set('email_reject_subject', e.target.value)} />
        </div>
        <div className="field">
          <label>Treść</label>
          <textarea rows={8} value={s.email_reject_body || ''} onChange={(e) => set('email_reject_body', e.target.value)} />
          <div className="hint">Pole {'{{uwaga}}'} = uwaga wpisana przy odrzuceniu.</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Kalendarz na stronie</h3>
        <div className="field">
          <label>Tekst w oknie rezerwacji</label>
          <textarea rows={4} value={s.public_booking_popup_text || ''} onChange={(e) => set('public_booking_popup_text', e.target.value)} />
          <div className="hint">Fraza „przejdź do sklepu" automatycznie staje się linkiem do sklepu.</div>
        </div>
        <div className="field">
          <label>Link do sklepu</label>
          <input value={s.public_shop_url || ''} onChange={(e) => set('public_shop_url', e.target.value)} />
        </div>
        <div className="field">
          <label>Nadawca e-maili</label>
          <input value={s.email_from || ''} onChange={(e) => set('email_from', e.target.value)} />
          <div className="hint">Format: Nazwa &lt;rezerwacja@fastlinesupercars.pl&gt;. Domena musi być zweryfikowana w Resend.</div>
        </div>
        <div className="field">
          <label>Powiadomienia o nowych rezerwacjach</label>
          <input placeholder="adres@email.pl" value={s.notify_email || ''} onChange={(e) => set('notify_email', e.target.value)} />
          <div className="hint">Na ten adres przyjdzie e-mail przy każdej nowej rezerwacji. Zostaw puste, aby wyłączyć powiadomienia.</div>
        </div>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '9px 12px', borderRadius: 3 }}
            placeholder="adres@do-testu.pl"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button className="btn ghost sm" onClick={sendTest}>Wyślij e-mail testowy</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Administratorzy</h3>
        {!admins && <div className="spin" />}
        {admins && admins.map((a) => (
          <div className="row" key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <b className="grow">{a.login}{a.login === session.login && <span className="muted small"> (ty)</span>}</b>
            {a.login !== session.login && (
              <button className="btn grey sm" onClick={() => setDelAdmin(a)}>Usuń</button>
            )}
          </div>
        ))}
        <div className="row" style={{ marginTop: 14 }}>
          <div className="field grow" style={{ marginBottom: 0 }}>
            <label>Login</label>
            <input value={newAdmin.login} onChange={(e) => setNewAdmin({ ...newAdmin, login: e.target.value })} />
          </div>
          <div className="field grow" style={{ marginBottom: 0 }}>
            <label>Hasło (min. 8 znaków)</label>
            <input type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
          </div>
          <button className="btn sm" style={{ alignSelf: 'flex-end', padding: '10px 16px' }} onClick={addAdmin}>Dodaj</button>
        </div>
      </div>

      {delAdmin && (
        <Confirm
          text={`Usunąć administratora „${delAdmin.login}"? Straci dostęp do panelu.`}
          onYes={() => removeAdmin(delAdmin)}
          onNo={() => setDelAdmin(null)}
        />
      )}
    </>
  )
}

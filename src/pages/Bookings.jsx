import React, { useEffect, useMemo, useState } from 'react'
import { api, plDate, plDateTime } from '../api.js'
import { Modal, Confirm, useToast } from '../ui.jsx'

let cache = null // instant render przy powrocie na zakładkę

const FILTERS = [
  { id: 'pending', label: 'Oczekujące' },
  { id: 'confirmed', label: 'Potwierdzone' },
  { id: 'rejected', label: 'Odrzucone' },
  { id: 'all', label: 'Wszystkie' },
]

export default function Bookings({ onPendingCount }) {
  const [bookings, setBookings] = useState(cache)
  const [filter, setFilter] = useState('pending')
  const [reject, setReject] = useState(null) // booking do odrzucenia
  const [rejectNote, setRejectNote] = useState('')
  const [del, setDel] = useState(null)
  const toast = useToast()

  const reload = () =>
    api.listBookings().then((r) => {
      cache = r.bookings
      setBookings(r.bookings)
    }).catch(() => toast('Nie udało się pobrać rezerwacji.', 'err'))

  useEffect(() => { reload() }, [])

  useEffect(() => {
    onPendingCount((bookings || []).filter((b) => b.status === 'pending').length)
  }, [bookings, onPendingCount])

  const shown = useMemo(() => {
    if (!bookings) return null
    return filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)
  }, [bookings, filter])

  // optymistycznie: status zmienia się od razu, e-mail leci w tle
  const decide = (b, status, note = '') => {
    const prev = bookings
    setBookings(bookings.map((x) => (x.id === b.id ? { ...x, status, admin_note: note } : x)))
    cache = null
    api.decideBooking(b.id, status, note)
      .then((r) => {
        if (r.emailSent) {
          toast(status === 'confirmed'
            ? `Potwierdzono — e-mail wysłany do ${b.email}`
            : `Odrzucono — e-mail wysłany do ${b.email}`, 'ok')
        } else {
          toast(`Status zapisany, ale e-mail NIE został wysłany (${r.emailError || 'błąd'})`, 'err')
        }
        reload()
      })
      .catch(() => {
        setBookings(prev)
        toast('Błąd — zmiana cofnięta. Spróbuj ponownie.', 'err')
      })
  }

  const remove = (b) => {
    const prev = bookings
    setBookings(bookings.filter((x) => x.id !== b.id))
    setDel(null)
    api.deleteBooking(b.id).catch(() => {
      setBookings(prev)
      toast('Nie udało się usunąć.', 'err')
    })
  }

  const counts = useMemo(() => {
    const c = { pending: 0, confirmed: 0, rejected: 0, all: (bookings || []).length }
    for (const b of bookings || []) c[b.status]++
    return c
  }, [bookings])

  return (
    <>
      <div className="page-h"><h1>Rezerwacje</h1></div>
      <p className="sub">Zgłoszenia z kalendarza na stronie. Potwierdzenie lub odrzucenie wysyła klientowi brandowany e-mail.</p>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {!shown && <div className="spin" />}

      {shown && shown.length === 0 && (
        <div className="empty">
          <b>Brak rezerwacji</b>
          {filter === 'pending' ? 'Nowe zgłoszenia pojawią się tutaj automatycznie.' : 'Nic tu jeszcze nie ma.'}
        </div>
      )}

      {shown && shown.map((b) => (
        <div className="card" key={b.id}>
          <div className="row">
            <div className="grow">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <b style={{ fontSize: 16 }}>{b.name}</b>
                <span className={`chip ${b.status}`}>
                  {b.status === 'pending' ? 'Oczekuje' : b.status === 'confirmed' ? 'Potwierdzona' : 'Odrzucona'}
                </span>
              </div>
              <div className="small" style={{ marginBottom: 4 }}>
                <a href={`mailto:${b.email}`} style={{ color: 'var(--ink)' }}>{b.email}</a>
                {' · '}
                <a href={`tel:${b.phone}`} style={{ color: 'var(--ink)' }}>{b.phone}</a>
                {b.voucher_code && <> · Voucher: <b>{b.voucher_code}</b></>}
              </div>
              <div className="small muted">
                {b.events?.title} — {b.events?.track && `${b.events.track}, `}{plDate(b.events?.event_date)}
                {b.events?.time_text && `, ${b.events.time_text}`}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Zgłoszono: {plDateTime(b.created_at)}
                {b.decided_at && <> · Decyzja: {plDateTime(b.decided_at)} ({b.decided_by})</>}
                {b.admin_note && <> · Uwaga: {b.admin_note}</>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {b.status !== 'confirmed' && (
                <button className="btn sm" onClick={() => decide(b, 'confirmed')}>Potwierdź</button>
              )}
              {b.status !== 'rejected' && (
                <button className="btn ghost sm" onClick={() => { setReject(b); setRejectNote('') }}>Odrzuć</button>
              )}
              <button className="btn grey sm" onClick={() => setDel(b)}>Usuń</button>
            </div>
          </div>
        </div>
      ))}

      {reject && (
        <Modal title="Odrzuć rezerwację" onClose={() => setReject(null)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Klient <b style={{ color: 'var(--ink)' }}>{reject.name}</b> ({reject.email}) otrzyma e-mail z informacją o odrzuceniu.
          </p>
          <div className="field">
            <label>Uwaga dla klienta (opcjonalnie — trafi do e-maila jako {'{{uwaga}}'})</label>
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              placeholder="np. Podany kod vouchera jest nieprawidłowy." />
          </div>
          <div className="modal-btns">
            <button className="btn grey" onClick={() => setReject(null)}>Anuluj</button>
            <button className="btn" onClick={() => { decide(reject, 'rejected', rejectNote.trim()); setReject(null) }}>
              Odrzuć i wyślij e-mail
            </button>
          </div>
        </Modal>
      )}

      {del && (
        <Confirm
          text={`Usunąć rezerwację „${del.name}" bezpowrotnie? E-mail NIE zostanie wysłany.`}
          onYes={() => remove(del)}
          onNo={() => setDel(null)}
        />
      )}
    </>
  )
}

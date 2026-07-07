import React, { useEffect, useMemo, useState } from 'react'
import { api, plDate, plDateTime } from '../api.js'
import { exportBookingsXlsx } from '../xlsx.js'
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
  const [dateFilter, setDateFilter] = useState('all') // event_date lub 'all'
  const [reject, setReject] = useState(null) // booking do odrzucenia
  const [rejectNote, setRejectNote] = useState('')
  const [confirm, setConfirm] = useState(null) // booking do potwierdzenia / zmiany godziny
  const [confirmTime, setConfirmTime] = useState('')
  const [confirmCar, setConfirmCar] = useState('') // car_id wybrany dla klienta
  const [exporting, setExporting] = useState(false)
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

  // daty terminów obecne w rezerwacjach (dla filtra)
  const dates = useMemo(() => {
    const seen = new Map()
    for (const b of bookings || []) {
      const d = b.events?.event_date
      if (d) seen.set(d, (seen.get(d) || 0) + 1)
    }
    return [...seen.entries()].sort((a, z) => a[0].localeCompare(z[0]))
  }, [bookings])

  const shown = useMemo(() => {
    if (!bookings) return null
    let list = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)
    if (dateFilter !== 'all') list = list.filter((b) => b.events?.event_date === dateFilter)
    return list
  }, [bookings, filter, dateFilter])

  // optymistycznie: status zmienia się od razu, e-mail leci w tle
  const decide = (b, status, note = '', customTime, carId) => {
    const prev = bookings
    let carPatch = {}
    if (carId !== undefined) {
      const cn = carId ? ((b.available_cars || []).find((c) => c.id === carId)?.name || null) : null
      carPatch = { car_id: carId || null, car_name: cn }
    }
    setBookings(bookings.map((x) => (x.id === b.id
      ? {
          ...x,
          status,
          admin_note: note,
          ...(customTime !== undefined
            ? { custom_time: customTime.trim() && customTime.trim() !== (b.events?.time_text || '').trim() ? customTime.trim() : null }
            : {}),
          ...carPatch,
        }
      : x)))
    cache = null
    api.decideBooking(b.id, status, note, customTime, carId)
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

  const openConfirm = (b) => {
    setConfirm(b)
    setConfirmTime(b.custom_time || b.events?.time_text || '')
    const avail = b.available_cars || []
    setConfirmCar(b.car_id || (avail.length === 1 ? avail[0].id : ''))
  }

  const doExport = async () => {
    if (!shown || !shown.length || exporting) return
    setExporting(true)
    try {
      await exportBookingsXlsx(shown, {
        filterLabel: FILTERS.find((f) => f.id === filter)?.label,
        dateLabel: dateFilter === 'all' ? 'Wszystkie daty' : plDate(dateFilter),
        dateSlug: dateFilter === 'all' ? 'wszystkie' : dateFilter,
      })
    } catch {
      toast('Nie udało się wygenerować pliku Excel.', 'err')
    } finally {
      setExporting(false)
    }
  }

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
        {dates.length > 0 && (
          <select
            className={`date-filter${dateFilter !== 'all' ? ' on' : ''}`}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filtr po dacie terminu"
          >
            <option value="all">Wszystkie daty</option>
            {dates.map(([d, n]) => (
              <option key={d} value={d}>{plDate(d)} ({n})</option>
            ))}
          </select>
        )}
        <button
          className="btn ghost sm"
          style={{ marginLeft: 'auto' }}
          onClick={doExport}
          disabled={!shown || !shown.length || exporting}
          title="Pobierz widoczne rezerwacje jako plik Excel"
        >
          {exporting ? 'Generowanie…' : `Pobierz Excel${shown ? ` (${shown.length})` : ''}`}
        </button>
      </div>

      {!shown && <div className="spin" />}

      {shown && shown.length === 0 && (
        <div className="empty">
          <b>Brak rezerwacji</b>
          {dateFilter !== 'all'
            ? 'Brak rezerwacji dla wybranej daty — zmień filtr.'
            : filter === 'pending' ? 'Nowe zgłoszenia pojawią się tutaj automatycznie.' : 'Nic tu jeszcze nie ma.'}
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
                {b.custom_time
                  ? <>, <b style={{ color: 'var(--warn)' }}>{b.custom_time} (godzina indywidualna)</b></>
                  : b.events?.time_text && `, ${b.events.time_text}`}
                {b.car_name && <> · Samochód: <b style={{ color: 'var(--ink)' }}>{b.car_name}</b></>}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Zgłoszono: {plDateTime(b.created_at)}
                {b.decided_at && <> · Decyzja: {plDateTime(b.decided_at)} ({b.decided_by})</>}
                {b.admin_note && <> · Uwaga: {b.admin_note}</>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {b.status !== 'confirmed' && (
                <button className="btn sm" onClick={() => openConfirm(b)}>Potwierdź</button>
              )}
              {b.status === 'confirmed' && (
                <button className="btn ghost sm" onClick={() => openConfirm(b)}>Zmień godzinę</button>
              )}
              {b.status !== 'rejected' && (
                <button className="btn ghost sm" onClick={() => { setReject(b); setRejectNote('') }}>Odrzuć</button>
              )}
              <button className="btn grey sm" onClick={() => setDel(b)}>Usuń</button>
            </div>
          </div>
        </div>
      ))}

      {confirm && (
        <Modal
          title={confirm.status === 'confirmed' ? 'Zmień godzinę rezerwacji' : 'Potwierdź rezerwację'}
          onClose={() => setConfirm(null)}
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            Sprawdź, czy wszystkie dane są poprawne — klient otrzyma e-mail
            {confirm.status === 'confirmed' ? ' z nową godziną.' : ' z potwierdzeniem.'}
          </p>
          <div className="confirm-data">
            <div><span>Klient</span><b>{confirm.name}</b></div>
            <div><span>E-mail</span><b>{confirm.email}</b></div>
            <div><span>Telefon</span><b>{confirm.phone}</b></div>
            {confirm.voucher_code && <div><span>Voucher</span><b>{confirm.voucher_code}</b></div>}
            <div><span>Termin</span><b>{confirm.events?.title} — {confirm.events?.track && `${confirm.events.track}, `}{plDate(confirm.events?.event_date)}</b></div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Samochód dla tego klienta</label>
            {(confirm.available_cars || []).length > 0 ? (
              <select value={confirmCar} onChange={(e) => setConfirmCar(e.target.value)}>
                <option value="">— bez wyboru —</option>
                {(confirm.available_cars || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <div className="hint" style={{ marginTop: 0 }}>Brak samochodów przypisanych do tego terminu — dodaj je w zakładce „Terminy”.</div>
            )}
            <div className="hint">
              Wybrany samochód trafi do e-maila klienta jako {'{{samochod}}'}.
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Godzina dla tego klienta</label>
            <input
              value={confirmTime}
              onChange={(e) => setConfirmTime(e.target.value)}
              placeholder="np. 15:00"
            />
            <div className="hint">
              Godzina terminu: {confirm.events?.time_text || '—'}. Zmiana dotyczy tylko tej rezerwacji i trafi do e-maila jako {'{{godzina}}'}.
            </div>
          </div>
          <div className="modal-btns">
            <button className="btn grey" onClick={() => setConfirm(null)}>Anuluj</button>
            <button className="btn" onClick={() => { decide(confirm, 'confirmed', '', confirmTime, confirmCar); setConfirm(null) }}>
              {confirm.status === 'confirmed' ? 'Zapisz i wyślij e-mail' : 'Potwierdź i wyślij e-mail'}
            </button>
          </div>
        </Modal>
      )}

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

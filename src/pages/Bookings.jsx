import React, { useEffect, useMemo, useState } from 'react'
import { api, plDate, plDateTime } from '../api.js'
import { exportBookingsXlsx } from '../xlsx.js'
import { Modal, Confirm, useToast } from '../ui.jsx'

let cache = null // instant render przy powrocie na zakładkę
let evCache = [] // terminy do selecta „zmień datę”

const FILTERS = [
  { id: 'pending', label: 'Oczekujące' },
  { id: 'confirmed', label: 'Potwierdzone' },
  { id: 'rejected', label: 'Odrzucone' },
  { id: 'all', label: 'Wszystkie' },
]

const MAX_CARS = 4

function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// termin przeszły = data terminu wcześniejsza niż dziś → rezerwacja w archiwum
const isArchived = (b, today) => !!b.events?.event_date && b.events.event_date < today

const carsText = (b) =>
  (b.selected_cars || [])
    .filter((c) => c.name)
    .map((c) => (c.laps ? `${c.name} — ${c.laps} okr.` : c.name))
    .join(', ')

// „12 sierpnia 2026, 15:00”
const dateTimeText = (date, time) => [plDate(date), time].filter(Boolean).join(', ')

// etykieta terminu w selekcie
const eventLabel = (e) =>
  `${dateTimeText(e.event_date, e.time_text)} — ${[e.title, e.track].filter(Boolean).join(' · ')}` +
  (e.status === 'draft' ? '  [SZKIC]' : '')

// ---------- wybór samochodów (wspólny dla obu modali) ----------
function CarPicker({ rows, setRows, avail }) {
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = () => setRows((rs) => (rs.length >= MAX_CARS ? rs : [...rs, { carId: '', laps: '' }]))
  const rm = (i) => setRows((rs) => (rs.length <= 1 ? [{ carId: '', laps: '' }] : rs.filter((_, j) => j !== i)))

  if (!avail.length) {
    return (
      <div className="hint" style={{ marginTop: 0 }}>
        Brak samochodów przypisanych do tego terminu — dodaj je w zakładce „Terminy”.
      </div>
    )
  }
  return (
    <>
      {rows.map((row, i) => {
        const usedElsewhere = new Set(rows.filter((_, j) => j !== i).map((r) => r.carId).filter(Boolean))
        const options = avail.filter((c) => !usedElsewhere.has(c.id))
        return (
          <div className="car-row" key={i}>
            <select value={row.carId} onChange={(e) => set(i, { carId: e.target.value })}>
              <option value="">— bez wyboru —</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="laps"
              value={row.laps}
              onChange={(e) => set(i, { laps: e.target.value })}
              aria-label="Ilość okrążeń"
            >
              <option value="">— okrążenia —</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} okr.</option>
              ))}
            </select>
            <button
              type="button"
              className="car-rm"
              onClick={() => rm(i)}
              title="Usuń samochód"
              disabled={rows.length <= 1 && !row.carId && !row.laps}
            >×</button>
          </div>
        )
      })}
      {rows.length < MAX_CARS && rows.length < avail.length && (
        <button type="button" className="btn ghost sm" onClick={add} style={{ marginTop: 2 }}>
          + Dodaj samochód
        </button>
      )}
    </>
  )
}

export default function Bookings({ onPendingCount }) {
  const [bookings, setBookings] = useState(cache)
  const [eventOptions, setEventOptions] = useState(evCache)
  const [archive, setArchive] = useState(false)
  const [filter, setFilter] = useState('pending')
  const [dateFilter, setDateFilter] = useState('all') // event_date lub 'all'
  const [reject, setReject] = useState(null) // booking do odrzucenia
  const [rejectNote, setRejectNote] = useState('')
  const [confirm, setConfirm] = useState(null) // booking do potwierdzenia / zmiany godziny
  const [confirmTime, setConfirmTime] = useState('')
  const [confirmCars, setConfirmCars] = useState([]) // [{carId, laps}] max 4
  const [move, setMove] = useState(null) // booking do przeniesienia na inny termin
  const [moveEventId, setMoveEventId] = useState('')
  const [moveTime, setMoveTime] = useState('')
  const [moveCars, setMoveCars] = useState([])
  const [exporting, setExporting] = useState(false)
  const [del, setDel] = useState(null)
  const toast = useToast()
  const today = todayISO()

  const reload = () =>
    api.listBookings().then((r) => {
      cache = r.bookings
      setBookings(r.bookings)
      if (r.event_options) {
        evCache = r.event_options
        setEventOptions(r.event_options)
      }
    }).catch(() => toast('Nie udało się pobrać rezerwacji.', 'err'))

  useEffect(() => { reload() }, [])

  // badge w nagłówku liczy tylko aktualne (nie-archiwalne) oczekujące
  useEffect(() => {
    onPendingCount((bookings || []).filter((b) => b.status === 'pending' && !isArchived(b, today)).length)
  }, [bookings, onPendingCount, today])

  const eventById = useMemo(
    () => Object.fromEntries(eventOptions.map((e) => [e.id, e])),
    [eventOptions],
  )

  const inMode = useMemo(
    () => (bookings || []).filter((b) => isArchived(b, today) === archive),
    [bookings, archive, today],
  )

  // daty terminów obecne w rezerwacjach bieżącego widoku (dla filtra)
  const dates = useMemo(() => {
    const seen = new Map()
    for (const b of inMode) {
      const d = b.events?.event_date
      if (d) seen.set(d, (seen.get(d) || 0) + 1)
    }
    return [...seen.entries()].sort((a, z) => a[0].localeCompare(z[0]))
  }, [inMode])

  const shown = useMemo(() => {
    if (!bookings) return null
    let list = filter === 'all' ? inMode : inMode.filter((b) => b.status === filter)
    if (dateFilter !== 'all') list = list.filter((b) => b.events?.event_date === dateFilter)
    return list
  }, [bookings, inMode, filter, dateFilter])

  const archiveCount = useMemo(
    () => (bookings || []).filter((b) => isArchived(b, today)).length,
    [bookings, today],
  )

  // optymistycznie: status zmienia się od razu, e-mail leci w tle
  const decide = (b, status, note = '', customTime, cars, eventId) => {
    const prev = bookings
    const moved = !!eventId && eventId !== b.event_id ? eventById[eventId] : null
    const evPatch = moved
      ? {
          event_id: moved.id,
          events: {
            title: moved.title,
            track: moved.track,
            event_date: moved.event_date,
            time_text: moved.time_text,
          },
          available_cars: moved.cars || [],
        }
      : {}
    const refTime = String((moved ? moved.time_text : b.events?.time_text) || '').trim()
    let carPatch = {}
    if (cars !== undefined) {
      const avail = moved ? (moved.cars || []) : (b.available_cars || [])
      const sel = cars
        .filter((c) => c.carId)
        .slice(0, MAX_CARS)
        .map((c) => {
          const n = parseInt(c.laps, 10)
          return {
            car_id: c.carId,
            name: avail.find((a) => a.id === c.carId)?.name || (b.selected_cars || []).find((s) => s.car_id === c.carId)?.name || null,
            laps: n >= 1 && n <= 5 ? n : null,
          }
        })
      carPatch = {
        selected_cars: sel,
        car_name: sel.map((c) => c.name).filter(Boolean).join(', ') || null,
        car_id: sel[0]?.car_id || null,
        laps: sel[0]?.laps ?? null,
      }
    }
    setBookings(bookings.map((x) => (x.id === b.id
      ? {
          ...x,
          status,
          admin_note: note,
          ...evPatch,
          ...(customTime !== undefined
            ? { custom_time: customTime.trim() && customTime.trim() !== refTime ? customTime.trim() : null }
            : {}),
          ...carPatch,
        }
      : x)))
    cache = null
    api.decideBooking(b.id, status, note, customTime, cars, eventId)
      .then((r) => {
        if (r.emailSent) {
          toast(status === 'rejected'
            ? `Odrzucono — e-mail wysłany do ${b.email}`
            : moved
              ? `Termin zmieniony — e-mail wysłany do ${b.email}`
              : `Potwierdzono — e-mail wysłany do ${b.email}`, 'ok')
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
    const c = { pending: 0, confirmed: 0, rejected: 0, all: inMode.length }
    for (const b of inMode) c[b.status]++
    return c
  }, [inMode])

  const carRowsOf = (b) => {
    const sel = (b.selected_cars || [])
      .filter((c) => c.car_id)
      .slice(0, MAX_CARS)
      .map((c) => ({ carId: c.car_id, laps: c.laps ? String(c.laps) : '' }))
    return sel.length ? sel : null
  }

  const openConfirm = (b) => {
    setConfirm(b)
    setConfirmTime(b.custom_time || b.events?.time_text || '')
    const avail = b.available_cars || []
    setConfirmCars(carRowsOf(b) || [{ carId: avail.length === 1 ? avail[0].id : '', laps: '' }])
  }

  // ---------- zmiana daty = przeniesienie na inny termin ----------
  const openMove = (b) => {
    setMove(b)
    setMoveEventId(b.event_id || '')
    setMoveTime(b.custom_time || b.events?.time_text || '')
    setMoveCars(carRowsOf(b) || [{ carId: '', laps: '' }])
  }

  const changeMoveEvent = (id) => {
    const from = eventById[moveEventId]
    const to = eventById[id]
    setMoveEventId(id)
    // godzina: jeśli nie była indywidualna — podstawiamy godzinę nowego terminu
    const cur = moveTime.trim()
    if (!cur || cur === String(from?.time_text || '').trim()) setMoveTime(to?.time_text || '')
    // samochody: zostają tylko te, które są przypięte do nowego terminu
    const toCars = to?.cars || []
    const allowed = new Set(toCars.map((c) => c.id))
    setMoveCars((rows) => {
      const kept = rows.filter((r) => r.carId && allowed.has(r.carId))
      return kept.length ? kept : [{ carId: toCars.length === 1 ? toCars[0].id : '', laps: '' }]
    })
  }

  const moveEvent = eventById[moveEventId]
  const moveGroups = useMemo(() => {
    const up = [], past = []
    for (const e of eventOptions) (e.event_date >= today ? up : past).push(e)
    return { up, past: past.slice().reverse() }
  }, [eventOptions, today])
  const moveChanged = !!move && !!moveEvent && moveEvent.id !== move.event_id

  const switchMode = (arch) => {
    setArchive(arch)
    setDateFilter('all')
    setFilter(arch ? 'all' : 'pending')
  }

  const doExport = async () => {
    if (!shown || !shown.length || exporting) return
    setExporting(true)
    try {
      await exportBookingsXlsx(shown, {
        filterLabel: [archive ? 'Archiwum' : null, FILTERS.find((f) => f.id === filter)?.label].filter(Boolean).join(' · '),
        dateLabel: dateFilter === 'all' ? 'Wszystkie daty' : plDate(dateFilter),
        dateSlug: (archive ? 'archiwum-' : '') + (dateFilter === 'all' ? 'wszystkie' : dateFilter),
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
      <p className="sub">
        {archive
          ? 'Archiwum — rezerwacje z terminów, które już się odbyły. Możesz je filtrować i pobrać jako Excel.'
          : 'Zgłoszenia z kalendarza na stronie. Potwierdzenie lub odrzucenie wysyła klientowi brandowany e-mail.'}
      </p>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label} ({counts[f.id]})
          </button>
        ))}
        <button
          className={`arch-toggle${archive ? ' on' : ''}`}
          onClick={() => switchMode(!archive)}
          title="Rezerwacje z terminów, które już minęły"
        >
          Archiwum ({archiveCount})
        </button>
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
          style={{ marginLeft: dates.length > 0 ? 0 : 'auto' }}
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
            : archive ? 'Rezerwacje z minionych terminów pojawią się tutaj automatycznie.'
            : filter === 'pending' ? 'Nowe zgłoszenia pojawią się tutaj automatycznie.' : 'Nic tu jeszcze nie ma.'}
        </div>
      )}

      {shown && shown.map((b) => (
        <div className="card" key={b.id}>
          <div className="row">
            <div className="grow bk-info">
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                <b style={{ fontSize: 16 }}>{b.name}</b>
                <span className={`chip ${b.status}`}>
                  {b.status === 'pending' ? 'Oczekuje' : b.status === 'confirmed' ? 'Potwierdzona' : 'Odrzucona'}
                </span>
                {archive && <span className="chip archived">Archiwum</span>}
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
                {carsText(b) && <> · {(b.selected_cars || []).length > 1 ? 'Samochody' : 'Samochód'}: <b style={{ color: 'var(--ink)' }}>{carsText(b)}</b></>}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Zgłoszono: {plDateTime(b.created_at)}
                {b.decided_at && <> · Decyzja: {plDateTime(b.decided_at)} ({b.decided_by})</>}
                {b.admin_note && <> · Uwaga: {b.admin_note}</>}
              </div>
            </div>
            <div className="card-acts">
              {b.status !== 'confirmed' && (
                <button className="btn sm" onClick={() => openConfirm(b)}>Potwierdź</button>
              )}
              {b.status === 'confirmed' && (
                <>
                  <button className="btn ghost sm" onClick={() => openConfirm(b)}>Zmień godzinę</button>
                  <button className="btn ghost sm" onClick={() => openMove(b)}>Zmień datę</button>
                </>
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
            <label>Samochody dla tego klienta (max {MAX_CARS})</label>
            <CarPicker rows={confirmCars} setRows={setConfirmCars} avail={confirm.available_cars || []} />
            <div className="hint">
              Każdy samochód ma własną ilość okrążeń. Lista trafi do e-maila klienta jako {'{{samochod_linia}}'}.
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
            <button className="btn" onClick={() => { decide(confirm, 'confirmed', '', confirmTime, confirmCars.filter((c) => c.carId)); setConfirm(null) }}>
              {confirm.status === 'confirmed' ? 'Zapisz i wyślij e-mail' : 'Potwierdź i wyślij e-mail'}
            </button>
          </div>
        </Modal>
      )}

      {move && (
        <Modal title="Zmień datę rezerwacji" onClose={() => setMove(null)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Rezerwacja zostanie przeniesiona na inny termin, a klient otrzyma e-mail z nową datą.
          </p>
          <div className="confirm-data">
            <div><span>Klient</span><b>{move.name}</b></div>
            <div><span>E-mail</span><b>{move.email}</b></div>
            {move.voucher_code && <div><span>Voucher</span><b>{move.voucher_code}</b></div>}
          </div>

          <div className="field" style={{ marginTop: 14, marginBottom: 10 }}>
            <label>Nowy termin</label>
            <select value={moveEventId} onChange={(e) => changeMoveEvent(e.target.value)}>
              {!moveEventId && <option value="">— wybierz termin —</option>}
              {moveGroups.up.length > 0 && (
                <optgroup label="Nadchodzące terminy">
                  {moveGroups.up.map((e) => (
                    <option key={e.id} value={e.id}>{eventLabel(e)}</option>
                  ))}
                </optgroup>
              )}
              {moveGroups.past.length > 0 && (
                <optgroup label="Minione terminy">
                  {moveGroups.past.map((e) => (
                    <option key={e.id} value={e.id}>{eventLabel(e)}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="hint">
              Lista pochodzi z zakładki „Terminy”. Jeśli nowej daty jeszcze nie ma — najpierw dodaj tam termin.
            </div>
          </div>

          <div className={`move-diff${moveChanged ? '' : ' same'}`}>
            <div className="md-col">
              <div className="md-k">Obecny termin</div>
              <div className={`md-v${moveChanged ? ' old' : ''}`}>
                {dateTimeText(move.events?.event_date, move.custom_time || move.events?.time_text) || '—'}
              </div>
            </div>
            <div className="md-arrow" aria-hidden="true">→</div>
            <div className="md-col">
              <div className="md-k">Nowy termin</div>
              <div className={`md-v${moveChanged ? ' new' : ''}`}>
                {moveEvent ? dateTimeText(moveEvent.event_date, moveTime || moveEvent.time_text) : '—'}
              </div>
            </div>
          </div>
          {!moveChanged && (
            <div className="hint move-note">Wybrany termin jest taki sam jak obecny — wybierz inną datę z listy.</div>
          )}
          {moveChanged && moveEvent.status === 'draft' && (
            <div className="hint move-note warn">Uwaga: ten termin jest szkicem — nie jest widoczny na stronie.</div>
          )}
          {moveChanged && moveEvent.event_date < today && (
            <div className="hint move-note warn">Uwaga: ten termin już minął — rezerwacja trafi do archiwum.</div>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label>Samochody dla tego klienta (max {MAX_CARS})</label>
            <CarPicker rows={moveCars} setRows={setMoveCars} avail={moveEvent?.cars || []} />
            <div className="hint">
              Lista samochodów pochodzi z nowego terminu — te niedostępne zostały usunięte automatycznie.
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Godzina dla tego klienta</label>
            <input value={moveTime} onChange={(e) => setMoveTime(e.target.value)} placeholder="np. 15:00" />
            <div className="hint">
              Godzina nowego terminu: {moveEvent?.time_text || '—'}. Inna wartość = godzina indywidualna tego klienta.
            </div>
          </div>

          <div className="modal-btns">
            <button className="btn grey" onClick={() => setMove(null)}>Anuluj</button>
            <button
              className="btn"
              disabled={!moveChanged}
              onClick={() => { decide(move, 'confirmed', move.admin_note || '', moveTime, moveCars.filter((c) => c.carId), moveEventId); setMove(null) }}
            >
              Zmień datę i wyślij e-mail
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

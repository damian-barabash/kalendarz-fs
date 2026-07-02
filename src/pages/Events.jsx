import React, { useEffect, useMemo, useState } from 'react'
import { api, plDate } from '../api.js'
import { Modal, Confirm, useToast } from '../ui.jsx'

let cache = null

const EMPTY = {
  id: null,
  title: 'Sport Driving Experience',
  track: '',
  event_date: '',
  time_text: '',
  description: '',
  status: 'published',
  car_ids: [],
}

export default function Events() {
  const [events, setEvents] = useState(cache?.events || null)
  const [cars, setCars] = useState(cache?.cars || [])
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [showPast, setShowPast] = useState(false)
  const toast = useToast()

  const reload = () =>
    Promise.all([api.listEvents(), api.listCars()])
      .then(([e, c]) => {
        cache = { events: e.events, cars: c.cars }
        setEvents(e.events)
        setCars(c.cars)
      })
      .catch(() => toast('Nie udało się pobrać terminów.', 'err'))

  useEffect(() => { reload() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const { upcoming, past } = useMemo(() => {
    const u = [], p = []
    for (const e of events || []) (e.event_date >= today ? u : p).push(e)
    p.reverse()
    return { upcoming: u, past: p }
  }, [events, today])

  const carName = (id) => cars.find((c) => c.id === id)?.name || '—'

  const save = (form) => {
    const isNew = !form.id
    const prev = events
    // optymistycznie
    const tempId = form.id || `temp-${Date.now()}`
    const optimistic = { ...form, id: tempId, pending_count: 0, confirmed_count: 0 }
    setEvents(isNew
      ? [...(events || []), optimistic].sort((a, b) => a.event_date.localeCompare(b.event_date))
      : events.map((e) => (e.id === form.id ? { ...e, ...form } : e)))
    setEdit(null)
    cache = null
    api.saveEvent(form)
      .then(() => { toast(isNew ? 'Termin dodany.' : 'Termin zapisany.', 'ok'); reload() })
      .catch(() => { setEvents(prev); toast('Błąd zapisu — zmiana cofnięta.', 'err') })
  }

  const remove = (ev) => {
    const prev = events
    setEvents(events.filter((e) => e.id !== ev.id))
    setDel(null)
    cache = null
    api.deleteEvent(ev.id).catch(() => {
      setEvents(prev)
      toast('Nie udało się usunąć.', 'err')
    })
  }

  const Card = ({ e }) => (
    <div className="card" key={e.id}>
      <div className="row">
        <div className="grow">
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <b style={{ fontSize: 16 }}>{e.title}</b>
            <span className={`chip ${e.status}`}>{e.status === 'published' ? 'Opublikowany' : 'Szkic'}</span>
          </div>
          <div className="small" style={{ marginBottom: 6 }}>
            {e.track && <>{e.track} · </>}
            <b>{plDate(e.event_date)}</b>
            {e.time_text && <> · {e.time_text}</>}
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            {e.car_ids.map((id) => <span key={id} className="chip car">{carName(id)}</span>)}
            {!e.car_ids.length && <span className="small muted">brak przypisanych samochodów</span>}
          </div>
          <div className="small muted">
            Rezerwacje: {e.pending_count} oczekujących · {e.confirmed_count} potwierdzonych
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setEdit({ ...EMPTY, ...e })}>Edytuj</button>
          <button className="btn grey sm" onClick={() => setDel(e)}>Usuń</button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-h">
        <h1>Terminy</h1>
        <button className="btn" onClick={() => setEdit({ ...EMPTY })}>+ Nowy termin</button>
      </div>
      <p className="sub">Terminy widoczne w kalendarzu na stronie. Szkice nie są publikowane.</p>

      {!events && <div className="spin" />}

      {events && upcoming.length === 0 && (
        <div className="empty"><b>Brak nadchodzących terminów</b>Dodaj pierwszy termin przyciskiem „+ Nowy termin".</div>
      )}
      {events && upcoming.map((e) => <Card e={e} key={e.id} />)}

      {events && past.length > 0 && (
        <>
          <button className="btn grey sm" style={{ margin: '10px 0 14px' }} onClick={() => setShowPast(!showPast)}>
            {showPast ? 'Ukryj' : 'Pokaż'} minione terminy ({past.length})
          </button>
          {showPast && past.map((e) => <Card e={e} key={e.id} />)}
        </>
      )}

      {edit && (
        <EventForm
          form={edit}
          cars={cars}
          onSave={save}
          onClose={() => setEdit(null)}
        />
      )}

      {del && (
        <Confirm
          text={`Usunąć termin „${del.title}" (${plDate(del.event_date)})? Usunie to też wszystkie jego rezerwacje.`}
          onYes={() => remove(del)}
          onNo={() => setDel(null)}
        />
      )}
    </>
  )
}

function EventForm({ form, cars, onSave, onClose }) {
  const [f, setF] = useState(form)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const activeCars = cars.filter((c) => c.active || f.car_ids.includes(c.id))
  const valid = f.title.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(f.event_date)

  const toggleCar = (id) =>
    set('car_ids', f.car_ids.includes(id) ? f.car_ids.filter((x) => x !== id) : [...f.car_ids, id])

  return (
    <Modal title={f.id ? 'Edytuj termin' : 'Nowy termin'} onClose={onClose} wide>
      <div className="field">
        <label>Tytuł *</label>
        <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Sport Driving Experience Tor Łódź 9 Lipca" />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="field grow">
          <label>Tor</label>
          <input value={f.track} onChange={(e) => set('track', e.target.value)} placeholder="Tor Łódź" />
        </div>
        <div className="field" style={{ width: 170 }}>
          <label>Data *</label>
          <input type="date" value={f.event_date} onChange={(e) => set('event_date', e.target.value)} />
        </div>
        <div className="field" style={{ width: 150 }}>
          <label>Godzina</label>
          <input value={f.time_text} onChange={(e) => set('time_text', e.target.value)} placeholder="9:00–17:00" />
        </div>
      </div>
      <div className="field">
        <label>Opis (widoczny po kliknięciu „Szczegóły")</label>
        <textarea value={f.description} onChange={(e) => set('description', e.target.value)}
          placeholder="Program dnia, adres toru, co zabrać ze sobą…" />
      </div>
      <div className="field">
        <label>Dostępne samochody</label>
        <div className="checks">
          {activeCars.map((c) => (
            <label key={c.id} className={`check ${f.car_ids.includes(c.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={f.car_ids.includes(c.id)} onChange={() => toggleCar(c.id)} />
              {c.name}
            </label>
          ))}
          {!activeCars.length && <span className="small muted">Dodaj samochody w zakładce „Samochody".</span>}
        </div>
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={f.status === 'published'}
          onChange={(e) => set('status', e.target.checked ? 'published' : 'draft')}
        />
        Opublikowany (widoczny w kalendarzu na stronie)
      </label>
      <div className="modal-btns">
        <button className="btn grey" onClick={onClose}>Anuluj</button>
        <button className="btn" disabled={!valid} onClick={() => onSave(f)}>Zapisz</button>
      </div>
    </Modal>
  )
}

import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Modal, Confirm, useToast } from '../ui.jsx'

let cache = null

export default function Cars() {
  const [cars, setCars] = useState(cache)
  const [edit, setEdit] = useState(null) // {id?, name, sort, active}
  const [del, setDel] = useState(null)
  const toast = useToast()

  const reload = () =>
    api.listCars().then((r) => { cache = r.cars; setCars(r.cars) })
      .catch(() => toast('Nie udało się pobrać samochodów.', 'err'))

  useEffect(() => { reload() }, [])

  const save = (f) => {
    const isNew = !f.id
    const prev = cars
    const tempId = f.id || `temp-${Date.now()}`
    setCars(isNew
      ? [...(cars || []), { ...f, id: tempId }].sort((a, b) => a.sort - b.sort)
      : cars.map((c) => (c.id === f.id ? { ...c, ...f } : c)))
    setEdit(null)
    cache = null
    api.saveCar(f)
      .then(() => { toast(isNew ? 'Samochód dodany.' : 'Zapisano.', 'ok'); reload() })
      .catch(() => { setCars(prev); toast('Błąd zapisu — zmiana cofnięta.', 'err') })
  }

  const toggleActive = (c) => save({ ...c, active: !c.active })

  const remove = (c) => {
    const prev = cars
    setCars(cars.filter((x) => x.id !== c.id))
    setDel(null)
    cache = null
    api.deleteCar(c.id).catch(() => {
      setCars(prev)
      toast('Nie udało się usunąć.', 'err')
    })
  }

  const move = (c, dir) => {
    const sorted = [...cars].sort((a, b) => a.sort - b.sort)
    const i = sorted.findIndex((x) => x.id === c.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    const other = sorted[j]
    // zamiana sortów, optymistycznie
    const prev = cars
    setCars(cars.map((x) =>
      x.id === c.id ? { ...x, sort: other.sort } : x.id === other.id ? { ...x, sort: c.sort } : x,
    ).sort((a, b) => a.sort - b.sort))
    cache = null
    Promise.all([
      api.saveCar({ ...c, sort: other.sort }),
      api.saveCar({ ...other, sort: c.sort }),
    ]).then(reload).catch(() => { setCars(prev); toast('Błąd zapisu kolejności.', 'err') })
  }

  const sorted = cars ? [...cars].sort((a, b) => a.sort - b.sort) : null

  return (
    <>
      <div className="page-h">
        <h1>Samochody</h1>
        <button className="btn" onClick={() => setEdit({ name: '', sort: (cars?.length || 0) + 1, active: true })}>
          + Dodaj samochód
        </button>
      </div>
      <p className="sub">Katalog aut. Przy tworzeniu terminu zaznaczasz, które auta są dostępne. Nieaktywne auta nie pojawiają się w wyborze.</p>

      {!sorted && <div className="spin" />}

      {sorted && sorted.map((c, i) => (
        <div className="card" key={c.id} style={c.active ? undefined : { opacity: .55 }}>
          <div className="row">
            <div className="row" style={{ gap: 4 }}>
              <button className="btn grey sm" disabled={i === 0} onClick={() => move(c, -1)} aria-label="W górę">↑</button>
              <button className="btn grey sm" disabled={i === sorted.length - 1} onClick={() => move(c, 1)} aria-label="W dół">↓</button>
            </div>
            <b className="grow" style={{ fontSize: 15.5 }}>{c.name}</b>
            <label className="switch small">
              <input type="checkbox" checked={c.active} onChange={() => toggleActive(c)} />
              {c.active ? 'Aktywny' : 'Nieaktywny'}
            </label>
            <button className="btn ghost sm" onClick={() => setEdit({ ...c })}>Zmień nazwę</button>
            <button className="btn grey sm" onClick={() => setDel(c)}>Usuń</button>
          </div>
        </div>
      ))}

      {edit && (
        <Modal title={edit.id ? 'Edytuj samochód' : 'Nowy samochód'} onClose={() => setEdit(null)}>
          <div className="field">
            <label>Nazwa *</label>
            <input value={edit.name} autoFocus
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && edit.name.trim()) save(edit) }}
              placeholder="np. BMW M2 - najnowszy model" />
          </div>
          <div className="modal-btns">
            <button className="btn grey" onClick={() => setEdit(null)}>Anuluj</button>
            <button className="btn" disabled={!edit.name.trim()} onClick={() => save(edit)}>Zapisz</button>
          </div>
        </Modal>
      )}

      {del && (
        <Confirm
          text={`Usunąć „${del.name}"? Zniknie też ze wszystkich terminów. Jeśli auto wróci później — lepiej ustaw „Nieaktywny".`}
          onYes={() => remove(del)}
          onNo={() => setDel(null)}
        />
      )}
    </>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { api, plDate } from '../api.js'
import { Modal, useToast } from '../ui.jsx'

let cache = null // instant render przy powrocie na zakładkę

const MONTHS_NOM = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
const DOW = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz']

const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}` // m 0-based

const STATUS_ORDER = { confirmed: 0, pending: 1, rejected: 2 }

const carsText = (b) =>
  (b.selected_cars || [])
    .filter((c) => c.name)
    .map((c) => (c.laps ? `${c.name} — ${c.laps} okr.` : c.name))
    .join(', ')

export default function Calendar() {
  const now = new Date()
  const [data, setData] = useState(cache) // { events, bookings }
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [dayOpen, setDayOpen] = useState(null) // data ISO otwartego dnia
  const toast = useToast()

  const today = iso(now.getFullYear(), now.getMonth(), now.getDate())

  useEffect(() => {
    Promise.all([api.listEvents(), api.listBookings()])
      .then(([e, b]) => {
        cache = { events: e.events, bookings: b.bookings }
        setData(cache)
      })
      .catch(() => toast('Nie udało się pobrać kalendarza.', 'err'))
  }, [])

  // data -> [{ event, bookings }] (rezerwacje pogrupowane po terminie, posortowane po statusie)
  const byDate = useMemo(() => {
    if (!data) return {}
    const bkByEvent = {}
    for (const b of data.bookings || []) {
      (bkByEvent[b.event_id] ||= []).push(b)
    }
    for (const k of Object.keys(bkByEvent)) {
      bkByEvent[k].sort((a, z) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[z.status] ?? 9) || a.created_at.localeCompare(z.created_at))
    }
    const map = {}
    for (const e of data.events || []) {
      (map[e.event_date] ||= []).push({ event: e, bookings: bkByEvent[e.id] || [] })
    }
    return map
  }, [data])

  // siatka tygodni bieżącego miesiąca (poniedziałek pierwszy)
  const weeks = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const lead = (first.getDay() + 6) % 7
    const daysIn = new Date(ym.y, ym.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < lead; i++) cells.push(null)
    for (let d = 1; d <= daysIn; d++) cells.push(iso(ym.y, ym.m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const w = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [ym])

  const monthStats = useMemo(() => {
    const pfx = `${ym.y}-${pad(ym.m + 1)}-`
    let terms = 0, confirmed = 0, pending = 0
    for (const [d, list] of Object.entries(byDate)) {
      if (!d.startsWith(pfx)) continue
      terms += list.length
      for (const { bookings } of list) {
        for (const b of bookings) {
          if (b.status === 'confirmed') confirmed++
          if (b.status === 'pending') pending++
        }
      }
    }
    return { terms, confirmed, pending }
  }, [byDate, ym])

  const nav = (delta) => setYm(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const openDay = byDate[dayOpen] || []

  return (
    <>
      <div className="page-h"><h1>Kalendarz</h1></div>
      <p className="sub">Podgląd miesiąca: terminy i zapisani klienci. Kliknij dzień, aby zobaczyć szczegóły — godziny, samochody, kontakty.</p>

      <div className="cal-head">
        <div className="cal-nav">
          <button className="btn ghost sm" onClick={() => nav(-1)} aria-label="Poprzedni miesiąc">‹</button>
          <div className="cal-title">{MONTHS_NOM[ym.m]} {ym.y}</div>
          <button className="btn ghost sm" onClick={() => nav(1)} aria-label="Następny miesiąc">›</button>
        </div>
        {(ym.y !== now.getFullYear() || ym.m !== now.getMonth()) && (
          <button className="btn grey sm" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Dziś</button>
        )}
        <div className="cal-stats small muted">
          {monthStats.terms
            ? <>{monthStats.terms} {monthStats.terms === 1 ? 'termin' : monthStats.terms < 5 ? 'terminy' : 'terminów'} · <b style={{ color: 'var(--ok)' }}>{monthStats.confirmed}</b> potwierdzonych · <b style={{ color: 'var(--warn)' }}>{monthStats.pending}</b> oczekujących</>
            : 'Brak terminów w tym miesiącu'}
        </div>
        <div className="cal-legend">
          <span><i className="dot" style={{ background: 'var(--ok)' }} /> potwierdzona</span>
          <span><i className="dot" style={{ background: 'var(--warn)' }} /> oczekująca</span>
        </div>
      </div>

      {!data && <div className="spin" />}

      {data && (
        <div className="cal-scroll">
          <div className="cal-grid">
            {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
            {weeks.flat().map((d, i) => {
              if (!d) return <div className="cal-day out" key={`x${i}`} />
              const list = byDate[d] || []
              const dayNum = Number(d.slice(8))
              const cls = [
                'cal-day',
                d < today ? 'past' : '',
                d === today ? 'today' : '',
                list.length ? 'has' : '',
              ].filter(Boolean).join(' ')
              return (
                <div
                  className={cls}
                  key={d}
                  onClick={() => list.length && setDayOpen(d)}
                  role={list.length ? 'button' : undefined}
                  tabIndex={list.length ? 0 : undefined}
                  onKeyDown={(e) => { if (list.length && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDayOpen(d) } }}
                >
                  <div className="cal-num">
                    <span>{dayNum}</span>
                    {d === today && <span className="today-tag">DZIŚ</span>}
                  </div>
                  {list.map(({ event, bookings }) => {
                    const visible = bookings.filter((b) => b.status !== 'rejected')
                    const shownBk = visible.slice(0, 3)
                    return (
                      <div className="cal-ev" key={event.id}>
                        <div className="cal-ev-t" title={event.title}>
                          {event.status === 'draft' && <span className="cal-draft">SZKIC </span>}
                          {event.title}
                        </div>
                        <div className="cal-ev-time">{event.time_text || '—'}{event.track ? ` · ${event.track}` : ''}</div>
                        {shownBk.map((b) => (
                          <div className="cal-bk" key={b.id} title={`${b.name}${b.custom_time ? ` · ${b.custom_time}` : ''}${carsText(b) ? ` · ${carsText(b)}` : ''}`}>
                            <i className="dot" style={{ background: b.status === 'confirmed' ? 'var(--ok)' : 'var(--warn)' }} />
                            <span className="nm">{b.name}</span>
                            {b.custom_time && <span className="tm">{b.custom_time}</span>}
                          </div>
                        ))}
                        {visible.length > 3 && <div className="cal-more">+{visible.length - 3} więcej</div>}
                        {!visible.length && <div className="cal-more">brak zapisów</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dayOpen && (
        <Modal title={plDate(dayOpen)} onClose={() => setDayOpen(null)}>
          {openDay.map(({ event, bookings }) => (
            <div className="cal-md-ev" key={event.id}>
              <div className="row" style={{ gap: 10, marginBottom: 4 }}>
                <b style={{ fontSize: 15 }}>{event.title}</b>
                <span className={`chip ${event.status}`}>{event.status === 'published' ? 'Opublikowany' : 'Szkic'}</span>
              </div>
              <div className="small muted" style={{ marginBottom: 10 }}>
                {event.track && `${event.track} · `}{event.time_text || 'bez godziny'}
                {' · '}
                <b style={{ color: 'var(--ok)' }}>{bookings.filter((b) => b.status === 'confirmed').length}</b> potw.
                {' · '}
                <b style={{ color: 'var(--warn)' }}>{bookings.filter((b) => b.status === 'pending').length}</b> oczek.
              </div>
              {bookings.length === 0 && <div className="small muted" style={{ marginBottom: 8 }}>Brak rezerwacji na ten termin.</div>}
              {bookings.map((b) => (
                <div className={`cal-md-bk${b.status === 'rejected' ? ' rej' : ''}`} key={b.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <i className="dot" style={{ background: b.status === 'confirmed' ? 'var(--ok)' : b.status === 'pending' ? 'var(--warn)' : 'var(--muted)' }} />
                    <b>{b.name}</b>
                    <span className="small muted">{b.custom_time || event.time_text || ''}{b.custom_time && ' (indywidualna)'}</span>
                  </div>
                  <div className="small muted" style={{ margin: '3px 0 0 16px' }}>
                    <a href={`mailto:${b.email}`} style={{ color: 'var(--ink)' }}>{b.email}</a>
                    {' · '}
                    <a href={`tel:${b.phone}`} style={{ color: 'var(--ink)' }}>{b.phone}</a>
                    {b.voucher_code && <> · Voucher: <b style={{ color: 'var(--ink)' }}>{b.voucher_code}</b></>}
                  </div>
                  {carsText(b) && (
                    <div className="small" style={{ margin: '3px 0 0 16px' }}>
                      {(b.selected_cars || []).length > 1 ? 'Samochody' : 'Samochód'}: <b>{carsText(b)}</b>
                    </div>
                  )}
                  {b.admin_note && <div className="small muted" style={{ margin: '3px 0 0 16px' }}>Uwaga: {b.admin_note}</div>}
                </div>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </>
  )
}

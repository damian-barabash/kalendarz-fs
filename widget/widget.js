// FASTLINE SUPERCARS — kalendarz terminów (widget do WordPress)
// Wstawka: <div id="fs-kalendarz"></div> + <script src="https://panel.fastlinesupercars.pl/widget.js" defer></script>

const SUPABASE_URL = 'https://aleebzkvwychuafczvcn.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZWViemt2d3ljaHVhZmN6dmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzE2NzcsImV4cCI6MjA5ODU0NzY3N30.5OzV2IEfPCP_43AHmb85elkK8oVgI3ixtlpLZTGhTVU'

const MONTHS = ['STYCZEŃ','LUTY','MARZEC','KWIECIEŃ','MAJ','CZERWIEC','LIPIEC','SIERPIEŃ','WRZESIEŃ','PAŹDZIERNIK','LISTOPAD','GRUDZIEŃ']
const MONTHS_GEN = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia']
const WEEKDAYS = ['poniedziałek','wtorek','środa','czwartek','piątek','sobota','niedziela']
const WEEKDAYS_SHORT = ['PON.','WT.','ŚR.','CZW.','PT.','SOB.','NIEDZ.']

const CACHE_KEY = 'fsk-cache-v1'

const CSS = `
.fsk{--red:#e10600;--ink:#1a1a1a;--grey:#6b6b6b;font-family:inherit;color:var(--ink);line-height:1.45}
.fsk *{box-sizing:border-box}
.fsk-wrap{display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:28px;align-items:start}
@media(max-width:960px){.fsk-wrap{grid-template-columns:1fr}}
.fsk-list{display:flex;flex-direction:column;gap:18px}
.fsk-card{background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.12);padding:20px 22px;display:flex;gap:16px;opacity:0;transform:translateY(10px);animation:fsk-in .35s ease forwards}
.fsk-card:nth-child(2){animation-delay:.05s}.fsk-card:nth-child(3){animation-delay:.1s}.fsk-card:nth-child(4){animation-delay:.15s}.fsk-card:nth-child(5){animation-delay:.2s}
@keyframes fsk-in{to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.fsk-card{animation:none;opacity:1;transform:none}}
.fsk-date{flex:0 0 84px;text-align:center;padding-top:2px}
.fsk-date svg{width:34px;height:34px;display:block;margin:0 auto 6px}
.fsk-date b{display:block;font-size:15px;line-height:1.25}
.fsk-date small{color:var(--grey);font-size:12px}
.fsk-body{flex:1;min-width:0}
.fsk-title{font-size:19px;font-weight:700;margin:0 0 10px}
.fsk-cars-h{font-weight:700;font-size:14px;margin:0 0 6px}
.fsk-cars{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;padding:0;list-style:none}
.fsk-cars li{white-space:nowrap;font-size:12.5px;font-weight:600;color:var(--ink);background:#f6f6f6;border:1px solid #e6e6e6;border-radius:999px;padding:5px 12px;line-height:1.2}
.fsk-cars li:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--red);margin-right:7px;vertical-align:1px}
.fsk-time{font-size:13px;color:var(--grey);margin:-6px 0 10px}
.fsk-btns{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
@media(max-width:520px){.fsk-card{flex-direction:column}.fsk-date{display:flex;gap:10px;align-items:center;text-align:left;flex-basis:auto}.fsk-date svg{margin:0}}
.fsk-btn{display:inline-block;font-weight:700;font-size:13px;letter-spacing:.4px;padding:9px 18px;cursor:pointer;text-transform:uppercase;border:2px solid var(--red);background:#fff;color:var(--red);transition:transform .15s ease,box-shadow .15s ease;text-decoration:none;font-family:inherit}
.fsk-btn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(225,6,0,.25)}
.fsk-btn--solid{background:var(--red);color:#fff}
.fsk-btn:before{content:'» '}
.fsk-empty{background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.1);padding:28px;text-align:center;color:var(--grey)}
.fsk-cal{background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.12);padding:18px}
.fsk-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.fsk-cal-title{font-size:22px;font-weight:800;letter-spacing:.5px}
.fsk-nav{display:flex;gap:6px}
.fsk-nav button{width:38px;height:38px;border:1px solid #ddd;background:#fff;font-size:18px;cursor:pointer;transition:background .15s;color:var(--ink)}
.fsk-nav button:hover{background:#f4f4f4}
.fsk-grid{display:grid;grid-template-columns:repeat(7,1fr);border-left:1px solid #e8e8e8;border-top:1px solid #e8e8e8}
.fsk-dow{padding:9px 4px;text-align:center;font-size:11.5px;font-weight:700;color:#555;background:#fafafa;border-right:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8}
.fsk-day{min-height:74px;padding:6px;border-right:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;font-size:13px;position:relative}
.fsk-day--out{background:#f3f3f3;color:#aaa}
.fsk-day--today{background:#e9e9e9}
.fsk-day--ev{cursor:pointer}
.fsk-day--ev:hover{background:#fff5f5}
.fsk-day--ev .fsk-day-n{color:var(--red);font-weight:800}
.fsk-day-ev{margin-top:4px;font-size:11px;line-height:1.3;color:var(--ink);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.fsk-day-ev b{color:var(--red)}
@media(max-width:520px){.fsk-day{min-height:46px;font-size:12px}.fsk-day-ev{display:none}.fsk-day--ev:after{content:'';position:absolute;left:50%;bottom:5px;width:6px;height:6px;border-radius:50%;background:var(--red);transform:translateX(-50%)}}
.fsk-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;animation:fsk-fade .2s ease}
@keyframes fsk-fade{from{opacity:0}}
.fsk-modal{background:#fff;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:28px;position:relative;animation:fsk-pop .22s ease;box-shadow:0 10px 40px rgba(0,0,0,.35)}
@keyframes fsk-pop{from{opacity:0;transform:scale(.96) translateY(8px)}}
@media(prefers-reduced-motion:reduce){.fsk-ov,.fsk-modal{animation:none}}
.fsk-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#888;padding:4px}
.fsk-x:hover{color:var(--red)}
.fsk-m-title{font-size:20px;font-weight:800;margin:0 34px 4px 0}
.fsk-m-sub{color:var(--grey);font-size:14px;margin:0 0 14px}
.fsk-m-desc{font-size:14px;white-space:pre-wrap;margin:0 0 16px}
.fsk-m-info{font-size:14px;margin:0 0 16px;color:#333}
.fsk-field{margin-bottom:12px}
.fsk-field label{display:block;font-size:13.5px;font-weight:600;margin-bottom:4px}
.fsk-field label i{color:var(--red);font-style:normal}
.fsk-field input{width:100%;padding:10px 12px;border:1px solid #bbb;border-radius:3px;font-size:14px;font-family:inherit;transition:border-color .15s}
.fsk-field input:focus{outline:none;border-color:var(--red)}
.fsk-field input.fsk-err{border-color:var(--red);background:#fff5f5}
.fsk-shoplink{color:var(--red);font-weight:700;text-decoration:underline}
.fsk-send{width:100%;margin-top:6px;padding:13px;font-size:15px;letter-spacing:.5px}
.fsk-ok{text-align:center;padding:26px 6px}
.fsk-ok-ic{width:56px;height:56px;margin:0 auto 14px;border-radius:50%;background:var(--red);color:#fff;font-size:30px;line-height:56px;font-weight:700}
.fsk-ok h4{font-size:19px;margin:0 0 8px}
.fsk-ok p{color:var(--grey);font-size:14px;margin:0}
.fsk-error{background:#fff2f2;border:1px solid var(--red);color:#9c0400;padding:10px 12px;font-size:13.5px;margin-bottom:12px;border-radius:3px}
`

const state = {
  events: [],
  carsById: {},
  settings: {},
  month: null, // {y, m}
  root: null,
}

const el = (tag, cls, html) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html !== undefined) n.innerHTML = html
  return n
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const CAL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 3v4M16 3v4"/></svg>`

function plDateParts(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay() // 0=nd
  return {
    d, y,
    month: MONTHS_GEN[m - 1],
    weekday: WEEKDAYS[(wd + 6) % 7],
  }
}

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  if (!res.ok) throw new Error('fetch')
  return res.json()
}

async function loadData() {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [events, cars, settings] = await Promise.all([
    rest(`events?select=id,title,track,event_date,time_text,description,event_cars(car_id)&status=eq.published&event_date=gte.${iso}&order=event_date.asc`),
    rest(`cars?select=id,name,sort&active=eq.true&order=sort.asc`),
    rest(`settings?select=key,value&key=like.public_%25`),
  ])
  const carsById = {}
  for (const c of cars) carsById[c.id] = c
  const settingsMap = {}
  for (const s of settings) settingsMap[s.key] = s.value
  return { events, carsById, settings: settingsMap }
}

function eventCars(ev) {
  return (ev.event_cars || [])
    .map((ec) => state.carsById[ec.car_id])
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort)
}

// ---------- popupy ----------
let ovEl = null
function closeOverlay() {
  if (ovEl) { ovEl.remove(); ovEl = null }
}
function openOverlay(modal) {
  closeOverlay()
  ovEl = el('div', 'fsk-ov')
  ovEl.addEventListener('click', (e) => { if (e.target === ovEl) closeOverlay() })
  const x = el('button', 'fsk-x', '×')
  x.setAttribute('aria-label', 'Zamknij')
  x.addEventListener('click', closeOverlay)
  modal.prepend(x)
  ovEl.appendChild(modal)
  document.body.appendChild(ovEl)
  document.addEventListener('keydown', escClose)
}
function escClose(e) {
  if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', escClose) }
}

function openDetails(ev) {
  const p = plDateParts(ev.event_date)
  const cars = eventCars(ev)
  const m = el('div', 'fsk-modal fsk')
  m.appendChild(el('h4', 'fsk-m-title', esc(ev.title)))
  m.appendChild(el('p', 'fsk-m-sub', `${esc(ev.track)}${ev.track ? ' · ' : ''}${p.d} ${p.month} ${p.y}, ${p.weekday}${ev.time_text ? ' · ' + esc(ev.time_text) : ''}`))
  if (ev.description) m.appendChild(el('div', 'fsk-m-desc', esc(ev.description)))
  if (cars.length) {
    m.appendChild(el('p', 'fsk-cars-h', 'Dostępne Samochody:'))
    m.appendChild(el('ul', 'fsk-cars', cars.map((c) => `<li>${esc(c.name)}</li>`).join('')))
  }
  const btn = el('button', 'fsk-btn fsk-btn--solid', 'REZERWUJ')
  btn.addEventListener('click', () => openBooking(ev))
  m.appendChild(btn)
  openOverlay(m)
}

function openBooking(ev) {
  const p = plDateParts(ev.event_date)
  const m = el('div', 'fsk-modal fsk')
  m.appendChild(el('h4', 'fsk-m-title', 'Rezerwacja terminu'))
  m.appendChild(el('p', 'fsk-m-sub', `${esc(ev.title)} · ${p.d} ${p.month} ${p.y}`))

  const shopUrl = state.settings.public_shop_url || 'https://fastlinesupercars.pl/sklep/'
  const info = state.settings.public_booking_popup_text ||
    'Aby zarezerwować dany termin podaj swoje dane oraz kod zakupionego vouchera. Jeżeli nie posiadasz vouchera, przejdź do sklepu. Wszystkie rezerwacje są potwierdzane manualnie przez nasz zespół.'
  const infoHtml = esc(info).replace(
    /przejdź do sklepu/i,
    (t) => `<a class="fsk-shoplink" href="${esc(shopUrl)}" target="_blank" rel="noopener">${t}</a>`,
  )
  m.appendChild(el('p', 'fsk-m-info', infoHtml))

  const form = el('form')
  form.noValidate = true
  form.innerHTML = `
    <div class="fsk-field"><label>Imię i nazwisko <i>*</i></label><input name="name" autocomplete="name"></div>
    <div class="fsk-field"><label>Email <i>*</i></label><input name="email" type="email" autocomplete="email"></div>
    <div class="fsk-field"><label>Telefon <i>*</i></label><input name="phone" type="tel" autocomplete="tel"></div>
    <div class="fsk-field"><label>Kod Vouchera</label><input name="voucher_code" autocomplete="off"></div>
    <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-5000px" aria-hidden="true">
    <button type="submit" class="fsk-btn fsk-btn--solid fsk-send">WYŚLIJ</button>
  `
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = form.elements
    const vals = {
      event_id: ev.id,
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      voucher_code: f.voucher_code.value.trim(),
      website: f.website.value,
    }
    let bad = false
    const mark = (input, isBad) => { input.classList.toggle('fsk-err', isBad); if (isBad) bad = true }
    mark(f.name, vals.name.length < 2)
    mark(f.email, !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vals.email))
    mark(f.phone, vals.phone.length < 5)
    if (bad) return

    // optymistycznie: od razu ekran sukcesu, request leci w tle
    const body = m.cloneNode(false)
    m.innerHTML = ''
    const ok = el('div', 'fsk-ok', `
      <div class="fsk-ok-ic">✓</div>
      <h4>Dziękujemy!</h4>
      <p>Twoja rezerwacja została przesłana.<br>Potwierdzimy ją wkrótce e-mailem.</p>
    `)
    m.appendChild(ok)
    const x = el('button', 'fsk-x', '×')
    x.addEventListener('click', closeOverlay)
    m.prepend(x)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/book`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vals),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'send')
    } catch {
      // rollback: pokaż formularz z błędem, dane zachowane
      m.innerHTML = ''
      m.appendChild(el('div', 'fsk-error', 'Nie udało się wysłać rezerwacji. Sprawdź połączenie i spróbuj ponownie.'))
      m.appendChild(el('h4', 'fsk-m-title', 'Rezerwacja terminu'))
      m.appendChild(el('p', 'fsk-m-sub', `${esc(ev.title)} · ${p.d} ${p.month} ${p.y}`))
      Object.entries(vals).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v })
      m.appendChild(form)
      const x2 = el('button', 'fsk-x', '×')
      x2.addEventListener('click', closeOverlay)
      m.prepend(x2)
      void body
    }
  })
  m.appendChild(form)
  openOverlay(m)
  setTimeout(() => form.elements.name.focus(), 60)
}

// ---------- render ----------
function renderList(container) {
  container.innerHTML = ''
  if (!state.events.length) {
    container.appendChild(el('div', 'fsk-empty', 'Aktualnie brak dostępnych terminów.<br>Zajrzyj do nas wkrótce!'))
    return
  }
  for (const ev of state.events) {
    const p = plDateParts(ev.event_date)
    const cars = eventCars(ev)
    const card = el('article', 'fsk-card')
    card.innerHTML = `
      <div class="fsk-date">${CAL_ICON}<b>${p.d} ${p.month}<br>${p.y}</b><small>${p.weekday}</small></div>
      <div class="fsk-body">
        <h3 class="fsk-title">${esc(ev.title)}</h3>
        ${ev.time_text ? `<p class="fsk-time">Godzina: ${esc(ev.time_text)}</p>` : ''}
        ${cars.length ? `<p class="fsk-cars-h">Dostępne Samochody:</p>
        <ul class="fsk-cars">${cars.map((c) => `<li>${esc(c.name)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="fsk-btns">
        <button class="fsk-btn" data-act="details">SZCZEGÓŁY</button>
        <button class="fsk-btn fsk-btn--solid" data-act="book">REZERWUJ</button>
      </div>`
    card.querySelector('[data-act=details]').addEventListener('click', () => openDetails(ev))
    card.querySelector('[data-act=book]').addEventListener('click', () => openBooking(ev))
    container.appendChild(card)
  }
}

function renderCalendar(container) {
  container.innerHTML = ''
  const { y, m } = state.month
  const head = el('div', 'fsk-cal-head')
  head.appendChild(el('div', 'fsk-cal-title', `${MONTHS[m]} ${y}`))
  const nav = el('div', 'fsk-nav')
  const prev = el('button', '', '‹')
  const next = el('button', '', '›')
  prev.setAttribute('aria-label', 'Poprzedni miesiąc')
  next.setAttribute('aria-label', 'Następny miesiąc')
  prev.addEventListener('click', () => { shiftMonth(-1); renderCalendar(container) })
  next.addEventListener('click', () => { shiftMonth(1); renderCalendar(container) })
  nav.append(prev, next)
  head.appendChild(nav)
  container.appendChild(head)

  const grid = el('div', 'fsk-grid')
  for (const d of WEEKDAYS_SHORT) grid.appendChild(el('div', 'fsk-dow', d))

  const evByDate = {}
  for (const ev of state.events) (evByDate[ev.event_date] ||= []).push(ev)

  const first = new Date(y, m, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const cells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  for (let i = 0; i < cells; i++) {
    const dayNum = i - startOffset + 1
    const cellDate = new Date(y, m, dayNum)
    const iso = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`
    const out = dayNum < 1 || dayNum > daysInMonth
    const evs = evByDate[iso] || []
    const cell = el('div', 'fsk-day' + (out ? ' fsk-day--out' : '') + (iso === todayIso ? ' fsk-day--today' : '') + (evs.length ? ' fsk-day--ev' : ''))
    cell.appendChild(el('span', 'fsk-day-n', String(cellDate.getDate())))
    if (evs.length && !out) {
      const p = plDateParts(iso)
      cell.appendChild(el('div', 'fsk-day-ev', `${esc(evs[0].title)}<br><b>${p.d} ${p.month}, ${p.y}</b>`))
      cell.addEventListener('click', () => openDetails(evs[0]))
    }
    grid.appendChild(cell)
  }
  container.appendChild(grid)
}

function shiftMonth(delta) {
  let { y, m } = state.month
  m += delta
  if (m < 0) { m = 11; y-- }
  if (m > 11) { m = 0; y++ }
  state.month = { y, m }
}

function render() {
  const root = state.root
  root.innerHTML = ''
  root.classList.add('fsk')
  const wrap = el('div', 'fsk-wrap')
  const list = el('div', 'fsk-list')
  const cal = el('div', 'fsk-cal')
  wrap.append(list, cal)
  root.appendChild(wrap)
  renderList(list)
  renderCalendar(cal)
}

function applyData(data) {
  state.events = data.events || []
  state.carsById = data.carsById || {}
  state.settings = data.settings || {}
  if (!state.month) {
    const first = state.events[0]
    const base = first ? new Date(first.event_date) : new Date()
    state.month = { y: base.getFullYear(), m: base.getMonth() }
  }
  render()
}

async function init() {
  const root = document.getElementById('fs-kalendarz')
  if (!root) return
  state.root = root

  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  // optymistycznie: najpierw cache (0 ms), potem świeże dane
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached) applyData(cached)
  } catch { /* ignore */ }

  try {
    const data = await loadData()
    applyData(data)
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
  } catch (e) {
    if (!state.events.length) {
      root.innerHTML = ''
      root.appendChild(el('div', 'fsk-empty', 'Nie udało się załadować kalendarza. Odśwież stronę.'))
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

import { plDate, plDateTime } from './api.js'

// Brandowany eksport rezerwacji do .xlsx (ExcelJS ładowany leniwie — nie obciąża startu panelu).
const BLACK = 'FF111111'
const RED = 'FFE10600'
const GREY_BG = 'FFF7F7F7'
const BORDER = 'FFE2E2E2'

const STATUS_PL = { pending: 'Oczekuje', confirmed: 'Potwierdzona', rejected: 'Odrzucona' }
const STATUS_COLOR = { pending: 'FFB58900', confirmed: 'FF1A7F37', rejected: 'FFB4232A' }

const COLS = [
  { header: 'Lp.', width: 5, key: 'lp' },
  { header: 'Imię i nazwisko', width: 26, key: 'name' },
  { header: 'E-mail', width: 30, key: 'email' },
  { header: 'Telefon', width: 15, key: 'phone' },
  { header: 'Voucher', width: 26, key: 'voucher' },
  { header: 'Termin', width: 32, key: 'termin' },
  { header: 'Tor', width: 16, key: 'tor' },
  { header: 'Data', width: 18, key: 'data' },
  { header: 'Godzina', width: 12, key: 'godzina' },
  { header: 'Samochód', width: 26, key: 'car' },
  { header: 'Okrążenia', width: 11, key: 'laps' },
  { header: 'Status', width: 15, key: 'status' },
  { header: 'Zgłoszono', width: 20, key: 'created' },
  { header: 'Uwaga', width: 30, key: 'note' },
]

function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Buduje workbook ExcelJS (czysta funkcja — bez DOM/fetch, dzięki czemu można ją testować w Node).
export function buildBookingsWorkbook(ExcelJS, rows, meta = {}, logoBuffer = null) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Fastline Supercars'
  wb.created = new Date()
  const ws = wb.addWorksheet('Rezerwacje', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  })

  ws.columns = COLS.map((c) => ({ width: c.width }))
  const lastCol = COLS.length

  // --- wiersz 1: pasek marki (czarny) ---
  ws.mergeCells(1, 1, 1, lastCol)
  const brand = ws.getCell(1, 1)
  brand.value = '   FASTLINE SUPERCARS'
  brand.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  brand.alignment = { vertical: 'middle', horizontal: 'left' }
  brand.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } }
  ws.getRow(1).height = 40

  if (logoBuffer) {
    try {
      const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
      ws.addImage(logoId, { tl: { col: lastCol - 1.9, row: 0.2 }, ext: { width: 150, height: 32 } })
    } catch { /* logo opcjonalne */ }
  }

  // --- wiersz 2: akcent czerwony (cienki) ---
  ws.mergeCells(2, 1, 2, lastCol)
  ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
  ws.getRow(2).height = 4

  // --- wiersz 3: podtytuł (kontekst filtra) ---
  ws.mergeCells(3, 1, 3, lastCol)
  const sub = ws.getCell(3, 1)
  const parts = ['Rezerwacje']
  if (meta.filterLabel) parts.push(meta.filterLabel)
  if (meta.dateLabel) parts.push(meta.dateLabel)
  sub.value = `   ${parts.join('  ·  ')}   —   ${rows.length} poz.   ·   wygenerowano ${plDateTime(new Date().toISOString())}`
  sub.font = { name: 'Arial', size: 10, color: { argb: 'FF555555' } }
  sub.alignment = { vertical: 'middle', horizontal: 'left' }
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } }
  ws.getRow(3).height = 22

  // --- wiersz 4: nagłówki tabeli ---
  const headRow = ws.getRow(4)
  COLS.forEach((c, i) => {
    const cell = headRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLACK } }
    cell.alignment = { vertical: 'middle', horizontal: c.key === 'lp' || c.key === 'laps' ? 'center' : 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: RED } } }
  })
  headRow.height = 26

  // --- dane ---
  rows.forEach((b, idx) => {
    const ev = b.events || {}
    const r = ws.getRow(5 + idx)
    const vals = {
      lp: idx + 1,
      name: b.name || '',
      email: b.email || '',
      phone: b.phone || '',
      voucher: b.voucher_code || '',
      termin: ev.title || '',
      tor: ev.track || '',
      data: ev.event_date ? plDate(ev.event_date) : '',
      godzina: b.custom_time || ev.time_text || '',
      car: b.car_name || '',
      laps: b.laps || '',
      status: STATUS_PL[b.status] || b.status || '',
      created: b.created_at ? plDateTime(b.created_at) : '',
      note: b.admin_note || '',
    }
    COLS.forEach((c, i) => {
      const cell = r.getCell(i + 1)
      cell.value = vals[c.key]
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1A1A1A' } }
      cell.alignment = { vertical: 'middle', horizontal: c.key === 'lp' || c.key === 'laps' ? 'center' : 'left', wrapText: c.key === 'note' || c.key === 'termin' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } },
      }
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_BG } }
    })
    // status na kolor
    const stCol = COLS.findIndex((c) => c.key === 'status') + 1
    const st = r.getCell(stCol)
    st.font = { name: 'Arial', size: 10, bold: true, color: { argb: STATUS_COLOR[b.status] || 'FF1A1A1A' } }
  })

  // autofiltr na nagłówkach
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, 4 + rows.length), column: lastCol } }
  return wb
}

async function fetchLogo() {
  try {
    const res = await fetch('logo.png')
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export async function exportBookingsXlsx(rows, meta = {}) {
  const ExcelJS = (await import('exceljs')).default
  const logoBuffer = await fetchLogo()
  const wb = buildBookingsWorkbook(ExcelJS, rows, meta, logoBuffer)

  const dateSlug = (meta.dateSlug || 'wszystkie').replace(/[^\w-]+/g, '-')
  const filename = `rezerwacje-fastline-${dateSlug}-${todayISO()}.xlsx`

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

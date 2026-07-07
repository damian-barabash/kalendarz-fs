import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ---------- Toasty ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const push = useCallback((msg, kind = '') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined}>
        <button className="x" onClick={onClose} aria-label="Zamknij">×</button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

// ---------- Potwierdzenie ----------
export function Confirm({ text, confirmLabel = 'Usuń', onYes, onNo }) {
  return (
    <Modal title="Potwierdzenie" onClose={onNo}>
      <p style={{ margin: '0 0 4px' }}>{text}</p>
      <div className="modal-btns">
        <button className="btn grey" onClick={onNo}>Anuluj</button>
        <button className="btn" onClick={onYes}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}

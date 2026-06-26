// Componentes de UI reutilizables y pequeños iconos SVG.
import { useIdioma } from '../context/IdiomaContext'

export function Cargando({ texto }) {
  const { t } = useIdioma()
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-oliva-oscuro">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-salvia/40 border-t-oliva" />
      <p className="font-bold">{texto || t('common.cargando')}</p>
    </div>
  )
}

export function Avatar({ icono, nombre, size = 'md', activo = false }) {
  const sizes = {
    sm: 'h-8 w-8 text-lg',
    md: 'h-11 w-11 text-2xl',
    lg: 'h-16 w-16 text-4xl',
    xl: 'h-24 w-24 text-6xl',
  }
  return (
    <div
      title={nombre}
      className={`flex shrink-0 items-center justify-center rounded-full bg-salvia-claro/60 ${
        sizes[size]
      } ${activo ? 'ring-4 ring-oliva' : ''}`}
    >
      <span>{icono || '🙂'}</span>
    </div>
  )
}

export function Modal({ abierto, onCerrar, titulo, children }) {
  if (!abierto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="fade-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-crema-claro p-5 shadow-tarjeta sm:rounded-3xl"
        style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-crema-oscuro sm:hidden" />
        {titulo && <h2 className="mb-4 text-xl font-bold text-bosque">{titulo}</h2>}
        {children}
      </div>
    </div>
  )
}

// Bloque de carga reutilizable. `className` define forma/tamaño (alto, ancho, radio).
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

// Skeleton con forma de tarjeta, para listas mientras llegan los datos de Firestore.
export function SkeletonTarjetas({ filas = 3 }) {
  const { t } = useIdioma()
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t('common.cargando')}>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="tarjeta flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded-lg" />
            <Skeleton className="h-3 w-1/3 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-20 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

export function Vacio({ emoji = '🌱', titulo, texto }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 bg-crema-claro/60 px-6 py-12 text-center">
      <span className="text-5xl">{emoji}</span>
      <p className="text-lg font-bold text-bosque">{titulo}</p>
      {texto && <p className="text-sm text-oliva-oscuro/80">{texto}</p>}
    </div>
  )
}

// ─── Iconos (SVG con currentColor) ───
const ic = 'h-6 w-6'
export function IconoTareas({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
export function IconoCampana({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
export function IconoCasa({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      {/* Casa rellena; la puerta es un hueco (fill-rule evenodd) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.5 2.5 10.25V20a2 2 0 0 0 2 2H19.5a2 2 0 0 0 2-2v-9.75L12 2.5Zm-1.5 19.5V15a1.5 1.5 0 0 1 3 0v7h-3Z"
      />
    </svg>
  )
}
export function IconoCompra({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
export function IconoGym({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5l11 11" />
      <path d="M21 21l-1-1" />
      <path d="M3 3l1 1" />
      <path d="M18 22l4-4" />
      <path d="M2 6l4-4" />
      <path d="M3 10l7-7" />
      <path d="M14 21l7-7" />
    </svg>
  )
}
export function IconoAjustes({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
export function IconoSol({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}
export function IconoLuna({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
export function IconoMas({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
export function IconoFlecha({ className = ic, dir = 'left' }) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
export function IconoPapelera({ className = ic }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

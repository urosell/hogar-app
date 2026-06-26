import { createContext, useContext, useEffect, useState } from 'react'
import { traducir, IDIOMA_POR_DEFECTO } from '../data/i18n'

// Idioma de la interfaz: 'es' (español) | 'ca' (català).
const IdiomaContext = createContext({
  idioma: IDIOMA_POR_DEFECTO,
  setIdioma: () => {},
  t: (clave) => clave,
})

function idiomaInicial() {
  try {
    const guardado = localStorage.getItem('idioma')
    if (guardado === 'es' || guardado === 'ca') return guardado
  } catch {
    /* ignore */
  }
  return IDIOMA_POR_DEFECTO
}

export function IdiomaProvider({ children }) {
  const [idioma, setIdiomaState] = useState(idiomaInicial)

  useEffect(() => {
    document.documentElement.lang = idioma
    try {
      localStorage.setItem('idioma', idioma)
    } catch {
      /* ignore */
    }
  }, [idioma])

  const setIdioma = (i) => setIdiomaState(i === 'ca' ? 'ca' : 'es')
  const t = (clave, params) => traducir(idioma, clave, params)

  return <IdiomaContext.Provider value={{ idioma, setIdioma, t }}>{children}</IdiomaContext.Provider>
}

export function useIdioma() {
  return useContext(IdiomaContext)
}

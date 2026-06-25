import { createContext, useContext, useEffect, useState } from 'react'

// Tema visual: 'night' (Marvie dark, por defecto) | 'day' (gris claro).
const ThemeContext = createContext({ theme: 'night', toggle: () => {}, setTheme: () => {} })

// Color de la barra del navegador/estado por tema.
const META_COLOR = { night: '#19282F', day: '#EDEFF2' }

function aplicarTema(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', META_COLOR[theme] || META_COLOR.night)
}

function temaInicial() {
  try {
    const guardado = localStorage.getItem('tema')
    if (guardado === 'day' || guardado === 'night') return guardado
  } catch {
    /* ignore */
  }
  return 'night'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(temaInicial)

  useEffect(() => {
    aplicarTema(theme)
    try {
      localStorage.setItem('tema', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const setTheme = (t) => setThemeState(t === 'day' ? 'day' : 'night')
  const toggle = () => setThemeState((t) => (t === 'day' ? 'night' : 'day'))

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

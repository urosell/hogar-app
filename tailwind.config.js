/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Tema "Marvie": dark mode (navy) con acento verde menta y coral.
        // Se conservan los NOMBRES de tokens originales para no reescribir
        // todas las clases; solo cambian los valores.
        // crema → superficies oscuras (fondo app, tarjetas, bordes)
        crema: {
          DEFAULT: '#19282F', // fondo de la app (navy)
          claro: '#22333C', // tarjetas e inputs
          oscuro: '#2A3D47', // bordes y fondos secundarios
        },
        // salvia → acento menta / tinte de chip / texto atenuado
        salvia: {
          DEFAULT: '#3DD598', // menta (bordes de acento, spinner)
          claro: '#2C4A43', // tinte menta oscuro para chips/avatares
          oscuro: '#92A0AC', // texto atenuado / placeholder / nav inactiva
        },
        // oliva → primario (botones, activos). oscuro = texto atenuado (uso mayoritario)
        oliva: {
          DEFAULT: '#3DD598', // menta
          claro: '#5CE0AC',
          oscuro: '#92A0AC', // (text-oliva-oscuro = muted; hover de botón via opacity)
        },
        // bosque → texto principal (claro sobre fondo oscuro)
        bosque: '#FFFFFF',
        // marrón → acento coral cálido (eliminar, badges, avisos)
        marron: {
          DEFAULT: '#FF575F',
          claro: '#FF8A8F',
          oscuro: '#FF7A80',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        suave: '0 2px 12px rgba(0, 0, 0, 0.25)',
        tarjeta: '0 8px 28px rgba(0, 0, 0, 0.38)',
      },
      borderRadius: {
        xl2: '1.5rem',
      },
    },
  },
  plugins: [],
}

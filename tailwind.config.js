/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens temáticos: los valores viven en variables CSS (ver index.css),
        // con dos temas — 'night' (Marvie dark, por defecto) y 'day' (gris claro).
        // El formato rgb(var(--x) / <alpha-value>) mantiene los modificadores de
        // opacidad de Tailwind (bg-crema/90, etc.).
        crema: {
          DEFAULT: 'rgb(var(--crema) / <alpha-value>)',
          claro: 'rgb(var(--crema-claro) / <alpha-value>)',
          oscuro: 'rgb(var(--crema-oscuro) / <alpha-value>)',
        },
        salvia: {
          DEFAULT: 'rgb(var(--salvia) / <alpha-value>)',
          claro: 'rgb(var(--salvia-claro) / <alpha-value>)',
          oscuro: 'rgb(var(--salvia-oscuro) / <alpha-value>)',
        },
        oliva: {
          DEFAULT: 'rgb(var(--oliva) / <alpha-value>)',
          claro: 'rgb(var(--oliva-claro) / <alpha-value>)',
          oscuro: 'rgb(var(--oliva-oscuro) / <alpha-value>)',
        },
        bosque: 'rgb(var(--bosque) / <alpha-value>)',
        marron: {
          DEFAULT: 'rgb(var(--marron) / <alpha-value>)',
          claro: 'rgb(var(--marron-claro) / <alpha-value>)',
          oscuro: 'rgb(var(--marron-oscuro) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        suave: 'var(--shadow-suave)',
        tarjeta: 'var(--shadow-tarjeta)',
      },
      borderRadius: {
        xl2: '1.5rem',
      },
    },
  },
  plugins: [],
}

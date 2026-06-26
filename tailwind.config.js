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
        // Nunito para texto, Fraunces (serif) para títulos. Se cargan en index.html.
        sans: ['Nunito', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      // Escala de tamaños reducida ~1px respecto al default de Tailwind
      // (texto un poco más pequeño, sin tocar el espaciado/layout).
      fontSize: {
        xs: ['0.625rem', { lineHeight: '0.95rem' }], // 10px
        sm: ['0.75rem', { lineHeight: '1.15rem' }], // 12px
        base: ['0.875rem', { lineHeight: '1.4rem' }], // 14px
        lg: ['1rem', { lineHeight: '1.6rem' }], // 16px
        xl: ['1.125rem', { lineHeight: '1.6rem' }], // 18px
        '2xl': ['1.3125rem', { lineHeight: '1.8rem' }], // 21px
        '3xl': ['1.5625rem', { lineHeight: '2rem' }], // 25px
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

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta terrenal verdosa
        crema: {
          DEFAULT: '#F5F1E8',
          claro: '#FAF7F0',
          oscuro: '#EAE3D2',
        },
        salvia: {
          DEFAULT: '#A3B18A',
          claro: '#C2CBAD',
          oscuro: '#8A9A6E',
        },
        oliva: {
          DEFAULT: '#588157',
          claro: '#6B9A69',
          oscuro: '#3A5A40',
        },
        bosque: '#344E41',
        marron: {
          DEFAULT: '#9C7A54',
          claro: '#B89B76',
          oscuro: '#7A5E3E',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        suave: '0 2px 12px rgba(52, 78, 65, 0.08)',
        tarjeta: '0 4px 20px rgba(52, 78, 65, 0.10)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}

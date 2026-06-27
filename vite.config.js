import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// La base se controla con VITE_BASE_PATH para que el build funcione en GitHub Pages.
// Para un repo llamado "hogar-app" la base debe ser "/hogar-app/".
// En local (npm run dev) se usa "/".
const base = process.env.VITE_BASE_PATH || '/hogar-app/'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : base,
  // El watcher de Vite peta (EBUSY) en Windows al vigilar los assets sueltos
  // mientras se copian/guardan. No necesitan hot-reload, así que los ignoramos.
  server: {
    watch: {
      ignored: ['**/assets/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-app': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'firebase-messaging': ['firebase/messaging'],
          recharts: ['recharts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El SW de FCM (firebase-messaging-sw.js) vive en /public y se registra aparte.
      // Le decimos a Workbox que no lo reclame para evitar conflictos de scope.
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.svg'],
      manifest: {
        name: 'Hogar — Gestión del hogar compartido',
        short_name: 'Hogar',
        description: 'Tareas de casa, lista de la compra y contador de gym para dos.',
        theme_color: '#19282F',
        background_color: '#19282F',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/firebase-messaging-sw\.js$/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
}))

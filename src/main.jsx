import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { IdiomaProvider } from './context/IdiomaContext'
import { registrarSwFcm } from './firebase/messaging'
import './index.css'

// Registra el Service Worker de FCM (el de la PWA lo gestiona vite-plugin-pwa).
registrarSwFcm()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <IdiomaProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </IdiomaProvider>
    </ThemeProvider>
  </React.StrictMode>
)

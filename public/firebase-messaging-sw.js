/* Service Worker de Firebase Cloud Messaging (notificaciones en segundo plano).
   Independiente del SW de la PWA generado por vite-plugin-pwa.
   La config de Firebase (pública) llega por query string desde messaging.js. */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js')

const params = new URL(self.location).searchParams
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
}

if (firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {}
    const d = payload.data || {}
    const titulo = n.title || d.title || 'Hogar'
    const opciones = {
      body: n.body || d.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: d,
    }
    // Recordatorios: el aviso se re-envía; con un `tag` fijo cada nuevo aviso
    // REEMPLAZA al anterior (no se apilan) y `renotify` hace que vuelva a sonar.
    if (d.tag) {
      opciones.tag = d.tag
      opciones.renotify = true
    }
    // En Android mantiene el aviso fijo hasta que se interactúa (iOS lo ignora).
    if (d.requireInteraction === '1') opciones.requireInteraction = true

    // Badge en el icono de la app (globito): señal silenciosa que persiste hasta
    // confirmar. Soportado en PWA instalada (iOS 16.4+ / Android).
    if (d.badge && 'setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(Number(d.badge) || 1).catch(() => {})
    }

    self.registration.showNotification(titulo, opciones)
  })
}

// Al tocar la notificación, enfoca/abre la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('./')
    })
  )
})

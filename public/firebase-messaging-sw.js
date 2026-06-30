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

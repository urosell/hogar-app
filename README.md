# 🏡 Hogar — Gestión del hogar compartido (PWA)

App para dos personas que comparten casa. Tres módulos:

- **✅ Tareas de casa** — gamificadas, con sistema de puntos, aprobación de tareas y tareas recurrentes.
- **🛒 Lista de la compra** — varias listas, categorías, historial y sugerencias de productos frecuentes.
- **💪 Contador de gym** — registro diario, calendario mensual, contadores y gráfico histórico.

Datos en tiempo real para ambos usuarios (Firestore), login con Google, notificaciones push (FCM) e instalable como PWA en Android e iOS.

---

## 🧱 Stack

React + Vite · Tailwind CSS · Firebase (Auth + Firestore + Cloud Messaging) · Recharts · vite-plugin-pwa · GitHub Pages.

---

## 🚀 Puesta en marcha (local)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el proyecto Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto.
2. **Authentication** → pestaña *Sign-in method* → habilita **Google**.
3. **Firestore Database** → crea la base de datos (modo producción).
4. **Project settings** (⚙️) → *Tus apps* → añade una app **Web** (`</>`). Copia el objeto `firebaseConfig`.
5. **Cloud Messaging** → *Certificados push web* → genera/copia la **clave VAPID**.

### 3. Variables de entorno

Copia `.env.example` a `.env` y rellena con tus valores:

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

### 4. Arrancar

```bash
npm run dev
```

Abre la URL que indique Vite (normalmente `http://localhost:5173`).

> El primer usuario **crea un hogar** y obtiene un código. El segundo se une introduciendo ese código. Luego cada uno configura su nombre y avatar.

---

## 🔒 Reglas de seguridad de Firestore

El repo incluye `firestore.rules`. Despliégalas con la [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # selecciona tu proyecto
firebase deploy --only firestore:rules
```

Resumen de la política: cada usuario solo accede a su propio perfil y al de su
compañero de hogar, y solo los miembros de un hogar pueden leer/escribir sus
tareas, listas, gym y eventos.

---

## 🔔 Notificaciones push (Cloud Functions)

El **cliente no envía** pushes: escribe un *evento* en
`hogares/{hogarId}/eventos`. Una Cloud Function (en `functions/`) lo procesa,
comprueba las preferencias del destinatario y envía el push a sus tokens FCM.

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

> Requiere el plan **Blaze** de Firebase (las Functions Gen 2 lo necesitan).
> Sin desplegar las Functions, la app funciona igual; solo no llegan los pushes
> (las notificaciones en primer plano sí se muestran como banner).

El Service Worker de FCM está en `public/firebase-messaging-sw.js` y recibe la
config (pública) por query string, por lo que **no hay que editarlo a mano**.

---

## 📲 Instalar como app (PWA)

- **Android (Chrome):** menú ⋮ → *Instalar aplicación* / *Añadir a pantalla de inicio*.
- **iOS (Safari):** botón compartir → *Añadir a pantalla de inicio*.

Funciona offline (la shell se cachea) gracias al Service Worker.

---

## ☁️ Despliegue en GitHub Pages

1. Crea un repo en GitHub llamado **`hogar-app`** y sube el código.
   - Si lo llamas distinto, no hace falta tocar nada: el workflow usa el nombre
     del repo como base path automáticamente.
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En **Settings → Secrets and variables → Actions** crea estos *secrets*:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`.
4. Haz push a `main`: el workflow `.github/workflows/deploy.yml` compila y publica.
5. En Firebase → **Authentication → Settings → Dominios autorizados**, añade
   `TU_USUARIO.github.io` para que funcione el login con Google.

---

## 🗂️ Estructura del proyecto

```
src/
  firebase/
    config.js            Inicialización de Firebase (lee .env)
    firebaseService.js   TODA la lógica de Firestore/Auth (capa de servicio)
    messaging.js         Tokens FCM y mensajes en primer plano
    notificaciones.js    Cola de eventos para los pushes
  context/
    AppContext.jsx       Estado global: auth, usuario, hogar, miembros (tiempo real)
  components/
    BottomNav.jsx        Barra de navegación inferior
    ui.jsx               Componentes e iconos reutilizables
  pages/
    Login.jsx  OnboardingHogar.jsx  OnboardingPerfil.jsx
    Tareas.jsx  Compra.jsx  Gym.jsx  Ajustes.jsx  AvisoConfig.jsx
  data/
    constantes.js        Avatares y categorías
functions/               Cloud Function de notificaciones (opcional)
public/
  firebase-messaging-sw.js   Service Worker de FCM
  icons/                     Iconos de la PWA
firestore.rules          Reglas de seguridad
```

### Modelo de datos (Firestore)

```
usuarios/{uid}
  email, nombre, icono, hogarId, puntos, puntosGastados,
  objetosDesbloqueados[], notificaciones{tareas,compra,gym}, fcmTokens[]

hogares/{hogarId}
  codigo, miembros[], creadoPor, creadoEn
  ├─ tareas/{id}        nombre, periodicidadDias, puntos, estado,
  │                     creadaPor, aprobadaPor, proximaAparicion,
  │                     ultimoCompletadoPor, ultimoCompletadoFecha
  ├─ listas/{id}        nombre, creadaPor, creadaEn
  │   └─ items/{id}     nombre, categoria, anadidoPor, comprado, compradoPor, compradoEn
  ├─ productosFrecuentes/{id}   clave, nombre, categoria, vecesUsado
  ├─ gym/{YYYY-MM-DD}   asistentes[], fecha
  └─ eventos/{id}       tipo, titulo, cuerpo, deUid, procesado, creadoEn
```

> **Extensibilidad (marketplace futuro):** el usuario ya tiene `puntosGastados`
> y `objetosDesbloqueados[]` reservados. Los puntos son acumulativos y nunca se
> resetean; el saldo disponible será `puntos - puntosGastados`.

---

## 📜 Scripts

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (`dist/`) |
| `npm run preview` | Sirve el build localmente |
| `node scripts/gen-icons.mjs` | Regenera los iconos de la PWA |

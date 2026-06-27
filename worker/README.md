# hogar-push — Worker de notificaciones

Cloudflare Worker que envía las notificaciones push (FCM) de la app Hogar.
Sustituye a la Cloud Function de Firebase para **no depender del plan Blaze**:
es gratis y no requiere tarjeta.

## Cómo funciona

1. La PWA, al completar una tarea o marcar gym, hace `POST` a este Worker con
   los tokens FCM del compañero y el texto de la notificación.
2. El Worker firma con la **service account de Firebase** (que vive aquí como
   secret, nunca en el cliente), pide un access token y manda el push vía la
   API FCM HTTP v1.
3. El compañero recibe la notificación aunque tenga la app cerrada.

## Setup (una sola vez)

### 1. Descargar la service account de Firebase

Consola Firebase → ⚙ **Configuración del proyecto** → pestaña **Cuentas de
servicio** → **Generar nueva clave privada**. Se descarga un `.json`.

### 2. Crear cuenta de Cloudflare e iniciar sesión

```bash
cd worker
npx wrangler login        # abre el navegador (cuenta gratuita, sin tarjeta)
```

### 3. Subir los secrets

```bash
# Pega TODO el contenido del .json de la service account cuando lo pida:
npx wrangler secret put SERVICE_ACCOUNT

# Inventa una cadena cualquiera (debe coincidir con VITE_PUSH_SECRET del .env):
npx wrangler secret put PUSH_SECRET
```

### 4. Desplegar

```bash
npx wrangler deploy
```

Wrangler imprime la URL pública del Worker, p.ej.:
`https://hogar-push.<tu-subdominio>.workers.dev`

### 5. Conectar la app

En el `.env` de la raíz del proyecto:

```
VITE_PUSH_ENDPOINT=https://hogar-push.<tu-subdominio>.workers.dev
VITE_PUSH_SECRET=<el mismo valor que pusiste en PUSH_SECRET>
```

Reinicia `npm run dev` para que Vite recoja las variables.

## Notas

- Enviar mensajes FCM es **gratis** también en el plan Spark de Firebase; solo
  las Cloud Functions exigían Blaze.
- El `PUSH_SECRET` viaja en el bundle del cliente (no es secreto fuerte): solo
  evita el spam casual del endpoint. Para algo más estricto se podría verificar
  el ID token de Firebase en el Worker.

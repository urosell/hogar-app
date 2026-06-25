# Prompt para Claude Code — App de Gestión del Hogar (PWA)

## Descripción general

Crea una PWA (Progressive Web App) de gestión del hogar compartido para dos personas. La app tiene tres módulos principales accesibles mediante una barra de navegación inferior: **Tareas de Casa** (gamificado), **Lista de la Compra** y **Contador de Gym**. Ambos usuarios comparten los mismos datos en tiempo real.

## Stack técnico

- **Frontend:** React + Vite + Tailwind CSS
- **Backend/Base de datos:** Firebase Firestore (tiempo real)
- **Autenticación:** Firebase Authentication con Google Sign-In
- **Notificaciones push:** Firebase Cloud Messaging (FCM)
- **Despliegue:** GitHub Pages (configurar Vite para funcionar con GitHub Pages)
- **PWA:** Service Worker + manifest.json para instalación en pantalla de inicio

## Diseño visual

- Estilo mobile-first, limpio y funcional
- Paleta de colores en tonos terrenales verdosos (verde oliva, verde salvia, crema, marrón suave)
- Barra inferior con 3 iconos/tabs: Tareas, Compra, Gym
- Tipografía legible, botones grandes táctiles, espaciado generoso
- Transiciones suaves entre tabs

---

## Sistema de autenticación y hogar

### Login
- Login con cuenta de Google mediante Firebase Auth
- Tras el primer login, flujo de onboarding

### Creación de hogar
- El primer usuario que entra puede **crear un hogar**, lo cual genera un **código de invitación** alfanumérico único
- Se le muestra el código para que lo comparta con su pareja

### Unirse a un hogar
- El segundo usuario introduce el código de invitación para unirse al hogar existente

### Perfil de usuario
- Al entrar por primera vez (tras crear o unirse a un hogar), cada usuario configura su perfil:
  - **Nombre** (texto libre)
  - **Icono/avatar** (seleccionar de una galería de iconos predefinidos)
- Estos datos se almacenan en Firestore asociados al usuario y al hogar

### Estructura Firestore sugerida
```
hogares/{hogarId}/
  codigo: string
  miembros: [uid1, uid2]
  
usuarios/{uid}/
  nombre: string
  icono: string
  hogarId: string
  puntos: number
  notificaciones: {
    tareas: boolean,
    compra: boolean,
    gym: boolean
  }
```

---

## Módulo 1: Tareas de Casa (gamificado)

### Listado de tareas
- Pantalla principal con las tareas activas (pendientes de hacer)
- Cada tarea muestra: nombre, puntos que otorga, días restantes hasta que vuelva a aparecer (si es periódica), y quién la hizo por última vez
- Cuando un usuario completa una tarea, la marca como hecha, se le suman los puntos, y:
  - Si es **periódica**: desaparece de la lista activa y reaparece automáticamente tras X días
  - Si es **definitiva** (una sola vez): desaparece permanentemente

### Creación de tareas
- Cualquier usuario puede proponer una tarea nueva con estos campos:
  - **Nombre** de la tarea (texto)
  - **Periodicidad**: definitiva (una vez) o recurrente cada X días
  - **Puntos** que otorga al completarla
- Al crear una tarea, queda en estado **pendiente de aprobación**
- La otra persona del hogar recibe una notificación y debe **aprobar o rechazar** la tarea
- Solo tras la aprobación de ambos la tarea entra en el listado activo
- Incluir una pantalla o sección de "tareas pendientes de aprobar"

### Sistema de puntos
- Cada usuario acumula puntos al completar tareas
- Los puntos se muestran visibles en la pantalla de tareas (por ejemplo, una barra superior con "Umbert: 45 pts | María: 62 pts")
- Los puntos son acumulativos (no se resetean)
- **Preparar la arquitectura para un futuro marketplace**: los puntos podrán canjearse por objetos decorativos para personalizar una "sala virtual" de cada usuario. No implementar el marketplace ahora, pero diseñar el modelo de datos para que sea extensible (campo de puntos gastados, colección de objetos desbloqueados, etc.)

### Estructura Firestore sugerida
```
hogares/{hogarId}/tareas/{tareaId}/
  nombre: string
  periodicidadDias: number | null  (null = definitiva)
  puntos: number
  estado: "pendiente_aprobacion" | "activa" | "completada"
  creadaPor: uid
  aprobadaPor: uid | null
  proximaAparicion: timestamp | null
  ultimoCompletadoPor: uid | null
  ultimoCompletadoFecha: timestamp | null
```

---

## Módulo 2: Lista de la Compra

### Múltiples listas
- Los usuarios pueden crear **varias listas** (ej: "Compra semanal", "Cena del sábado", "Fiesta cumpleaños")
- Cada lista tiene un nombre y se muestra en una vista de selección
- Se puede eliminar una lista completa

### Ítems de la lista
- Cada ítem tiene:
  - **Nombre** del producto
  - **Categoría** (atributo seleccionable: Fruta, Verdura, Carne, Pescado, Lácteos, Congelados, Limpieza, Higiene, Otros — categorías predefinidas)
  - **Añadido por**: se registra automáticamente quién lo añadió
- Se puede **filtrar/agrupar** la lista por categoría para ver, por ejemplo, solo lo de fruta o solo lo de limpieza

### Flujo de compra
- Al tachar un ítem (marcarlo como comprado), se mueve a un **historial** de esa lista
- El historial es consultable dentro de cada lista

### Productos frecuentes
- El sistema detecta productos que se han añadido varias veces y los ofrece como **sugerencias rápidas** al añadir un nuevo ítem
- Implementar como una lista de "favoritos" o "frecuentes" accesible con un botón para añadir rápidamente sin reescribir

### Estructura Firestore sugerida
```
hogares/{hogarId}/listas/{listaId}/
  nombre: string
  creadaPor: uid
  creadaEn: timestamp

hogares/{hogarId}/listas/{listaId}/items/{itemId}/
  nombre: string
  categoria: string
  añadidoPor: uid
  comprado: boolean
  compradoPor: uid | null
  compradoEn: timestamp | null

hogares/{hogarId}/productosFrecuentes/{productoId}/
  nombre: string
  categoria: string
  vecesUsado: number
```

---

## Módulo 3: Contador de Gym

### Registro diario
- Pantalla principal con la **fecha de hoy** y dos botones grandes, uno para cada usuario (mostrando la inicial o icono de cada uno)
- Al pulsar su botón, el usuario marca que ha ido al gym ese día
- Se puede desmarcar si fue un error
- El botón de cada usuario se muestra claramente activo/inactivo para ver de un vistazo si ya has marcado hoy

### Vista de calendario mensual
- Calendario del mes actual en formato cuadrícula (lunes a domingo)
- En cada día del calendario se muestran los iconos/iniciales de quienes fueron al gym ese día
- Navegación para ver meses anteriores

### Contadores
- **Contador semanal**: en la parte inferior del calendario o en una sección visible, mostrar cuántas veces ha ido cada persona esta semana (lunes a domingo)
- **Contador mensual**: mostrar cuántas veces ha ido cada persona este mes
- Al acabar el mes, el contador mensual se resetea automáticamente (los datos persisten en la base de datos para el histórico)

### Gráfico histórico
- Un módulo/sección con un **gráfico de barras o líneas** que muestra, para cada mes, cuántas veces ha ido cada persona al gym
- Usar una librería de gráficos compatible (Recharts, por ejemplo)
- El gráfico es scrollable horizontalmente si hay muchos meses

### Estructura Firestore sugerida
```
hogares/{hogarId}/gym/{fecha_YYYY-MM-DD}/
  asistentes: [uid1, uid2]  // array con los uids de quienes fueron ese día
```

---

## Notificaciones

### Configuración personalizable
- En un panel de **ajustes** (accesible desde un icono de configuración en la app), cada usuario puede activar/desactivar independientemente las notificaciones de:
  - **Tareas**: cuando la otra persona completa una tarea, cuando hay una tarea pendiente de aprobar
  - **Compra**: cuando se añade un ítem a una lista
  - **Gym**: cuando la otra persona marca que ha ido al gym

### Implementación
- Usar Firebase Cloud Messaging (FCM)
- Al enviar una notificación, comprobar primero las preferencias del usuario destinatario
- Las notificaciones deben funcionar aunque la app esté en segundo plano (requiere Service Worker)

---

## PWA — Requisitos

- **manifest.json** con nombre de la app, iconos, colores del tema (tonos verdosos), orientación portrait
- **Service Worker** para:
  - Cacheo de assets para funcionamiento offline básico (la shell de la app carga aunque no haya conexión)
  - Recepción de notificaciones push en segundo plano
- La app debe ser instalable desde el navegador tanto en Android como en iOS (Safari → Añadir a pantalla de inicio)

---

## Configuración de despliegue

- Configurar Vite para que el build funcione en GitHub Pages (base URL correcta)
- Incluir el workflow de GitHub Actions para despliegue automático si es posible
- El repositorio se llamará algo tipo `hogar-app`

---

## Notas de arquitectura

- Toda la lógica de Firestore debe estar abstraída en un servicio (`firebaseService.js` o similar) para no acoplar los componentes directamente a Firebase
- Usar listeners en tiempo real de Firestore (`onSnapshot`) para que los cambios de un usuario se reflejen instantáneamente en el dispositivo del otro
- Diseñar el modelo de datos pensando en la extensibilidad futura (marketplace de puntos, objetos decorativos, más módulos)
- Responsive y mobile-first, pero que sea usable en tablet también

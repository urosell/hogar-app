# Módulo 4: Marketplace de Recompensas

## Navegación

- Añadir una cuarta tab en la barra inferior: Marketplace (icono de tienda o regalo)
- La barra inferior pasa a tener 4 tabs: Tareas, Compra, Gym, Marketplace

## Vista principal: Catálogo

- Grid de tarjetas en filas de 2 columnas (mobile-first)
- Cada tarjeta muestra:
  - **Icono** (seleccionado de una galería de iconos predefinidos al crear la recompensa — preparar la arquitectura para que en el futuro se pueda subir una imagen custom en lugar de icono)
  - **Nombre** de la recompensa
  - **Descripción** breve
  - **Precio** en puntos
  - **Creado por** (nombre/avatar del creador)
  - **Tipo**: badge visual indicando si es "Permanente" o "Una vez"
  - **Estado visual**: si el usuario no tiene puntos suficientes, la tarjeta se muestra atenuada/gris con el precio en rojo
- Botón de "Canjear" en cada tarjeta (deshabilitado si no hay puntos suficientes)
- Las recompensas one-time que ya han sido canjeadas desaparecen del catálogo

## Crear recompensa

- Botón flotante o superior para "Crear recompensa"
- Formulario con los campos:
  - **Nombre** (texto, obligatorio)
  - **Descripción** (texto, obligatorio)
  - **Icono** (seleccionar de galería predefinida, obligatorio)
  - **Precio en puntos** (número, obligatorio)
  - **Tipo**: Permanente (se puede canjear infinitas veces) o Una vez (desaparece tras canjearse)
- Cualquiera de los dos usuarios puede crear recompensas
- Cualquiera de los dos usuarios puede canjear cualquier recompensa (incluidas las que ha creado uno mismo)
- No requiere aprobación del otro para crear (a diferencia de las tareas)

## Flujo de canje

1. El usuario pulsa "Canjear" en una recompensa
2. Se muestra un diálogo de confirmación: "¿Canjear [nombre] por [X] puntos?"
3. Al confirmar:
   - Se restan los puntos del usuario (solo los puntos gastables, NO el nivel — el nivel es un contador acumulativo independiente que nunca decrece)
   - Se crea un registro de canje con estado **"pendiente de cumplir"**
   - Se envía notificación push a la otra persona: "[Nombre] ha canjeado [recompensa]"
   - Si la recompensa es one-time, desaparece del catálogo
4. La otra persona ve el canje pendiente y puede marcarlo como **"cumplido"**

## Sección: Canjes pendientes

- Lista visible dentro del marketplace (pestaña o sección superior) con los canjes pendientes de cumplir
- Cada canje pendiente muestra: qué recompensa, quién la canjeó, cuándo, y un botón para marcar como "cumplido"
- Solo la otra persona (no quien canjeó) puede marcar como cumplido
- Una vez cumplido, pasa a un historial

## Sistema de puntos: dos contadores separados

Esto es crítico para que el marketplace funcione sin afectar al nivel:

- **Puntos acumulados (nivel)**: suma total de todos los puntos ganados históricamente. NUNCA decrece. Determina el nivel del usuario. Se muestra en el perfil.
- **Puntos disponibles (monedero)**: puntos que se pueden gastar. Es igual a puntos acumulados MENOS puntos gastados en canjes. Se muestra en el marketplace y junto al botón de canjear.

Ejemplo: si un usuario ha ganado 500 puntos en total y ha canjeado recompensas por valor de 150, su nivel corresponde a 500 pts, pero su monedero tiene 350 pts disponibles para gastar.

## Estructura Firestore sugerida

```
hogares/{hogarId}/recompensas/{recompensaId}/
  nombre: string
  descripcion: string
  icono: string
  precio: number
  tipo: "permanente" | "una_vez"
  creadaPor: uid
  activa: boolean            // false cuando una one-time ha sido canjeada

hogares/{hogarId}/canjes/{canjeId}/
  recompensaId: string
  recompensaNombre: string   // desnormalizado para mostrar fácil
  canjeadoPor: uid
  canjeadoEn: timestamp
  precio: number             // puntos que costó (snapshot del momento)
  estado: "pendiente" | "cumplido"
  cumplidoEn: timestamp | null

usuarios/{uid}/
  puntosAcumulados: number   // total histórico, nunca decrece (= nivel)
  puntosGastados: number     // total gastado en canjes
  // puntosDisponibles = puntosAcumulados - puntosGastados (calculado en frontend)
```

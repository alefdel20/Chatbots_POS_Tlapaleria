# POS Tlapalería (PWA)

POS simple, offline-first, pensado para uso con pistola de código de barras (actúa como teclado). Incluye cola de pendientes y mock API.

## Requisitos
- Node.js 18+
- npm

## Cómo correr
```bash
npm install
npm run dev
```
Abrir `http://localhost:5173`.

## Instalar como PWA
1. Abre la app en Chrome o Edge.
2. Menú → **Instalar POS Tlapalería**.
3. La app abrirá en ventana tipo app.

## Probar offline
1. Abre la app una vez online.
2. En DevTools → Application → Service Workers, activa `Offline`.
3. La app seguirá funcionando con el catálogo cache y guardará ventas en cola.

## Funciones clave
- Escaneo rápido con autofocus permanente.
- Modo contingencia con PIN Admin (demo: `1234`).
- Deshacer última venta con PIN Admin.
- Cola de pendientes y sincronización manual.

## Mock API
Los endpoints están simulados en `src/lib/api.ts` y respetan idempotencia por `local_id`.

## Datos demo
Catálogo precargado con 10 productos (incluye granel y paquete). Se carga en IndexedDB al iniciar.

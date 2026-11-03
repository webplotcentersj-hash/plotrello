# Lector AFIP

App web instalable (PWA) para el teléfono: lee con la cámara el código de barras de facturas y
comprobantes AFIP (RG 1702), valida el dígito verificador y muestra CUIT del emisor, tipo de
comprobante, punto de venta, CAI/CAE y vencimiento (con aviso de vigente/vencido).

Es independiente de la app principal: tiene su propio `package.json` y no usa ninguna API ni base de datos.
Funciona sin conexión una vez cargada.

## Comandos

```bash
npm install
npm run dev       # desarrollo (la cámara solo anda en localhost o HTTPS)
npm run build     # genera dist/
npm run preview   # sirve dist/ en local
npm test          # tests de lectura/validación y del decodificador
npm run iconos    # regenera los íconos PNG de public/
```

## En Plot Lab

El build del monorepo (`npm run build`) publica esta app en `public/lector-afip/` y queda disponible en
**`/lector-afip/`** del mismo dominio (HTTPS en producción → la cámara funciona).

```bash
npm run build:lector-afip   # solo el lector
npm run dev:lector-afip     # puerto 5174
```

## Publicarla sola

También se puede subir el contenido de `dist/` a cualquier hosting estático **con HTTPS**
(Vercel, Netlify, GitHub Pages…). Sin HTTPS el navegador bloquea la cámara.

Instalar en el teléfono: en Chrome (Android) menú → *Instalar app*; en Safari (iPhone) *Compartir* →
*Agregar a inicio*.

## Cómo lee

- Cámara trasera en vivo. Usa el detector nativo del navegador si soporta ITF (Chrome en Android) y, si
  no, ZXing (`@zxing/library`).
- Acepta solo ITF de 40 dígitos. Una lectura con dígito verificador incorrecto o con datos improbables
  (CUIT inválido, fecha inexistente, tipo desconocido) se confirma con una segunda lectura igual.
- **Desde foto** analiza una imagen guardada y **Escribir código** valida los 40 dígitos tipeados.
- Guarda los últimos 30 códigos leídos solo en el dispositivo (`localStorage`).

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/afip.ts` | Descompone y valida el código (módulo 10, CUIT, fecha, vigencia) |
| `src/decodificador.ts` | Decodifica ITF de 40 dígitos desde píxeles (incluye giro de 90°) |
| `src/escaner.ts` | Cámara, detector nativo/ZXing, linterna y lectura de fotos |
| `src/main.ts` | Pantalla, resultado e historial |

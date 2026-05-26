# Plan comercio omnicanal Plot Center

## Objetivo

Un solo **catálogo comercial** (`articulos_empresa`), un solo **stock** (base stock / `articulos`), varios **canales de venta**, un solo **cliente** (`clientes`). El cliente físico termina siendo cliente web (misma ficha, acceso opcional).

## Canales

| Canal | Ruta / app | Compra | Cotización |
|-------|------------|--------|------------|
| Portal cliente | `/cliente/*` | Sí | Sí |
| E-commerce público | Web dedicada (futuro) | Sí | Opcional |
| Stickers / personalizar | Micrositio (futuro) | Sí | Raro |
| Tótem autogestión | `/totem/autogestion/*` | Sí | No |
| Mostrador / caja | CRM / ventas | Sí | Sí |

## Reglas de negocio

1. **Precios visibles** en canales habilitados (`precio_base` + listas futuras).
2. **Catálogo ≠ stock**: `articulos_empresa` es comercial; `articulos` (stock) es inventario. Enlace: `id_articulo_stock`.
3. **Descuento único**: toda salida pasa por `descontarStockComercial` (app) → update stock + `stock_movimientos`.
4. **Cuándo descontar**:
   - Producto `modo_venta = compra` o `ambos`: al **confirmar pedido/venta** (tótem, portal compra, caja).
   - `cotizacion`: al **aceptar presupuesto** o **convertir a OP** (fase posterior).
   - Impresión tótem (archivo): al **marcar impreso** (cola existente).
5. **Catálogo**: editan Mostrador, Presupuestos, Marketing, Admin (`canAccessMostradorViews` hoy; roles finos después).

## Modelo de datos (Fase 0–1)

### `articulos_empresa` (nuevas columnas)

| Columna | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `id_articulo_stock` | integer | null | ID en BD stock |
| `modo_venta` | text | `ambos` | `compra` \| `cotizacion` \| `ambos` |
| `controla_stock` | boolean | false | Si descuenta inventario |
| `unidades_por_venta` | numeric | 1 | Factor (ej. 1 pack = 10 hojas) |
| `visible_portal` | boolean | true | Portal `/cliente` |
| `visible_web_publica` | boolean | false | Tienda pública |
| `visible_totem` | boolean | false | Tótem catálogo |
| `visible_stickers` | boolean | false | Micrositio stickers |

`visible_clientes` se mantiene por compatibilidad; al guardar se sincroniza con `visible_portal`.

### `stock_movimientos`

| Columna | Descripción |
|---------|-------------|
| `id_pedido_cliente` | Trazabilidad pedido web/tótem |

## Fases de implementación

### Fase 0 — Fundamentos ✅

- [x] Documento de plan (este archivo)
- [x] Migración SQL columnas + `id_pedido_cliente` (MCP `comercio_omnicanal_fase0_articulos_empresa`)
- [x] Tipos TypeScript
- [x] Servicio `commerceStockService.ts`
- [x] Formulario catálogo: stock + canales + modo venta
- [x] Tótem: descontar stock al confirmar pedido

### Fase 1 — API catálogo por canal ✅

- [x] `getCatalogoComercial({ canal, busqueda, pagina })` con stock disponible
- [x] Filtros en portal y tótem por canal (no solo `visible_clientes`)
- [x] Validar stock antes de agregar al carrito (tótem / portal nuevo pedido)
- [x] Portal: descontar stock al crear pedido

### Fase 2 — Portal compra vs cotización ✅

- [x] Carrito persistente (BD: `carritos_clientes`, `carritos_clientes_items`)
- [x] Checkout `/cliente/checkout`: compra o cotización
- [x] Descontar stock solo en rama compra (`tipo_intencion` + guard en `aplicarStockDesdePedidoCliente`)

### Fase 3 — Web pública + stickers

- [ ] Storefront `/tienda` reutilizando API
- [ ] Micrositio `/stickers` con `visible_stickers`
- [ ] Checkout invitado + `buscarOCrearCliente`

### Fase 4 — Cliente universal

- [ ] `origen_primera_compra`, activación de cuenta post-compra
- [ ] Historial unificado pedidos + OP

### Fase 5 — Pagos

- [ ] Mercado Pago / seña / cuenta corriente según canal

## Criterios de aceptación Fase 0–1

1. En `/clientes-web/articulos` se puede vincular un artículo de stock y marcar canales.
2. Al confirmar pedido en tótem autogestión, si el ítem tiene `controla_stock` y `modo_venta` permite compra, el stock baja y queda movimiento con `id_pedido_cliente`.
3. Mismo stock visible desde ERP/stock y reflejado en todos los canales (una sola fuente).

## Nota técnica

El stock vive en **otra instancia Supabase** (`VITE_STOCK_SUPABASE_*`). El descuento se implementa en **aplicación** (`commerceStockService`), no en RPC SQL del proyecto principal.

## Orden de parches SQL

1. `supabase/patches/2026-05-26_comercio_omnicanal_fase0_articulos_empresa.sql`

Aplicar en Supabase (SQL editor o CLI) antes de usar las nuevas pantallas.

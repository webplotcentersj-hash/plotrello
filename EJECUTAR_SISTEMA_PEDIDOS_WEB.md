# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Pasos para configurar el sistema de pedidos web:

### 1. Crear tablas y estructura base

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_create_sistema_pedidos_web.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

### 2. Crear funciones RPC

1. En el mismo **SQL Editor**
2. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_create_funciones_pedidos_web.sql`
3. Haz clic en **RUN** o presiona `Ctrl+Enter`
4. Verifica que se crearon las funciones correctamente

### 3. Configurar Storage para archivos de pedidos

1. Ve a **Storage** en el panel de Supabase
2. Crea un nuevo bucket llamado `pedidos-clientes`
3. Configura:
   - **Public Access**: Puede estar activado o desactivado (las políticas lo manejan)
   - **File size limit**: 10MB
   - **Allowed MIME types**: image/*, application/pdf, application/zip

### 4. Crear políticas de Storage para pedidos-clientes

Ejecuta este SQL en el SQL Editor:

```sql
BEGIN;

-- Política para lectura pública
CREATE POLICY "Permitir lectura de archivos de pedidos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pedidos-clientes');

-- Política para subida de archivos (clientes autenticados)
CREATE POLICY "Permitir subida de archivos de pedidos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pedidos-clientes');

-- Política para actualización
CREATE POLICY "Permitir actualización de archivos de pedidos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pedidos-clientes')
WITH CHECK (bucket_id = 'pedidos-clientes');

-- Política para eliminación
CREATE POLICY "Permitir eliminación de archivos de pedidos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'pedidos-clientes');

COMMIT;
```

## Estructura creada:

### Tablas:
- `clientes` - Clientes que pueden hacer pedidos
- `articulos_empresa` - Catálogo de artículos/servicios
- `pedidos_clientes` - Pedidos realizados por clientes
- `pedidos_clientes_items` - Items/artículos de cada pedido
- `pedidos_clientes_archivos` - Archivos adjuntos de pedidos

### Campos agregados a `ordenes_trabajo`:
- `id_pedido_cliente` - FK al pedido que originó la OP
- `origen_pedido_web` - Boolean que indica si viene de pedido web

### Funciones RPC:
- `autenticar_cliente` - Login de clientes
- `crear_cliente` - Crear nuevo cliente (solo trabajadores)
- `crear_pedido_cliente` - Crear pedido con items
- `obtener_pedidos_cliente` - Listar pedidos de un cliente
- `obtener_detalle_pedido_cliente` - Detalle completo de un pedido
- `convertir_pedido_a_op` - Convertir pedido en OP

## Próximos pasos:

Después de ejecutar los SQL, el frontend podrá:
1. Autenticar clientes
2. Mostrar catálogo de artículos
3. Crear pedidos
4. Convertir pedidos a OPs


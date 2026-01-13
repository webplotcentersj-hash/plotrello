# Manual de Usuario - Trello Plot
## Sistema de Gestión de Producción Plot Center

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso e Inicio de Sesión](#acceso-e-inicio-de-sesión)
   - [Acceso Web](#opción-a-acceso-web-navegador)
   - [Instalación como Aplicación de Escritorio](#opción-b-instalar-como-aplicación-de-escritorio-pwa)
3. [Interfaz Principal](#interfaz-principal)
4. [Tablero Kanban](#tablero-kanban)
5. [Gestión de Órdenes de Trabajo](#gestión-de-órdenes-de-trabajo)
6. [Sistema de Chat](#sistema-de-chat)
7. [PlotAI - Asistente Inteligente](#plotai---asistente-inteligente)
8. [Estadísticas y Reportes](#estadísticas-y-reportes)
9. [Calendario](#calendario)
10. [Diagrama de Gantt](#diagrama-de-gantt)
11. [Gestión de Usuarios](#gestión-de-usuarios)
12. [Sistema de Capacitaciones](#sistema-de-capacitaciones)
13. [Sistema de Evaluaciones de Desempeño](#sistema-de-evaluaciones-de-desempeño)
14. [Sistema de Solicitudes de Permisos](#sistema-de-solicitudes-de-permisos)
15. [Sistema de Menú Diario](#sistema-de-menú-diario)
16. [Sistema de Pedidos de Compra](#sistema-de-pedidos-de-compra)
17. [Sistema de Horarios y Turnos](#sistema-de-horarios-y-turnos)
18. [Atajos de Teclado](#atajos-de-teclado)
19. [Funciones Avanzadas](#funciones-avanzadas)
20. [Solución de Problemas](#solución-de-problemas)

---

## 1. Introducción

**Trello Plot** es un sistema de gestión de producción tipo Kanban diseñado específicamente para Plot Center. Permite gestionar órdenes de trabajo (OPs) desde su creación hasta la entrega, con seguimiento en tiempo real, comunicación entre equipos y análisis de rendimiento.

### Características Principales

- ✅ **Tablero Kanban** con arrastrar y soltar (drag & drop)
- ✅ **Aplicación de escritorio** (PWA) - Instalable en Windows, Mac y Linux
- ✅ **Sincronización en tiempo real** entre usuarios
- ✅ **Chat en tiempo real** estilo Slack
- ✅ **PlotAI** - Asistente con inteligencia artificial
- ✅ **Estadísticas y reportes** avanzados
- ✅ **Calendario y diagrama de Gantt**
- ✅ **Sistema de checklist** para subtareas
- ✅ **Gestión de materiales y sectores**
- ✅ **Códigos QR** para acceso rápido
- ✅ **Auditoría completa** de movimientos
- ✅ **Sistema de Capacitaciones** para RRHH y empleados
- ✅ **Sistema de Evaluaciones de Desempeño**
- ✅ **Sistema de Solicitudes de Permisos** (turnos, vacaciones, ausencias)
- ✅ **Sistema de Menú Diario** con selección de platos
- ✅ **Sistema de Pedidos de Compra** con historial y notificaciones
- ✅ **Sistema de Horarios y Turnos** para RRHH

---

## 2. Acceso e Inicio de Sesión

### 2.1 Acceder a la Aplicación

#### Opción A: Acceso Web (Navegador)

1. Abre tu navegador web (Chrome, Firefox, Edge, Safari)
2. Navega a la URL de la aplicación
3. Serás redirigido automáticamente a la pantalla de login si no estás autenticado

#### Opción B: Instalar como Aplicación de Escritorio (PWA)

**Trello Plot** es una Progressive Web App (PWA) que puedes instalar en tu escritorio para tener acceso rápido sin necesidad de abrir el navegador cada vez.

##### Instalación en Windows (Chrome/Edge)

1. Abre la aplicación en **Google Chrome** o **Microsoft Edge**
2. Busca el icono de **instalación** en la barra de direcciones (generalmente aparece como un símbolo **+** o un icono de descarga)
3. Haz clic en **"Instalar"** o **"Instalar Trello Plot"**
4. Confirma la instalación en el diálogo que aparece
5. La aplicación se instalará en tu escritorio y aparecerá en el menú de inicio
6. Podrás abrirla como una aplicación independiente

**Ventajas de la instalación:**
- ✅ Acceso rápido desde el escritorio o menú de inicio
- ✅ Ventana independiente sin barra de direcciones del navegador
- ✅ Mejor experiencia de uso similar a una aplicación nativa
- ✅ Notificaciones del sistema funcionan mejor
- ✅ Se actualiza automáticamente cuando hay nuevas versiones

##### Instalación en Windows (Firefox)

1. Abre la aplicación en **Mozilla Firefox**
2. Haz clic en el menú (☰) → **"Instalar sitio como aplicación"**
3. Confirma la instalación
4. La aplicación se agregará a tu escritorio

##### Instalación en macOS (Safari/Chrome)

1. Abre la aplicación en **Safari** o **Chrome**
2. En Safari: Menú **Archivo** → **"Agregar a Dock"**
3. En Chrome: Haz clic en el icono de instalación en la barra de direcciones
4. La aplicación aparecerá en tu Dock o Launchpad

##### Instalación en Linux (Chrome/Edge)

1. Abre la aplicación en **Chrome** o **Edge**
2. Haz clic en el icono de instalación en la barra de direcciones
3. Confirma la instalación
4. La aplicación aparecerá en tu menú de aplicaciones

**Nota:** La aplicación instalada funciona igual que la versión web, pero con acceso más rápido y una experiencia más integrada con tu sistema operativo. Todos los datos se sincronizan automáticamente con la versión web.

### 2.2 Iniciar Sesión

1. Ingresa tu **nombre de usuario** o **email**
2. Ingresa tu **contraseña**
3. Haz clic en **"Iniciar Sesión"** o presiona `Enter`

**Nota:** Si olvidaste tu contraseña, contacta al administrador del sistema.

### 2.3 Roles de Usuario

La aplicación tiene diez roles diferentes, cada uno con permisos específicos:

#### Roles Administrativos (Acceso Completo)

- **Administración** (`administracion`): Acceso completo al sistema, incluyendo:
  - Estadísticas y reportes avanzados
  - Gestión de usuarios
  - Todas las funciones de producción
  - Configuración del sistema

- **Gerencia** (`gerencia`): Acceso administrativo completo, similar a Administración:
  - Estadísticas y reportes
  - Gestión de usuarios
  - Todas las funciones operativas

#### Roles Operativos

- **Diseño** (`diseno`): Acceso al área de diseño gráfico:
  - Crear y editar órdenes
  - Trabajar en fichas del sector Diseño
  - Usar chat y PlotAI

- **Imprenta** (`imprenta`): Acceso al área de imprenta:
  - Gestionar órdenes en proceso de impresión
  - Trabajar en fichas del sector Imprenta
  - Usar chat y herramientas de producción

- **Taller Gráfico** (`taller-grafico`): Acceso al taller gráfico:
  - Gestionar órdenes en producción gráfica
  - Trabajar en fichas del sector Taller Gráfico
  - Usar chat y herramientas de producción

- **Instalaciones** (`instalaciones`): Acceso al área de instalaciones:
  - Gestionar órdenes de instalación
  - Trabajar en fichas del sector Instalaciones
  - Coordinar trabajos de campo

- **Metalúrgica** (`metalurgica`): Acceso al área metalúrgica:
  - Gestionar órdenes de trabajos metalúrgicos
  - Trabajar en fichas del sector Metalúrgica
  - Usar herramientas de producción

- **Caja** (`caja`): Acceso al área de caja:
  - Gestionar pagos y facturación
  - Ver órdenes relacionadas con pagos
  - Usar chat para coordinación

- **Mostrador** (`mostrador`): Acceso limitado para atención al cliente:
  - Crear nuevas órdenes
  - Consultar estado de órdenes
  - Usar chat básico
  - Acceso limitado a edición de órdenes

#### Roles de Apoyo

- **Recursos Humanos** (`recursos-humanos`): Acceso a funciones de RRHH:
  - Gestión de usuarios (según permisos)
  - Visualización de estadísticas de personal
  - Coordinación de equipos

**Nota:** Los roles determinan qué sectores y funciones puedes ver y usar. Algunos roles tienen acceso restringido a ciertos sectores del tablero.

---

## 3. Interfaz Principal

### 3.1 Header (Barra Superior)

El header contiene:

- **Logo de Plot Center**: Click para volver al inicio
- **Reloj Widget**: Muestra la hora actual
- **Widget del Clima**: Condiciones climáticas actuales
- **Notificaciones** (🔔): Muestra alertas y menciones
- **Menú de Acciones** (☰): Acceso a todas las funciones principales

#### Menú de Acciones

Al hacer clic en el botón de menú (☰), verás:

- 🤖 **PlotAI**: Abre el asistente inteligente
- 💬 **Chat**: Accede al sistema de chat
- 📊 **Estadísticas**: (Solo administradores) Reportes y métricas
- 📅 **Calendario**: Vista de calendario de entregas
- 📈 **Gantt**: Diagrama de Gantt de proyectos
- 🧊 **Modo compacto**: Alterna entre vista expandida/compacta
- 👥 **Usuarios**: (Solo administradores) Gestión de usuarios
- 🛠️ **Nueva Herramienta**: Crear herramientas personalizadas
- 🔧 **Herramientas**: Enlace a herramientas externas
- 🚪 **Salir**: Cerrar sesión

### 3.2 Estadísticas del Header

Debajo del header principal verás tres tarjetas con estadísticas:

- **Movimientos hoy**: Cantidad de movimientos de fichas realizados hoy
- **Personas activas**: Usuarios que han realizado acciones recientemente
- **Squad Trello Plot**: Total de miembros del equipo

### 3.3 Barra de Filtros

La barra de filtros permite:

- **Búsqueda**: Buscar por ID de OP, título, cliente o tags
- **Filtro por Prioridad**: Todas, Alta, Media, Baja
- **Filtro por Estado**: Click en los chips de estado para enfocar
- **Botones de Acción**:
  - **+ Agregar Nueva Orden**: Crear una nueva OP
  - **🔍 Bibliotecas de OPs**: Ver todas las órdenes archivadas

### 3.4 Panel Principal

El panel principal muestra:

- **Tablero Kanban**: Columnas con las órdenes de trabajo
- **Panel de Estadísticas** (lado derecho, solo administradores)
- **Feed de Actividad** (lado derecho): Historial de movimientos recientes

---

## 4. Tablero Kanban

### 4.1 Columnas del Tablero

El tablero está organizado en las siguientes columnas (de izquierda a derecha):

1. **Diseño Gráfico** 🎨
2. **Diseño en Proceso** 🔄
3. **En Espera** ⏸️
4. **Imprenta (Área de Impresión)** 🖨️
5. **Taller de Imprenta** 🏭
6. **Taller Gráfico** ✂️
7. **Instalaciones** 🔧
8. **Metalúrgica** ⚙️
9. **Finalizado en Taller** ✅
10. **Almacén de Entrega** 📦

Cada columna muestra:
- **Nombre del estado**
- **Contador de fichas** en la parte superior
- **Barra de progreso** que indica la carga de trabajo relativa
- **Fichas (OPs)** dentro de la columna

### 4.2 Mover Fichas (Drag & Drop)

Para mover una ficha entre columnas:

1. **Haz clic y mantén presionado** sobre la ficha que deseas mover
2. **Arrastra** la ficha a la columna destino
3. **Suelta** el mouse

**Nota:** El movimiento se guarda automáticamente y se sincroniza con todos los usuarios en tiempo real.

### 4.3 Visualización de Fichas

Cada ficha muestra:

- **Número de OP** (#OP-1234)
- **Cliente/Proyecto**
- **Fecha de entrega**
- **Sector asignado** (con color identificatorio)
- **Prioridad** (indicador visual para alta prioridad)
- **Foto** (si está disponible)
- **Información de contacto** del cliente
- **Materiales** requeridos
- **Tags** (etiquetas de colores)
- **Barra de progreso**
- **Operario asignado**

### 4.4 Acciones Rápidas en Fichas

Cada ficha tiene botones de acción rápida:

- **✏️ Editar**: Abre el modal de edición
- **🗑️ Eliminar**: Elimina la orden (con confirmación)
- **🔳 QR**: Genera código QR para acceso rápido
- **📜 Auditoría**: Ver historial completo de movimientos

### 4.5 Expandir/Contraer Fichas

- **Click en "Ver detalles"**: Expande la ficha para ver toda la información
- **Click en "Ocultar detalles"**: Contrae la ficha

---

## 5. Gestión de Órdenes de Trabajo

### 5.1 Crear una Nueva Orden

#### Método 1: Botón "Agregar Nueva Orden"

1. Haz clic en el botón **"+ Agregar Nueva Orden"** en la barra de filtros
2. Completa el formulario:
   - **N° OP**: Número de orden (opcional, se genera automáticamente si se deja vacío)
   - **Cliente**: Nombre del cliente o proyecto
   - **DNI/CUIT**: Documento del cliente (opcional)
   - **Teléfono cliente**: Número de contacto
   - **Email cliente**: Correo electrónico
   - **Dirección cliente**: Dirección física
   - **Link de ubicación**: URL de Google Maps
   - **Link de Drive**: URL de carpeta en Google Drive
   - **Fecha Entrega**: Fecha comprometida
   - **Hora Estimada**: Hora aproximada de entrega
   - **Sectores**: Selecciona uno o más sectores por los que pasará la orden
   - **Operario**: Responsable asignado
   - **Complejidad**: Baja, Media, Alta
   - **Prioridad**: Normal, Alta, Media, Baja
   - **Descripción**: Detalles del trabajo a realizar
   - **Materiales**: Busca y agrega materiales del catálogo
   - **Etiquetas**: Tags personalizados (ej: "Urgente", "Cliente VIP")
   - **Archivos Adjuntos**: Sube fotos o documentos

3. Haz clic en **"Crear Orden"**

#### Método 2: Atajo de Teclado

Presiona la tecla **`C`** para abrir rápidamente el modal de creación.

#### Método 3: Desde PlotAI

Puedes crear órdenes directamente desde el chat con PlotAI usando lenguaje natural.

### 5.2 Editar una Orden Existente

1. **Haz clic en el botón ✏️** de la ficha que deseas editar
2. Se abrirá el modal de edición con todos los campos
3. Modifica los campos necesarios
4. Haz clic en **"Guardar Cambios"**

**Campos editables:**
- Todos los campos de creación
- Historial de movimientos (solo lectura)
- Comentarios (puedes agregar nuevos)

### 5.3 Agregar Comentarios

1. Abre la ficha en modo edición
2. Desplázate hasta la sección **"Comentarios"**
3. Escribe tu comentario en el área de texto
4. Haz clic en **"Agregar comentario"** o presiona `Ctrl+Enter` / `Cmd+Enter`

Los comentarios muestran:
- Nombre del usuario que comentó
- Fecha y hora del comentario
- Contenido del mensaje

### 5.4 Historial de Movimientos

Cada orden mantiene un registro completo de:

- **Cambios de estado**: De qué columna a qué columna
- **Usuario que realizó el cambio**
- **Fecha y hora** del movimiento
- **Comentarios** asociados al movimiento

Para ver el historial completo:
1. Abre la ficha en modo edición
2. Desplázate hasta **"Trazabilidad completa - Historial de movimientos"**

### 5.5 Checklist (Subtareas)

Las órdenes pueden tener subtareas (checklist):

1. Abre una ficha expandida
2. Haz clic en el botón **"☑ Checklist"**
3. Se abrirá un modal con las subtareas
4. Marca las tareas completadas
5. Agrega nuevas subtareas escribiendo y presionando `Enter`

**Indicadores visuales:**
- Un punto (●) en la ficha indica que hay subtareas pendientes
- El porcentaje de completitud se muestra en la barra de progreso

### 5.6 Marcar como Entregado

Cuando una orden llega a **"Almacén de Entrega"**:

1. Expande la ficha
2. Marca el checkbox **"✓ Entregado (Archivar)"**
3. La ficha será archivada y desaparecerá del tablero principal

**Nota:** Las fichas archivadas pueden verse en la **Biblioteca de OPs**.

### 5.7 Eliminar una Orden

1. Haz clic en el botón **🗑️** de la ficha
2. Confirma la eliminación en el diálogo
3. La orden será eliminada permanentemente

**⚠️ Advertencia:** Esta acción no se puede deshacer.

### 5.8 Generar Código QR

1. Haz clic en el botón **🔳** de cualquier ficha
2. Se generará un código QR que contiene un enlace directo a la orden
3. Puedes:
   - **Descargar** el QR como imagen PNG
   - **Abrir** el enlace en una nueva pestaña
   - **Compartir** el enlace con otros usuarios

**Uso:** Escanea el QR con tu teléfono para acceder rápidamente a la información de la orden.

---

## 6. Sistema de Chat

### 6.1 Acceder al Chat

- Haz clic en **💬 Chat** en el menú de acciones
- O navega directamente a `/chat`

### 6.2 Canales Disponibles

El sistema tiene varios canales temáticos:

- **# general**: Canal general del equipo
- **# producción**: Coordinación de producción
- **# diseño**: Diseño gráfico y creativo
- **# imprenta**: Área de imprenta
- **# instalaciones**: Equipo de instalaciones
- **# random**: Conversaciones casuales

### 6.3 Enviar Mensajes

1. Selecciona un canal del sidebar izquierdo
2. Escribe tu mensaje en el área de texto inferior
3. Presiona **Enter** para enviar o **Shift+Enter** para nueva línea
4. Haz clic en el botón **➤** para enviar

### 6.4 Mencionar Usuarios

Para mencionar a un usuario:

1. Escribe **`@`** seguido del nombre del usuario
2. Aparecerá un menú con sugerencias
3. Selecciona el usuario o continúa escribiendo para filtrar
4. El usuario mencionado recibirá una notificación

**Ejemplo:** `@Juan necesito tu ayuda con la OP-1234`

### 6.5 Adjuntar Archivos

1. Haz clic en el botón **📎** en el área de entrada
2. Selecciona uno o más archivos
3. Los archivos aparecerán como preview
4. Envía el mensaje normalmente

**Formatos soportados:** Imágenes, PDFs, documentos de texto

### 6.6 Emojis

1. Haz clic en el botón **😊** para abrir el selector de emojis
2. Haz clic en cualquier emoji para insertarlo
3. O escribe directamente emojis desde tu teclado

### 6.7 Zumbidos y Alertas

#### Enviar un Zumbido

1. Haz clic en el botón **🔔**
2. Se enviará un zumbido a otro usuario aleatorio en línea
3. El usuario recibirá una notificación y la pantalla vibrará

#### Enviar una Alerta (Sirena)

1. Haz clic en el botón **🚨**
2. Se enviará una alerta a **todos los usuarios** del canal
3. Se reproducirá un sonido de sirena
4. Todos los usuarios recibirán una notificación

**Uso:** Ideal para alertas urgentes que requieren atención inmediata.

### 6.8 Leer Mensajes

- Los mensajes se muestran en orden cronológico
- Los mensajes propios aparecen a la derecha
- Los mensajes de otros aparecen a la izquierda
- Se muestra el avatar, nombre y hora de cada mensaje
- Los mensajes con zumbidos o alertas tienen estilos especiales

### 6.9 Notificaciones del Chat

Recibirás notificaciones cuando:

- Alguien te menciona con `@tu_nombre`
- Se envía una alerta (🚨) en un canal donde estás
- Recibes un zumbido (🔔)

Las notificaciones aparecen en:
- El icono de campana (🔔) en el header
- Notificaciones del navegador (si están habilitadas)

---

## 7. PlotAI - Asistente Inteligente

### 7.1 Acceder a PlotAI

- Haz clic en **🤖 PlotAI** en el menú de acciones
- O presiona el atajo correspondiente

### 7.2 ¿Qué puede hacer PlotAI?

PlotAI es un asistente inteligente que puede:

- ✅ **Analizar el estado** de las tareas y órdenes
- ✅ **Identificar cuellos de botella** y problemas
- ✅ **Generar reportes** y estadísticas
- ✅ **Analizar archivos** que subas (imágenes, PDFs)
- ✅ **Responder preguntas** sobre el sistema
- ✅ **Sugerir optimizaciones** de flujo de trabajo
- ✅ **Crear órdenes** desde lenguaje natural

### 7.3 Hacer Preguntas

1. Escribe tu pregunta en el área de texto
2. Presiona **Enter** o haz clic en **➤**
3. PlotAI analizará el contexto del sistema y responderá

**Ejemplos de preguntas:**
- "¿Cuántas órdenes hay en Diseño Gráfico?"
- "¿Cuáles son las órdenes más urgentes?"
- "Analiza el archivo que subí y crea una orden"
- "¿Qué operario tiene más carga de trabajo?"

### 7.4 Subir Archivos para Análisis

1. Haz clic en el botón **📎**
2. Selecciona una imagen o PDF
3. Escribe una pregunta sobre el archivo
4. PlotAI analizará el contenido y responderá

**Ejemplo:** Sube una foto de un trabajo y pregunta "¿Qué materiales necesito para esto?"

### 7.5 Dictado por Voz

1. Haz clic en el botón **🎙️** (micrófono)
2. Habla tu mensaje
3. El texto se transcribirá automáticamente
4. Haz clic nuevamente para detener la grabación

**Nota:** Requiere permisos de micrófono en el navegador.

### 7.6 Panel de Inteligencia

En el panel lateral izquierdo verás:

#### Alertas Críticas
- Problemas detectados automáticamente
- Cuellos de botella
- Órdenes estancadas

#### Oportunidades
- Sugerencias de optimización
- Mejoras de proceso
- Recomendaciones

#### Acciones Agénticas
- Botones de acción rápida sugeridos por PlotAI
- Click para ejecutar análisis automáticos

#### Crear OP desde el Chat

1. Expande la sección **"Crear OP desde el chat"**
2. Completa el formulario rápido
3. Haz clic en **"Crear OP"**
4. La orden se creará sin salir del chat

### 7.7 Sugerencias Automáticas

PlotAI muestra sugerencias basadas en:

- Estado actual del tablero
- Actividad reciente
- Patrones detectados
- Métricas de rendimiento

Haz clic en cualquier sugerencia para ejecutarla automáticamente.

---

## 8. Estadísticas y Reportes

### 8.1 Acceder a Estadísticas

**Solo disponible para administradores**

- Haz clic en **📊 Estadísticas** en el menú de acciones
- O navega a `/statistics`

### 8.2 Filtros Disponibles

En la parte superior puedes filtrar por:

- **📅 Desde**: Fecha de inicio
- **📆 Hasta**: Fecha de fin
- **🏭 Sector**: Filtrar por sector específico
- **👤 Operario**: Filtrar por operario específico

### 8.3 Gráficos y Métricas

#### Órdenes por Estado
Gráfico circular (donut) mostrando la distribución de órdenes en cada estado.

#### Top 5 Clientes
Gráfico circular con los clientes que más trabajos tienen.

#### Distribución por Sector
Distribución porcentual de órdenes por sector.

#### Carga de Trabajo por Operario
Gráfico de barras mostrando cuántas órdenes tiene cada operario.

#### Movimientos por Usuario
Cantidad de movimientos realizados por cada usuario.

#### Tiempo Promedio de Reacción
Tiempo promedio que tarda cada usuario en responder a cambios.

#### Tiempo Promedio por Estado
Detección de cuellos de botella - estados donde las órdenes permanecen más tiempo.

#### Tiempo Promedio por Tipo de Orden
Ciclo de vida promedio de las órdenes.

#### Tiempo Promedio por Operario
Rendimiento individual de cada operario.

#### Registro de Actividad Cronológico
Tabla con todos los movimientos ordenados por fecha y hora.

#### Fichas Estancadas
Lista de órdenes que llevan más de 3 días en el mismo estado.

#### Lead/Cycle Time por Estado
Métricas avanzadas: mediana (p50) y percentil 90 (p90) del tiempo en cada estado.

#### Lead/Cycle Time por Operario
Métricas de rendimiento individual con percentiles.

#### Aging WIP (Work In Progress)
Distribución de tareas por tiempo en estado actual:
- 0-2 días
- 3-5 días
- 6-10 días
- 11+ días

#### Throughput Comparativo
Comparación de tareas completadas: período actual vs período anterior.

#### SLA Compliance
Cumplimiento de fechas de entrega:
- Tasa de cumplimiento (%)
- Órdenes a tiempo vs retrasadas
- Desviación promedio
- Percentiles de desviación

#### WIP por Estado
Cantidad de tareas en progreso vs límites establecidos:
- WIP actual
- Límite configurado
- Porcentaje de utilización
- Alertas cuando se supera el límite

### 8.4 Exportar Datos

Puedes exportar los datos en varios formatos:

- **⬇️ Exportar estados**: Descarga CSV con órdenes por estado
- **⬇️ Exportar tiempos**: Descarga CSV con tiempos por operario
- **⬇️ Exportar actividad**: Descarga CSV con registro de actividad
- **⬇️ PDF**: Genera un reporte completo en PDF

---

## 9. Calendario

### 9.1 Acceder al Calendario

- Haz clic en **📅 Calendario** en el menú de acciones
- O navega a `/calendario`

### 9.2 Vista de Calendario

El calendario muestra:

- **Vista mensual** con todas las fechas
- **Órdenes** marcadas en sus fechas de entrega
- **Navegación** entre meses con flechas
- **Resumen de próximas entregas** en el sidebar

### 9.3 Navegar el Calendario

- **Flecha izquierda (◀)**: Mes anterior
- **Flecha derecha (▶)**: Mes siguiente
- **Click en el mes**: Ver detalles del mes

### 9.4 Ver Detalles de una Orden

1. Haz clic en cualquier fecha que tenga órdenes
2. Se mostrará un listado de las órdenes de esa fecha
3. Haz clic en una orden para ver sus detalles

### 9.5 Próximas Entregas

El sidebar muestra:

- Órdenes con entrega en los próximos días
- Órdenes vencidas (en rojo)
- Órdenes de hoy (resaltadas)

---

## 10. Diagrama de Gantt

### 10.1 Acceder al Gantt

- Haz clic en **📈 Gantt** en el menú de acciones
- O navega a `/gantt`

### 10.2 Vista de Gantt

El diagrama muestra:

- **Barras horizontales** representando cada orden
- **Eje temporal** en la parte superior
- **Colores** según prioridad:
  - 🔴 Alta prioridad
  - 🟡 Media prioridad
  - 🟢 Baja prioridad

### 10.3 Niveles de Zoom

Puedes cambiar el nivel de zoom:

- **Semana**: Vista detallada de una semana
- **Mes**: Vista mensual (por defecto)
- **Trimestre**: Vista trimestral amplia

### 10.4 Información de las Barras

Cada barra muestra:

- **Número de OP** y nombre del cliente
- **Fecha de inicio** (creación)
- **Fecha de fin** (entrega comprometida)
- **Duración** calculada automáticamente

### 10.5 Interactuar con el Gantt

- **Scroll horizontal**: Navegar en el tiempo
- **Scroll vertical**: Ver más órdenes
- **Hover sobre una barra**: Ver información detallada
- **Click en una barra**: Abrir la orden en el tablero

---

## 11. Gestión de Usuarios

### 11.1 Acceder a Usuarios

**Solo disponible para administradores**

- Haz clic en **👥 Usuarios** en el menú de acciones
- O navega a `/usuarios`

### 11.2 Ver Lista de Usuarios

La página muestra:

- Lista completa de usuarios del sistema
- Información de cada usuario:
  - Nombre
  - Email
  - Rol (Administración, Taller, Mostrador)
  - Estado (Activo/Inactivo)
  - Fecha de creación

### 11.3 Crear Nuevo Usuario

1. Haz clic en **"Crear Usuario"**
2. Completa el formulario:
   - Nombre completo
   - Email
   - Contraseña
   - Rol
3. Haz clic en **"Guardar"**

### 11.4 Editar Usuario

1. Haz clic en el botón **✏️** junto al usuario
2. Modifica los campos necesarios
3. Haz clic en **"Guardar Cambios"**

### 11.5 Eliminar Usuario

1. Haz clic en el botón **🗑️** junto al usuario
2. Confirma la eliminación

**⚠️ Advertencia:** Esta acción no se puede deshacer.

---

## 12. Atajos de Teclado

La aplicación tiene varios atajos de teclado para mejorar la productividad:

| Atajo | Acción |
|-------|--------|
| `C` | Crear nueva orden |
| `L` | Abrir biblioteca de OPs |
| `Ctrl+K` o `/` | Enfocar búsqueda |
| `Enter` (en chat) | Enviar mensaje |
| `Shift+Enter` (en chat) | Nueva línea |
| `Ctrl+Enter` (comentarios) | Agregar comentario |

### 12.1 Atajos en el Tablero

- **Click y arrastrar**: Mover fichas entre columnas
- **Doble click en ficha**: Expandir/contraer detalles
- **Click derecho**: Menú contextual (en desarrollo)

---

## 19. Funciones Avanzadas

### 13.1 Modo Compacto

Activa el modo compacto para ver más fichas en pantalla:

1. Haz clic en **🧊 Modo compacto** en el menú
2. Las fichas se mostrarán más pequeñas
3. Haz clic nuevamente para volver al modo expandido

**Uso:** Ideal para pantallas pequeñas o cuando necesitas ver muchas órdenes a la vez.

### 13.2 Biblioteca de OPs

Accede a todas las órdenes, incluyendo las archivadas:

1. Haz clic en **🔍 Bibliotecas de OPs** en la barra de filtros
2. Verás todas las órdenes del sistema
3. Puedes:
   - Buscar por número de OP, cliente o tags
   - Filtrar por estado
   - Filtrar por prioridad
   - Editar órdenes archivadas
   - Desarchivar órdenes marcadas como entregadas

### 13.3 Filtros Avanzados

#### Filtrar por Estado

1. Haz clic en los **chips de estado** en la barra de filtros
2. Solo se mostrarán las órdenes de los estados seleccionados
3. Haz clic en **"Limpiar foco"** para mostrar todas

#### Filtrar por Prioridad

1. Selecciona una prioridad en la barra de filtros:
   - **Todas**: Muestra todas las órdenes
   - **Alta**: Solo órdenes de alta prioridad
   - **Media**: Solo órdenes de media prioridad
   - **Baja**: Solo órdenes de baja prioridad

#### Búsqueda Avanzada

La búsqueda busca en:
- Número de OP
- Título/Cliente
- Descripción
- Tags

**Ejemplos:**
- `OP-1234` → Encuentra la orden específica
- `Juan` → Encuentra órdenes del cliente Juan
- `Urgente` → Encuentra órdenes con tag "Urgente"

### 13.4 Gestión de Materiales

Al crear o editar una orden:

1. En el campo **"Materiales"**, escribe el nombre del material
2. Aparecerá un dropdown con materiales del catálogo
3. Selecciona un material o escribe uno nuevo
4. Puedes especificar la cantidad
5. Los materiales se guardan asociados a la orden

**Información mostrada:**
- Descripción del material
- Código
- Stock disponible (con indicador de color)

### 13.5 Archivos Adjuntos

#### Subir Archivos

1. Al crear o editar una orden, desplázate a **"Archivos Adjuntos"**
2. Haz clic en **"Seleccionar archivos"**
3. Selecciona una o más imágenes o PDFs
4. Los archivos se subirán automáticamente
5. El primer archivo se usará como foto principal de la orden

**Formatos soportados:**
- Imágenes: JPG, PNG, GIF, WebP
- Documentos: PDF

**Límites:**
- Tamaño máximo por archivo: Consultar con administrador
- Cantidad máxima: Sin límite práctico

### 13.6 Tags (Etiquetas)

Los tags permiten categorizar órdenes:

1. Al crear o editar, agrega tags en el campo **"Etiquetas"**
2. Escribe el nombre del tag y presiona `Enter`
3. Cada tag tiene un color automático único
4. Los tags aparecen en la ficha con su color

**Ejemplos de tags útiles:**
- `Urgente`
- `Cliente VIP`
- `Revisión pendiente`
- `Material faltante`

### 13.7 Consulta de Cliente

Existe una página pública para que los clientes consulten el estado de sus órdenes:

- URL: `/consulta-cliente`
- Los clientes pueden buscar por número de OP
- Verán el estado actual y fecha de entrega
- No requiere login

### 13.8 Dashboard de Pantallas

Para visualización en pantallas grandes:

- URL: `/dashboard-pantallas`
- Vista optimizada para monitores/TVs
- Actualización automática en tiempo real
- Ideal para mostrar en el taller o mostrador

### 13.9 Gestión de Impresoras

Accede a la gestión de ocupación de impresoras:

1. Haz clic en el botón flotante **🖨️** (esquina inferior derecha)
2. O navega a `/impresoras`
3. Verás el estado de ocupación de las impresoras
4. Puedes registrar trabajos en impresoras

---

## 20. Solución de Problemas

### 14.1 No puedo iniciar sesión

**Posibles causas:**
- Credenciales incorrectas
- Usuario deshabilitado
- Problema de conexión

**Soluciones:**
1. Verifica que tu usuario y contraseña sean correctos
2. Contacta al administrador si olvidaste tu contraseña
3. Verifica tu conexión a internet
4. Intenta limpiar la caché del navegador

### 14.2 Los cambios no se guardan

**Posibles causas:**
- Problema de conexión
- Error de sincronización
- Sesión expirada

**Soluciones:**
1. Verifica tu conexión a internet
2. Recarga la página (F5)
3. Cierra sesión y vuelve a iniciar sesión
4. Verifica que no haya errores en la consola del navegador (F12)

### 14.3 No veo actualizaciones en tiempo real

**Posibles causas:**
- Conexión lenta
- Problema con WebSockets
- Navegador desactualizado

**Soluciones:**
1. Recarga la página
2. Verifica tu conexión a internet
3. Actualiza tu navegador a la última versión
4. Intenta en otro navegador

### 14.4 Las fichas no se mueven

**Posibles causas:**
- JavaScript deshabilitado
- Problema con el navegador
- Permisos insuficientes

**Soluciones:**
1. Verifica que JavaScript esté habilitado
2. Intenta en otro navegador
3. Verifica que tengas permisos para editar órdenes
4. Recarga la página

### 14.5 El chat no funciona

**Posibles causas:**
- No estás autenticado
- Problema de conexión
- Canal sin mensajes

**Soluciones:**
1. Verifica que estés autenticado
2. Verifica tu conexión a internet
3. Intenta cambiar de canal
4. Recarga la página

### 14.6 PlotAI no responde

**Posibles causas:**
- API key no configurada
- Problema de conexión
- Límite de uso alcanzado

**Soluciones:**
1. Verifica tu conexión a internet
2. Contacta al administrador si el problema persiste
3. Intenta hacer una pregunta más simple
4. Verifica que PlotAI esté habilitado en tu cuenta

### 14.7 No puedo subir archivos

**Posibles causas:**
- Archivo muy grande
- Formato no soportado
- Problema de permisos

**Soluciones:**
1. Verifica que el archivo sea menor a 10MB (aproximado)
2. Verifica que el formato sea JPG, PNG o PDF
3. Intenta con otro archivo
4. Contacta al administrador si el problema persiste

### 14.8 Las estadísticas no cargan

**Posibles causas:**
- No eres administrador
- Problema de conexión
- Datos insuficientes

**Soluciones:**
1. Verifica que tengas rol de administrador
2. Verifica tu conexión a internet
3. Espera unos segundos, puede tardar en cargar
4. Verifica que haya datos en el rango de fechas seleccionado

---

## 21. Consejos y Mejores Prácticas

### 15.1 Organización del Tablero

- **Mantén las fichas actualizadas**: Mueve las órdenes a su estado real
- **Usa tags consistentemente**: Facilita la búsqueda y filtrado
- **Completa toda la información**: Facilita el trabajo del equipo
- **Actualiza el progreso**: Marca las subtareas completadas

### 15.2 Comunicación

- **Usa el chat para coordinación**: Evita confusiones
- **Menciona usuarios cuando sea necesario**: `@nombre` para alertas importantes
- **Usa alertas (🚨) con moderación**: Solo para urgencias reales
- **Agrega comentarios en las órdenes**: Documenta decisiones importantes

### 15.3 Gestión de Tiempo

- **Revisa el calendario regularmente**: Planifica con anticipación
- **Usa el Gantt para proyectos largos**: Visualiza dependencias
- **Marca fechas de entrega realistas**: Evita retrasos
- **Revisa fichas estancadas**: Identifica problemas temprano

### 15.4 Uso de PlotAI

- **Sé específico en tus preguntas**: Mejores respuestas
- **Usa PlotAI para análisis**: Ahorra tiempo en reportes
- **Sube archivos cuando sea útil**: PlotAI puede analizarlos
- **Revisa las sugerencias automáticas**: Pueden ser útiles

### 15.5 Seguridad

- **No compartas tu contraseña**: Mantén tu cuenta segura
- **Cierra sesión en computadoras compartidas**: Protege tu información
- **Reporta problemas de seguridad**: Contacta al administrador
- **Usa contraseñas seguras**: Mejora la seguridad general

---

## 22. Glosario de Términos

- **OP (Orden de Producción)**: Ficha de trabajo que representa un pedido del cliente
- **Ficha**: Tarjeta visual que representa una OP en el tablero
- **Sector**: Área de trabajo (Diseño, Imprenta, Instalaciones, etc.)
- **Estado**: Columna del tablero donde se encuentra una OP
- **Operario**: Usuario responsable de trabajar en una OP
- **Tag**: Etiqueta de color para categorizar OPs
- **Checklist**: Lista de subtareas dentro de una OP
- **WIP (Work In Progress)**: Trabajo en progreso, órdenes no completadas
- **Lead Time**: Tiempo desde la creación hasta la entrega
- **Cycle Time**: Tiempo que tarda una OP en un estado específico
- **SLA (Service Level Agreement)**: Acuerdo de nivel de servicio, cumplimiento de fechas

---

## 23. Contacto y Soporte

### 17.1 Soporte Técnico

Si encuentras problemas técnicos:

1. Verifica esta guía primero
2. Revisa la sección de solución de problemas
3. Contacta al administrador del sistema
4. Proporciona detalles del problema:
   - Qué estabas haciendo
   - Qué error viste
   - Captura de pantalla si es posible

### 17.2 Sugerencias y Mejoras

Las sugerencias son bienvenidas:

- Comenta con tu equipo
- Contacta al administrador
- Usa PlotAI para analizar mejoras posibles

### 17.3 Actualizaciones

El sistema se actualiza regularmente:

- Las actualizaciones se aplican automáticamente
- Puede requerir recargar la página
- Las nuevas funciones se anuncian en el chat general

---

## 24. Preguntas Frecuentes (FAQ)

### ¿Puedo usar la aplicación en mi teléfono?

Sí, la aplicación es responsive y funciona en dispositivos móviles. Sin embargo, algunas funciones como el drag & drop pueden ser más difíciles de usar en pantallas pequeñas.

### ¿Puedo instalar la aplicación en mi escritorio?

Sí, **Trello Plot** es una Progressive Web App (PWA) que puedes instalar en tu escritorio. Esto te permite:

- Abrir la aplicación directamente desde el escritorio o menú de inicio
- Usar la aplicación en una ventana independiente sin la barra del navegador
- Acceso más rápido sin necesidad de abrir el navegador cada vez
- Mejor integración con el sistema operativo

**Cómo instalar:**
- En Chrome/Edge: Busca el icono de instalación (➕) en la barra de direcciones
- En Firefox: Menú → "Instalar sitio como aplicación"
- En Safari (Mac): Archivo → "Agregar a Dock"

La aplicación instalada se actualiza automáticamente cuando hay nuevas versiones disponibles.

### ¿Los datos se guardan automáticamente?

Sí, todos los cambios se guardan automáticamente cuando:
- Mueves una ficha
- Editas una orden
- Agregas un comentario
- Envías un mensaje en el chat

### ¿Puedo trabajar sin conexión a internet?

No, la aplicación requiere conexión a internet para funcionar, ya que todos los datos se almacenan en la nube y se sincronizan en tiempo real.

### ¿Cuántas órdenes puedo crear?

No hay un límite práctico en la cantidad de órdenes que puedes crear. El sistema está diseñado para manejar grandes volúmenes de trabajo.

### ¿Puedo eliminar órdenes por error?

Sí, pero la eliminación requiere confirmación. Si eliminas una orden por error, contacta al administrador para ver si puede restaurarla desde backups.

### ¿Cómo cambio mi contraseña?

Contacta al administrador del sistema para cambiar tu contraseña.

### ¿Puedo tener múltiples sesiones abiertas?

Sí, puedes tener la aplicación abierta en múltiples dispositivos o pestañas. Los cambios se sincronizarán entre todas las sesiones.

### ¿Qué navegadores son compatibles?

La aplicación funciona mejor en:
- Google Chrome (recomendado)
- Mozilla Firefox
- Microsoft Edge
- Safari

Se recomienda usar la última versión del navegador.

---

## 25. Changelog y Versiones

### Versión Actual

La aplicación se actualiza continuamente. Las nuevas funciones y correcciones se anuncian en el canal #general del chat.

### Historial de Cambios Importantes

- **Enero 2025**: 
  - Sistema de Capacitaciones para RRHH y empleados
  - Sistema de Evaluaciones de Desempeño
  - Sistema de Solicitudes de Permisos (turnos, vacaciones, ausencias, ropa)
  - Sistema de Menú Diario con selección de platos (hasta 9:30 AM)
  - Sistema de Pedidos de Compra mejorado con historial y notificaciones
  - Sistema de Horarios y Turnos para RRHH
  - Corrección de zona horaria (Argentina - UTC-3)
- **Diciembre 2024**: 
  - Aplicación de escritorio (PWA) - Instalación como aplicación nativa
  - Sistema de Chat: Comunicación en tiempo real entre usuarios
  - PlotAI: Asistente inteligente con IA generativa
  - Estadísticas Avanzadas: Métricas detalladas de rendimiento
  - Modo Compacto: Vista optimizada para más información
  - Códigos QR: Acceso rápido a órdenes
  - Checklist: Sistema de subtareas mejorado

---

## 26. Conclusión

Este manual cubre todas las funciones principales de Trello Plot. Si tienes preguntas adicionales o encuentras algo que no está documentado aquí, no dudes en:

1. Consultar con tu equipo
2. Usar PlotAI para hacer preguntas
3. Contactar al administrador del sistema

**¡Gracias por usar Trello Plot!**

---

*Última actualización: Enero 2025*
*Versión del manual: 2.0*

---

## 27. Información Técnica Adicional

### 27.1 Zona Horaria

El sistema está configurado para usar la zona horaria de **Argentina (America/Argentina/Buenos_Aires, UTC-3)**. Todas las fechas y horas se muestran y procesan en esta zona horaria.

**Importante:**
- El menú diario tiene un plazo de selección hasta las **9:30 AM** (hora Argentina)
- Las fechas se muestran en formato argentino (DD/MM/YYYY)
- Las horas se muestran en formato 24 horas

### 27.2 Notificaciones

El sistema envía notificaciones automáticas para:
- Cambios de estado en órdenes de trabajo
- Nuevos mensajes en el chat (menciones)
- Actualizaciones en pedidos de compra
- Aprobaciones/rechazos de solicitudes de permisos
- Actualizaciones en capacitaciones
- Cambios en el estado de pedidos de compra

Las notificaciones aparecen en:
- El icono de campana (🔔) en el header
- Notificaciones del navegador (si están habilitadas)

### 27.3 Módulos por Rol

#### Todos los Usuarios
- Tablero Kanban
- Chat
- PlotAI
- Capacitaciones (ver e inscribirse)
- Menú Diario (ver y seleccionar)
- Solicitudes de Permisos (crear)
- Pedidos de Compra (solicitar y ver historial)

#### RRHH y Admin
- Gestión de Capacitaciones
- Gestión de Evaluaciones
- Gestión de Solicitudes de Permisos
- Gestión de Menú Diario
- Gestión de Horarios y Turnos
- Gestión de Usuarios

#### Compras y Admin
- Dashboard de Compras
- Gestión de Pedidos de Compra
- Aprobación/Rechazo de Pedidos
- Reportes de Compras
- Conciliación Bancaria


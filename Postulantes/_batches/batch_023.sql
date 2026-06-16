BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  595,
  'Manuela Manrique',
  'licrrhh.manuelamanrique@gmail.com',
  '02645057571',
  'Administrativo/a de Personal',
  NULL,
  'Hola! Me postulo para toda tarea administrativa y gestión/delegación de personal. Mi nombre es Manu y estoy recibida de Recursos Humanos y me encuentro en la búsqueda de trabajo para desarrollarme profesionalmente. Actualmente estudio inglés y tengo una gran capacidad de adaptación, aprendiendo nuevas tareas de forma rápida y eficiente. Me considero una persona comprometida, responsable y con buena predisposición al trabajo en equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_595_cv_69835eaa2baf76.19717339.pdf',
  'cv_69835eaa2baf76.19717339.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69835eaa2baf76.19717339.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-04T14:58:50+00:00'::timestamptz,
  '2026-02-04T14:58:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  596,
  'Facundo Andres Castro Alvarez',
  'facu_castro_24@outlook.com',
  '2644559483',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_596_cv_6984ccb9506550.87125376.pdf',
  'cv_6984ccb9506550.87125376.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6984ccb9506550.87125376.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-05T17:00:41+00:00'::timestamptz,
  '2026-02-05T17:00:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  597,
  'Carlos Rolando Catalan',
  'contactocatalan@gmail.com',
  '2645144094',
  'Desarrollador/a Frontend',
  NULL,
  'Mi trayectoria comenzó explorando el potencial visual con herramientas como Photoshop y After Effects, lo que me dio una base sólida en estética y composición. Hoy, esa visión creativa se potencia con mis estudios en Programación y Diseño Web, permitiéndome crear productos digitales donde la forma y la función van de la mano.

Me especializo en el ciclo completo de desarrollo: desde la concepción de la experiencia de usuario (UX/UI) hasta la implementación de la lógica y base de datos. Soy una persona detallista, comprometida con la excelencia y en constante aprendizaje para entregar siempre mi mejor versión técnica.

Proyecto en curso: Blog para Doctorado en Geografía
Un ejemplo de mi flujo de trabajo integral, desde el concepto hasta el despliegue:

🎨 Diseño UI/UX (Figma): Ver prototipo y wireframes

Estructuración visual y prototipado de alta fidelidad.

🚀 MVP en vivo (Vercel): doctoradogeografia.vercel.app

Aplicación funcional lista para interacción.

💻 Repositorio (GitHub): Acceder al código fuente

Estructura de datos y lógica de programación.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_597_cv_6985422908a8e8.63712069.pdf',
  'cv_6985422908a8e8.63712069.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6985422908a8e8.63712069.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T01:21:45+00:00'::timestamptz,
  '2026-02-06T01:21:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  598,
  'Ernesto Andres Alaniz',
  'alanizernestoandres@gmail.com',
  '2646129703',
  'Vendedor/a',
  NULL,
  'Estoy en búsqueda activa laboral tengo experiencia en ventas atención al cliente cajero operativo de deposito y logistica.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_598_cv_69857c2e692208.79805093.pdf',
  'cv_69857c2e692208.79805093.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69857c2e692208.79805093.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T05:29:18+00:00'::timestamptz,
  '2026-02-06T05:29:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  599,
  'Axel Ticle',
  'ticleaxel12@gmail.com',
  '2646997844',
  'Vendedor/a',
  NULL,
  'Hola buenos días me llamo Axel ticle tengo 28 años y me encuentro en búsqueda de trabajo de manera urgente cuento con experiencia en manejo de camiones de gran porte y quitanieves también en ventas tengo carnét profesional habilitado hasta 2030 me gustaría que me tengan en cuenta para una entrevista muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_599_cv_6985bc333f7d34.98870559.pdf',
  'cv_6985bc333f7d34.98870559.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6985bc333f7d34.98870559.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T10:02:27+00:00'::timestamptz,
  '2026-02-06T10:02:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  600,
  'Pablo Montes de oca',
  'pablomontesdeoca2024@gmail.com',
  '0264 6701671',
  'Ayudante en imprenta',
  NULL,
  'Hola trabaje muchos años en empresas de limpiezas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_600_cv_6985f722e54d00.82778047.pdf',
  'cv_6985f722e54d00.82778047.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6985f722e54d00.82778047.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T14:13:54+00:00'::timestamptz,
  '2026-02-06T14:13:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  602,
  'María Luz Flores',
  'luz170584@gmail.com',
  '2644706856',
  'Atención al Cliente',
  NULL,
  'Me gustaría presentar mi solicitud de empleo para el puesto de Atención al cliente creo en mi experiencia y habilidades para el puesto que necesitan

Adjunto mi currículum en la que pueden encontrar más detalles sobre mis experiencias  

Agradezco su tiempo y consideración, 

Atentamente.                  

Maria Luz Flores',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_602_cv_69895c67967d78.88910692.pdf',
  'cv_69895c67967d78.88910692.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69895c67967d78.88910692.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-09T04:02:47+00:00'::timestamptz,
  '2026-02-09T04:02:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  604,
  'Tomas Moreno',
  'tommymoreno2301@gmail.com',
  '2645840885',
  'Generalista de RRHH',
  NULL,
  'Estimados, me dirijo a ustedes con el propósito de postularme para el área de Capital Humano. Como Licenciado en Gestión de Recursos Humanos, cuento con experiencia en la profesionalización de áreas de RRHH en entornos dinámicos e industriales. Mi enfoque combina la eficiencia administrativa con una visión estratégica del talento, orientada a acompañar el crecimiento del negocio y fortalecer el clima organizacional. Quedo a su entera disposición para una entrevista y agradezco de antemano su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_604_cv_698a00997df666.52844903.pdf',
  'cv_698a00997df666.52844903.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698a00997df666.52844903.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-09T15:43:21+00:00'::timestamptz,
  '2026-02-09T15:43:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  605,
  'Guadalupe Savall',
  'savallguadalupe@gmail.com',
  '+5492645100766',
  'Desarrollador/a Backend',
  NULL,
  '¡Hola! Soy Guadalupe Savall. Me postulo para el área de Backend, aunque me considero un perfil Full Stack porque me gusta estar en todo el proceso. 
Tengo experiencia desarrollando plataformas desde cero con PHP, JavaScript y SQL, metiéndome de lleno en la lógica de negocio y la seguridad de los accesos. Lo que me diferencia es mi base técnica en infraestructura y networking: no solo escribo el código, sino que entiendo perfectamente la red y los servidores donde corre, gracias a mi experiencia con Fortinet y MikroTik.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_605_cv_698baea7cdf1a0.47227335.pdf',
  'cv_698baea7cdf1a0.47227335.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698baea7cdf1a0.47227335.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-10T22:18:15+00:00'::timestamptz,
  '2026-02-10T22:18:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  606,
  'Facundo Vera',
  'facundo.vera.tech@gmail.com',
  '2645732745',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_606_cv_698e5e6e319f03.00321846.pdf',
  'cv_698e5e6e319f03.00321846.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698e5e6e319f03.00321846.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-12T23:12:46+00:00'::timestamptz,
  '2026-02-12T23:12:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  607,
  'Paula Nahir Sasu',
  'paulasasu4@gmail.com',
  '2645474692',
  'Proyectista',
  NULL,
  'Hola, buenas tardes.
Mi nombre es Paula Sasu, soy estudiante de Arquitectura y me interesa postularme para formar parte de su equipo.
Tengo interés en documentación técnica, armado de planos y procesos de impresión, y me gustaría ganar experiencia en un entorno de trabajo vinculado a la producción gráfica y atención a profesionales.
Les comparto mi CV para su consideración.
Muchas gracias por su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_607_cv_698e65ccba4d15.12932405.pdf',
  'cv_698e65ccba4d15.12932405.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698e65ccba4d15.12932405.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-12T23:44:12+00:00'::timestamptz,
  '2026-02-12T23:44:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  608,
  'Martina Bruno Sánchez',
  'martinabruno301@gmail.com',
  '2644506247',
  'Atención al Cliente',
  NULL,
  'No tengo problema en relacionarme con otros, además de trabajar en equipo y mantener una relación cordial',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_608_cv_699256ef47c5b1.27176321.pdf',
  'cv_699256ef47c5b1.27176321.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699256ef47c5b1.27176321.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-15T23:29:51+00:00'::timestamptz,
  '2026-02-15T23:29:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  610,
  'Martina Bruno Sánchez',
  'marttinabrunosanchez@gmail.com',
  '2644506247',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Tengo base en diseño, además de conocimiento de los materiales y métodos de impresión',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_610_cv_6992578b92a141.19909483.pdf',
  'cv_6992578b92a141.19909483.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6992578b92a141.19909483.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-15T23:32:27+00:00'::timestamptz,
  '2026-02-15T23:32:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  611,
  'Mayco Washington Diaz',
  'maycodiaz015@gmail.com',
  '2645851504',
  'Instalador/a de Cartelería',
  NULL,
  'Hola buenos días estoy en búsqueda de empleo tengo experiencia en distintas áreas en las cuales están necesitando acá les dejo mi cv desde ya muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_611_cv_699458d53752f4.94967993.pdf',
  'cv_699458d53752f4.94967993.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699458d53752f4.94967993.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-17T12:02:29+00:00'::timestamptz,
  '2026-02-17T12:02:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  613,
  'María de los Ángeles Herrera',
  'mmariaherrera23@gmail.com',
  '2644159316',
  'Cajero/a',
  NULL,
  'Cuento con experiencia en atención al cliente y manejo de caja, desarrolladas en un entorno dinámico y de contacto constante con el público. Me destaco por ser una persona responsable, organizada, con buena comunicación y capacidad para resolver situaciones de manera eficiente. Tengo excelente predisposición para el trabajo en equipo, aprendizaje de nuevas tareas y compromiso con las responsabilidades asignadas. Actualmente me encuentro en la búsqueda de una oportunidad laboral donde pueda continuar desarrollándome y aportar mis conocimientos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_613_cv_6995dd34b97558.52898318.pdf',
  'cv_6995dd34b97558.52898318.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6995dd34b97558.52898318.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-18T15:39:32+00:00'::timestamptz,
  '2026-02-18T15:39:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  614,
  'Enzo Molina',
  'em2328369@gmail.com',
  '2646284661',
  'Proyectista',
  NULL,
  'Soy Maestro Mayor de obra y técnico en Higiene y Seguridad, tengo 24 años y ando en búsqueda laboral y me gustaría formar parte de su equipo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_614_cv_6997defc482305.65640530.pdf',
  'cv_6997defc482305.65640530.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6997defc482305.65640530.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-20T04:11:40+00:00'::timestamptz,
  '2026-02-20T04:11:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  615,
  'Juan Ignacio Acosta',
  'ignacosta11@gmail.com',
  '2644848136',
  'Operario/a de Impresión',
  NULL,
  'Mi nombre es Juan Ignacio Acosta tengo experiencia comprobable en Operario de producción en serigrafia y vinillo.
En serigrafía:
Preparación y revelado de marcos
Registro de colores
Manejo de pulpo manual
Curado de tinta
Control de calidad
En vinilos:
Manejo de plotter
Diseño básico en Illustrator o Corel
Depilado
Posicionado sin burbujas
Aplicación en vidrio, paredes o vehículos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_615_cv_699cdae452be05.68983662.pdf',
  'cv_699cdae452be05.68983662.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699cdae452be05.68983662.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-23T22:55:32+00:00'::timestamptz,
  '2026-02-23T22:55:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  616,
  'Carlos Miguel Moll Rojas',
  'miguelmollrojas@gmail.com',
  '02645716360',
  'Administrativo/a Contable',
  NULL,
  'Soy administrativo contable con experiencia en liquidación de sueldos, gestión administrativa y control documental. Actualmente trabajo en el Ministerio de Educación de San Juan, donde realizo tareas de carga y control de información, seguimiento de procesos y soporte operativo. Cuento con muy buen manejo de Excel y herramientas digitales, perfil ordenado, responsable y con disponibilidad inmediata. Me interesa incorporarme a una empresa dinámica donde pueda aportar mi experiencia administrativa y seguir desarrollándome profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_616_cv_699ce4013c6e15.37368389.pdf',
  'cv_699ce4013c6e15.37368389.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_699ce4013c6e15.37368389.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-23T23:34:25+00:00'::timestamptz,
  '2026-02-23T23:34:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  617,
  'Rodriguez Lopez Lucas',
  'lucasrrodriguez17@gmail.com',
  '2645893118',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Elegí este puesto porque creo que es ideal para mi perfil, pero tambien puedo aportar como Tecnico en diseño o diseño ux/ui. Me gusta trabajar en equipo y creo que esta empresa es un buen desafío para mi carrera en formación. 
Gracias, saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_617_cv_699f28f860dca5.43690160.pdf',
  'cv_699f28f860dca5.43690160.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699f28f860dca5.43690160.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-25T16:53:12+00:00'::timestamptz,
  '2026-02-25T16:53:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  618,
  'Bruno Javier Alanis Corzo',
  'brunojac@outlook.com.ar',
  '2645858428',
  'Electricista',
  NULL,
  'Soy una persona activa, servicial y con valores, me postulo para electricista aunque cuento con experiencia en el rubro en diversas áreas, tanto como cortes, ploteos, colocación de carteleria, etc.
Actualmente estudio Higiene y Seguridad laboral en el horario de mañana.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_618_cv_69a0524a0b23b6.04325052.pdf',
  'cv_69a0524a0b23b6.04325052.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a0524a0b23b6.04325052.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-26T14:01:46+00:00'::timestamptz,
  '2026-02-26T14:01:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;
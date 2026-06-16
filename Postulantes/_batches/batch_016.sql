BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  412,
  'Elina Castro Lucero',
  'eli.c157@gmail.com',
  '2644658616',
  'Atención al Cliente',
  NULL,
  'Hola, me encantaría formar parte de la empresa.
Me adapto a nuevas experiencias y abierta a nuevas oportunidades y conocimientos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_412_cv_696844a4a5b108.85763941.pdf',
  'cv_696844a4a5b108.85763941.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696844a4a5b108.85763941.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T01:36:36+00:00'::timestamptz,
  '2026-01-15T01:36:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  413,
  'Melisa Guzmán',
  'meli.1998.mario@gmail.com',
  '2645595236',
  'Vendedor/a',
  NULL,
  'Me postulo al puesto de vendedor o de administrativo, o de atención al público',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_413_cv_696859a569ca75.03021549.docx',
  'cv_696859a569ca75.03021549.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696859a569ca75.03021549.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T03:06:13+00:00'::timestamptz,
  '2026-01-15T03:06:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  414,
  'Lucas Pelayes',
  'pelayes223@gmail.com',
  '2644570322',
  'Proyectista',
  NULL,
  'Soy técnico y arquitecto recién recibido!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_414_cv_69685d65d220d8.71417153.pdf',
  'cv_69685d65d220d8.71417153.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69685d65d220d8.71417153.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T03:22:13+00:00'::timestamptz,
  '2026-01-15T03:22:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  416,
  'Martín Mila',
  'martinmilla999@gmail.com',
  '2645272979',
  'Atención al Cliente',
  NULL,
  'Hola, soy Martin! Me gustaría trabajar en su comunidad de trabajo, para aplicar mis conocimientos y así poder seguir aprendiendo y mejorando en mis debilidades. Tengo una muy buena disciplina, compañerismo, predisposición para el cumplimiento de tareas y respeto hacia todos mis compañeros y superiores.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_416_cv_696870166f81f3.48069905.pdf',
  'cv_696870166f81f3.48069905.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696870166f81f3.48069905.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T04:41:58+00:00'::timestamptz,
  '2026-01-15T04:41:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  417,
  'Oriana Soledad Muñoz',
  'munozoriana5@gmail.com',
  '2645613874',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_417_cv_69687952f33b56.64059773.pdf',
  'cv_69687952f33b56.64059773.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69687952f33b56.64059773.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T05:21:22+00:00'::timestamptz,
  '2026-01-15T05:21:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  418,
  'Laureana belén lima ontiveros',
  'limalunly@gmail.com',
  '264460698',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_418_cv_6968ca80bfd043.64740386.pdf',
  'cv_6968ca80bfd043.64740386.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6968ca80bfd043.64740386.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T11:07:44+00:00'::timestamptz,
  '2026-01-15T11:07:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  420,
  'Alejandro Nicolas Olmedo',
  'alenolmedo92@gmail.com',
  '2645236102',
  'Desarrollador/a Backend',
  NULL,
  'Buenos días, soy Alejandro actualmente estudio la Licenciatura en Ciencias de la Computación y cuento con una base sólida en programación, adquirida tanto en la universidad como en proyectos freelance, trabajando con lenguajes como C/C++, Java y Python, desarrollando lógica, manejo de memoria y resolución de problemas.
También poseo experiencia en otras áreas como capacitación y manejo de personal, atención al cliente, administración, etc. que estaría encantado de dárselas a conocer a través de una entrevista. 
Desde ya muchas gracias y quedo a su disposición.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_420_cv_6968e11f3a13c0.21668641.pdf',
  'cv_6968e11f3a13c0.21668641.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968e11f3a13c0.21668641.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T12:44:15+00:00'::timestamptz,
  '2026-01-15T12:44:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  421,
  'Paula Espejo',
  'erpaula96@gmail.com',
  '2646286313',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_421_cv_6968eeace92373.41540377.pdf',
  'cv_6968eeace92373.41540377.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968eeace92373.41540377.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T13:42:04+00:00'::timestamptz,
  '2026-01-15T13:42:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  423,
  'Ysamar YNOJOZA',
  'ysamar_wyya512_4@hotmail.com',
  '2645778353',
  'Administrativo/a de Personal',
  NULL,
  '.Venezolana en Argentina en búsqueda de nuevos desafíos. Adaptable a todo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_423_cv_6968f8a7d06bd0.29673066.pdf',
  'cv_6968f8a7d06bd0.29673066.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968f8a7d06bd0.29673066.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:24:39+00:00'::timestamptz,
  '2026-01-15T14:24:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  424,
  'Daniela abril diaz',
  'danieladiaz217@gmail.com',
  '2345564442',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_424_cv_6968fa829f95f7.91837207.pdf',
  'cv_6968fa829f95f7.91837207.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6968fa829f95f7.91837207.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:32:34+00:00'::timestamptz,
  '2026-01-15T14:32:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  425,
  'Lourdes Guevara',
  'luliguevara08@gmail.com',
  '2646224289',
  'Asesor/a Comercial',
  NULL,
  'Buenas soy Lourdes y tengo actualmente 29 años. Soltera sin hija , dispuesta aprender y adaptarme a lo que el equipo necesite . Me considero buena compañera y responsable sobre todo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_425_cv_6968fd3e321e25.20442474.pdf',
  'cv_6968fd3e321e25.20442474.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968fd3e321e25.20442474.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:44:14+00:00'::timestamptz,
  '2026-01-15T14:44:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  426,
  'Milena Gomez',
  'lic.criminalistica2025@gmail.com',
  '2645626013',
  'Atención al Cliente',
  NULL,
  'Hola cuento con experiencia en atención al cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_426_cv_69690206467498.84472911.pdf',
  'cv_69690206467498.84472911.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69690206467498.84472911.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:04:38+00:00'::timestamptz,
  '2026-01-15T15:04:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  427,
  'Maria Jose Perez',
  'mjperez759@gmail.com',
  '2645185942',
  'Asistente Administrativo/a',
  NULL,
  'Persona proactiva, organizada y con actitud positiva frente a nuevos desafíos. Cuento con buenas habilidades de comunicación, responsabilidad y predisposición para el trabajo en equipo. Actualmente me encuentro en formación continua, con interés en desarrollarme y crecer dentro de una organización.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_427_cv_696909c82d4b60.46715031.pdf',
  'cv_696909c82d4b60.46715031.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696909c82d4b60.46715031.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:37:44+00:00'::timestamptz,
  '2026-01-15T15:37:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  428,
  'Ornella Trapaglia',
  'ornella.ta0377@gmail.com',
  '2645619891',
  'Community Manager',
  NULL,
  'Estudio comunicación en la UNSJ, soy alumna avanzada y estoy buscando experiencias laborales para poder explotar mis conocimientos, así como también ampliarlos dentro del mercado laboral',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_428_cv_69690e59c7ed47.08309184.pdf',
  'cv_69690e59c7ed47.08309184.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69690e59c7ed47.08309184.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:57:13+00:00'::timestamptz,
  '2026-01-15T15:57:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  430,
  'Paula Agustina Cortez',
  'cortezagustina807@gmail.com',
  '2645823788',
  'Administrativo/a de Personal',
  NULL,
  'Soy profesional en Recursos Humanos, con experiencia en administración de personal, reclutamiento y selección, capacitación y acompañamiento a los equipos de trabajo. He trabajado tanto en PYMES como en contextos operativos, desarrollando una mirada ordenada, responsable y orientada a procesos.
Me interesa especialmente el puesto de Administrativo/a de Personal porque disfruto del trabajo administrativo del área, la organización, el seguimiento y el cumplimiento de procedimientos, aportando compromiso, prolijidad y buena comunicación interna. Me caracterizo por la responsabilidad, la adaptabilidad y el buen manejo de las relaciones interpersonales.
Me motiva incorporarme a Plotcenter para crecer profesionalmente y aportar valor desde la gestión diaria del área de Recursos Humanos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_430_cv_696918fa45b3b8.18743239.pdf',
  'cv_696918fa45b3b8.18743239.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696918fa45b3b8.18743239.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T16:42:34+00:00'::timestamptz,
  '2026-01-15T16:42:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  431,
  'Ramiro figueroa',
  'figramirofig@gmail.com',
  '2646281552',
  'Atención al Cliente',
  NULL,
  'Cajero.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_431_cv_6969208c6dbf13.08250402.pdf',
  'cv_6969208c6dbf13.08250402.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6969208c6dbf13.08250402.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T17:14:52+00:00'::timestamptz,
  '2026-01-15T17:14:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  432,
  'Enzo Javier Dominguez',
  'enzod4776@gmail.com',
  '2644472842',
  'Atención al Cliente',
  NULL,
  'Soy una persona responsable, proactiva y orientada al trato con el público. Cuento con experiencia en atención al cliente, manejo de caja y tareas operativas, destacándome por mi buena comunicación, predisposición para aprender y capacidad para trabajar en equipo. Tengo facilidad para adaptarme a distintos entornos laborales, mantener el orden, cumplir procedimientos y brindar una atención cordial y eficiente. Me caracterizo por su compromiso, puntualidad y buena actitud frente a las tareas asignadas.
También tengo experiencia en otras áreas además de atención al cliente. Cómo podrá ver en mi Currículum Viate, también tengo experiencia en:
Ventas: vendedor/a o asesor/a comercial, persuasión y manejo de consultas.
Caja: cajero/a, por experiencia con cobros, responsabilidad y manejo de dinero.
Administración básica: asistente administrativo/a, administrativo/a de personal junior, carga de datos, control de documentación.
Mostrador: operador/a de mostrador en comercios y locales gastronómicos.
Logística y depósito: control de mercadería, preparación de pedidos y atención interna.
Coordinación operativa junior: apoyo a encargados o jefes de área en tareas diarias.
Espero poder formar parte de su empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_432_cv_69692db2a046c9.07961349.pdf',
  'cv_69692db2a046c9.07961349.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69692db2a046c9.07961349.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T18:10:58+00:00'::timestamptz,
  '2026-01-15T18:10:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  433,
  'Rocio salvado',
  'rociosalvado00@gmail.com',
  '2644656275',
  'Cajero/a',
  NULL,
  'Hola buenas tardes, cualquier área de trabajo me gustaría. Estoy en busca de trabajo urgente. Me adapto y aprendo rápido',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_433_cv_696959bfe2e4f7.70598308.docx',
  'cv_696959bfe2e4f7.70598308.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696959bfe2e4f7.70598308.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T21:18:55+00:00'::timestamptz,
  '2026-01-15T21:18:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  434,
  'Alaniz Agüero Leticia Guadalupe',
  'letiaguero1@gmail.com',
  '2645091905',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_434_cv_696987b054fdf6.51939842.pdf',
  'cv_696987b054fdf6.51939842.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696987b054fdf6.51939842.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T00:34:56+00:00'::timestamptz,
  '2026-01-16T00:34:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  435,
  'Juan José Castro Poblete',
  'juancastro9@hotmail.com',
  '2645851559',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_435_cv_69698b9f1d0cf7.65940593.pdf',
  'cv_69698b9f1d0cf7.65940593.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69698b9f1d0cf7.65940593.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T00:51:43+00:00'::timestamptz,
  '2026-01-16T00:51:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;
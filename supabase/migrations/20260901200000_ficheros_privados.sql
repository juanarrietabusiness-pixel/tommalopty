-- =============================================================================
-- 0032 · Dónde apuntan los ficheros que no pueden ser públicos
-- =============================================================================
-- Cierra dos cosas que llevaban a medias desde las fases L2 y L3: la foto de la
-- prueba de entrega y el comprobante de un abono.
--
-- QUÉ CAMBIA Y QUÉ NO
--
-- `shipments.delivery_proof_key` ya existía desde la fase L2, y su comentario ya
-- decía que apunta a un bucket privado. Lo que faltaba era el bucket. Aquí solo
-- se añade la columna equivalente para los pagos.
--
-- LO QUE SE GUARDA ES UNA CLAVE, NO UNA URL
--
-- Y es la diferencia entera. Una URL es una llave: quien la tenga ve el fichero,
-- para siempre, aunque se la hayan reenviado. Una clave de objeto no sirve de
-- nada por sí sola — no hay dominio que la sirva— así que para ver el fichero
-- hay que pedirlo por una ruta que comprueba permisos.
--
-- Por eso la columna se llama `_key` y no `_url`, igual que la de los envíos: el
-- nombre es el recordatorio.
--
-- QUIÉN PUEDE VERLOS
--
-- Nadie nuevo. Estas columnas viven en tablas que ya tienen sus políticas:
-- `payments` es del equipo, y `shipments` lo ve el equipo y el motorizado que lo
-- lleva. No se añade ninguna política aquí porque no hace falta ninguna: quien
-- ya podía leer la fila puede leer la clave, y quien no, no.
-- =============================================================================

alter table public.payments
  add column if not exists receipt_key text;

comment on column public.payments.receipt_key is
  'Clave del comprobante en el bucket PRIVADO. Nunca una URL: suele ser la captura de una transferencia, con nombres y saldos.';

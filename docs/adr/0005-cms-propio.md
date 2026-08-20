# 0005 · CMS y CRM propios, sin plataforma externa

**Estado:** aceptada · agosto 2026

## Contexto

La tienda necesita editar banners, páginas legales y contenido sin desplegar
código, y gestionar fichas de cliente con notas y segmentación. Las opciones eran
un CMS headless externo (Contentful, Sanity, Payload, Directus) o tablas propias
gestionadas desde el panel.

## Decisión

**Tablas propias en Supabase**, editadas desde `apps/admin`. Sin plataforma
externa.

- CMS: `cms_pages`, `cms_banners`, `cms_posts`, `cms_menus`
- CRM: `customers`, `crm_notes`, `crm_tags`, `leads`, `campaigns`

## Por qué

**El objetivo del proyecto es tener panel propio.** Añadir una dependencia
externa —con su cuenta, su facturación, su modelo de permisos y su API— para
editar tres banners contradice ese objetivo.

**El contenido y los datos de negocio conviven.** Un banner que apunta a una
categoría, una campaña segmentada por historial de compra: con un CMS externo
eso son dos sistemas que hay que sincronizar; aquí es un `join`.

**Las mismas políticas RLS aplican.** No hay un segundo modelo de permisos que
mantener alineado.

## Lo que se acepta a cambio

Hay que construir la interfaz de edición, que hoy es deliberadamente simple: el
editor de páginas es texto plano donde cada párrafo se guarda como un bloque. Un
CMS externo traería edición enriquecida, versionado y flujo de aprobación desde
el primer día.

El formato de almacenamiento (`content` como array de bloques JSON) está pensado
para que sustituir el editor por uno enriquecido **no requiera migrar datos**.

## Cuándo reconsiderar

Si aparece un equipo de contenido con necesidades de flujo editorial real
—borradores colaborativos, aprobaciones, programación, traducciones—. En ese
caso, Payload o Directus se conectan al mismo Postgres sin migrar nada.

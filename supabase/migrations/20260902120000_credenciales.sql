-- Bóveda de credenciales: que la dueña pueda pegar sus claves sin llamar a nadie.
--
-- Hasta aquí, poner la clave de Yappy era editar variables de entorno en
-- Cloudflare y volver a desplegar. Quien lleva la tienda no puede hacer eso, así
-- que en la práctica acababa mandando su clave por WhatsApp a quien sí podía —
-- que es peor que cualquier cosa que esta tabla pueda hacer mal.
--
-- El modelo es el de n8n: los secretos se guardan cifrados aquí, y **una sola**
-- variable de entorno guarda la clave que los cifra. Esa no puede bajar a la
-- base de datos: la llave encima del cofre no es cifrado.

create table if not exists public.integration_credentials (
  -- El nombre de la variable de entorno equivalente, tal cual. Que sea la clave
  -- primaria hace imposible guardar dos valores para la misma credencial.
  clave           text primary key,
  proveedor       text not null,

  -- El sobre completo: `v1.<vector>.<cifrado>`. Nunca el valor en claro, ni
  -- siquiera para los campos que no son secretos: cifrarlo todo quita una
  -- decisión que alguien podría tomar mal más adelante.
  valor_cifrado   text not null,

  -- Si es secreto, la pista es `••••4821` y es lo único que ve el panel. Si no
  -- lo es —un ID de píxel, un remitente de correo— la pista es el valor entero,
  -- porque ese dato viaja al navegador de todas formas.
  es_secreto      boolean not null default true,
  pista           text not null,

  actualizado_por uuid references public.profiles (id) on delete set null,
  actualizado_en  timestamptz not null default now(),

  constraint integration_credentials_sobre_con_version
    check (valor_cifrado like 'v1.%')
);

comment on table public.integration_credentials is
  'Credenciales de integraciones cifradas con AES-256-GCM. La clave maestra vive '
  'en la variable de entorno CREDENCIALES_CLAVE_MAESTRA, nunca aquí. Sin políticas '
  'RLS a propósito: solo se alcanza con service_role, desde el servidor.';

comment on column public.integration_credentials.pista is
  'Lo que se le enseña a quien administra. Para un secreto son los cuatro últimos '
  'caracteres; para lo que no lo es, el valor entero.';

create index if not exists integration_credentials_proveedor_idx
  on public.integration_credentials (proveedor);

-- RLS activada y **sin una sola política**, que es la parte que hace el trabajo.
--
-- Una política de más aquí no se nota al leerla y lo abre todo: `integrations`,
-- la tabla de al lado, la puede leer cualquier `admin`. Si los secretos
-- estuvieran ahí, cualquier administrador se llevaría el texto cifrado a casa
-- para probar contra él con calma. Sin políticas, ningún rol con sesión —ni
-- `anon`, ni `authenticated`, ni un `superadmin`— saca una fila. Solo
-- `service_role`, que salta RLS y solo existe en el servidor.
alter table public.integration_credentials enable row level security;

-- Y los privilegios de tabla aparte, porque RLS decide filas y esto decide si
-- se puede siquiera preguntar. Toda tabla nueva en `public` nace con los siete
-- privilegios para `anon` porque el arranque de Supabase declara los suyos: hay
-- que revocarlo explícitamente, tabla por tabla, y nunca con un bucle.
revoke all on public.integration_credentials from anon;
revoke all on public.integration_credentials from authenticated;

grant select, insert, update, delete on public.integration_credentials to service_role;

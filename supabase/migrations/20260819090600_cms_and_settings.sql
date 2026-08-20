-- =============================================================================
-- 0007 · CMS propio y ajustes de la tienda
-- =============================================================================
-- Tablas propias en lugar de un CMS externo: el panel administrativo es la
-- interfaz de edición (brief §2). Migrar a Payload/Directus solo si hiciera falta.
-- =============================================================================

-- --- Páginas estáticas --------------------------------------------------------
create table if not exists public.cms_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  status          public.content_status not null default 'draft',
  -- Contenido por bloques: [{ "type": "richtext", "value": "..." }, ...]
  content         jsonb not null default '[]'::jsonb,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists cms_pages_status_idx on public.cms_pages (status, published_at desc);

drop trigger if exists set_updated_at on public.cms_pages;
create trigger set_updated_at before update on public.cms_pages
  for each row execute function public.set_updated_at();

-- --- Banners / bloques de campaña --------------------------------------------
-- `placement` mapea 1:1 con las zonas del esqueleto original:
--   'announcement_bar' · 'hero' · 'cta_band'
create table if not exists public.cms_banners (
  id           uuid primary key default gen_random_uuid(),
  placement    text not null,
  eyebrow      text,
  title        text,
  subtitle     text,
  cta_label    text,
  cta_url      text,
  media_url    text,
  theme        jsonb not null default '{}'::jsonb,
  position     integer not null default 0,
  is_active    boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cms_banners_valid_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists cms_banners_placement_idx
  on public.cms_banners (placement, position) where is_active;

drop trigger if exists set_updated_at on public.cms_banners;
create trigger set_updated_at before update on public.cms_banners
  for each row execute function public.set_updated_at();

-- --- Blog ---------------------------------------------------------------------
create table if not exists public.cms_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  content         jsonb not null default '[]'::jsonb,
  cover_url       text,
  tags            text[] not null default '{}',
  status          public.content_status not null default 'draft',
  seo_title       text,
  seo_description text,
  author_id       uuid references public.profiles (id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists cms_posts_status_idx on public.cms_posts (status, published_at desc);

drop trigger if exists set_updated_at on public.cms_posts;
create trigger set_updated_at before update on public.cms_posts
  for each row execute function public.set_updated_at();

-- --- Menús de navegación ------------------------------------------------------
create table if not exists public.cms_menus (
  id         uuid primary key default gen_random_uuid(),
  location   text not null unique,
  -- [{ "label": "Tienda", "url": "/tienda", "children": [] }]
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.cms_menus;
create trigger set_updated_at before update on public.cms_menus
  for each row execute function public.set_updated_at();

-- --- Ajustes de la tienda -----------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  is_public   boolean not null default false,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

comment on column public.settings.is_public is
  'true = legible por visitantes anónimos (branding, textos). Nunca marcar secretos.';

drop trigger if exists set_updated_at on public.settings;
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- --- Integraciones ------------------------------------------------------------
-- Solo configuración NO sensible y el interruptor de activación. Las claves de
-- pasarelas, Meta y email viven en variables de entorno / secret store del
-- hosting; nunca en la base de datos.
create table if not exists public.integrations (
  provider     text primary key,
  is_enabled   boolean not null default false,
  environment  text not null default 'sandbox',
  config       jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  constraint integrations_environment_valid check (environment in ('sandbox', 'production'))
);

comment on table public.integrations is
  'Activación y config no sensible de integraciones. Los secretos van en env vars.';

drop trigger if exists set_updated_at on public.integrations;
create trigger set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- --- Auditoría del panel ------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  changes     jsonb not null default '{}'::jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log (entity, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

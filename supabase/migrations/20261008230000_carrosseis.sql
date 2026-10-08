-- Carrosseis de 5 imagens (capa + 3 produtos + chamada pro grupo), 2 por dia: 12h e 20h.
-- Gerados no GitHub Actions (video/carrossel.mjs) 1 hora antes; o cockpit mostra pra baixar e postar.
create table if not exists public.carrosseis (
  id bigint generated always as identity primary key,
  dia date not null,
  turno text not null check (turno in ('12h', '20h')),
  titulo text,
  legenda text,
  slides jsonb not null,      -- [{feed: url 1080x1350 (Instagram), story: url 1080x1920 (TikTok)}, ...]
  itens text[] not null,      -- item_id dos produtos (nao repete em 7 dias)
  postado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (dia, turno)
);
create index if not exists carrosseis_dia on public.carrosseis (dia desc);

alter table public.carrosseis enable row level security;
revoke all on public.carrosseis from anon, authenticated;

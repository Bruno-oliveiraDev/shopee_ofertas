-- Pagina /bio da LP (link da bio do Instagram e do TikTok): conta visitas e cliques por rede.
create table if not exists public.bio_cliques (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  de text not null,        -- instagram | tiktok | outro
  destino text not null    -- visita | whatsapp | telegram
);
create index if not exists bio_cliques_em on public.bio_cliques (em desc);

alter table public.bio_cliques enable row level security;
revoke all on public.bio_cliques from anon, authenticated;

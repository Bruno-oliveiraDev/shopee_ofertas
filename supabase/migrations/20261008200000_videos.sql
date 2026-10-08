-- Videos gerados todo dia (GitHub Actions: video/lote.mjs) pra postar no Reels, TikTok, Shorts e Status.
-- O arquivo fica no Storage (bucket publico "videos", so leitura por link); a lista fica aqui.

create table if not exists public.videos (
  id bigint generated always as identity primary key,
  dia date not null,
  item_id text not null,
  nome text,
  categoria text,
  preco numeric,
  preco_de numeric,
  desconto numeric,
  url text not null,          -- mp4 no Storage
  capa text,                  -- jpg do quadro de 1,5 s
  legenda text,               -- texto pronto pra colar no post
  link text,                  -- link curto com subId "vd-..."
  duracao numeric,
  postado_em timestamptz,     -- marcado no cockpit
  criado_em timestamptz not null default now(),
  unique (dia, item_id)
);
create index if not exists videos_dia on public.videos (dia desc);

alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;

-- bucket publico: o link do mp4 abre e baixa sem login; so a service_role sobe arquivo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

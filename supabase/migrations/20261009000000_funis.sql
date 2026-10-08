-- Funis: de onde vem quem entra no grupo.
-- bio_cliques passa a guardar todos os funis (anuncio = LP com utm/fbclid, site = LP direto, instagram/tiktok = /bio).
-- membros: tamanho de cada grupo de hora em hora (quem entrou de verdade).
create table if not exists public.membros (
  id bigint generated always as identity primary key,
  medido_em timestamptz not null default now(),
  canal_id uuid not null,
  tipo text not null,
  membros int not null
);
create index if not exists membros_canal_medido on public.membros (canal_id, medido_em desc);

alter table public.membros enable row level security;
revoke all on public.membros from anon, authenticated;

select cron.schedule('membros', '40 * * * *', $$select public.chamar_funcao('coletar', '?tarefa=membros')$$);

-- Rode isso no SQL Editor do Supabase, uma vez.

create table if not exists public.ofertas (
  item_id      text primary key,
  shop_id      text,
  nome         text not null,
  preco        numeric not null,
  preco_de     numeric,
  desconto     integer default 0,
  comissao     numeric default 0,
  vendas       integer default 0,
  nota         numeric,
  loja         text,
  imagem       text,
  link         text not null,
  keyword      text,
  score        numeric default 0,
  status       text not null default 'pendente',
  erro         text,
  coletada_em  timestamptz not null default now(),
  enviada_em   timestamptz
);

-- a fila le sempre por status + score, entao o indice cobre o caso principal
create index if not exists ofertas_fila_idx
  on public.ofertas (status, score desc);

create index if not exists ofertas_coletada_idx
  on public.ofertas (coletada_em desc);

-- ninguem acessa essa tabela pelo navegador, so o script com service_role,
-- que ignora RLS. Deixar ligado sem policy fecha a porta para o resto.
alter table public.ofertas enable row level security;

-- Visao rapida de performance por palavra-chave, util depois de umas semanas
create or replace view public.desempenho_keywords as
select
  keyword,
  count(*)                                          as coletadas,
  count(*) filter (where status = 'enviada')        as enviadas,
  round(avg(comissao) * 100, 1)                     as comissao_media_pct,
  round(avg(desconto), 1)                           as desconto_medio_pct,
  round(avg(preco), 2)                              as ticket_medio
from public.ofertas
group by keyword
order by enviadas desc;

-- rode isso se a tabela ofertas ja existe
alter table public.ofertas add column if not exists gancho text;

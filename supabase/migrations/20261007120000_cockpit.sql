-- Cockpit: o robo deixa de ser "um grupo do Telegram" e passa a ter CANAIS
-- (Telegram e grupos de WhatsApp pela Evolution), cada um com a sua grade de horarios.
-- Cada post vira uma linha em "envios": da pra ver o que saiu, onde, quando e o que falhou.
-- A config (categorias, filtros, pesos) sai do config.json e vem para o banco, editavel pela tela.

-- ---------------------------------------------------------------------------
-- Quem entra no cockpit
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email     text primary key,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
insert into public.admins (email) values ('smartmiles4.0@gmail.com') on conflict do nothing;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'))
$$;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated, service_role;

drop policy if exists admins_le on public.admins;
create policy admins_le on public.admins for select to authenticated using (public.eh_admin());

-- ---------------------------------------------------------------------------
-- Canais
-- ---------------------------------------------------------------------------
create table if not exists public.canais (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  tipo               text not null check (tipo in ('telegram', 'whatsapp')),
  ativo              boolean not null default false,
  -- telegram: chat_id do grupo (vazio = secret TELEGRAM_CHAT_ID); whatsapp: id do grupo (...@g.us)
  destino            text,
  destino_nome       text,
  -- whatsapp: nome da instancia na Evolution
  instancia          text,
  -- 'HH:MM' de Brasilia, de 5 em 5 minutos (o agendador bate a cada 5 min)
  horarios           text[] not null default '{}',
  ofertas_por_rodada int not null default 1 check (ofertas_por_rodada between 1 and 5),
  criado_em          timestamptz not null default now()
);
alter table public.canais enable row level security;

-- ---------------------------------------------------------------------------
-- Envios: uma linha por post (ou tentativa) em cada canal
-- ---------------------------------------------------------------------------
create table if not exists public.envios (
  id        bigint generated always as identity primary key,
  canal_id  uuid not null references public.canais (id) on delete cascade,
  item_id   text references public.ofertas (item_id) on delete set null,
  tipo      text not null default 'oferta',      -- oferta | top
  status    text not null check (status in ('enviado', 'falha')),
  erro      text,
  origem    text not null default 'agendador',   -- agendador | cockpit | github
  criado_em timestamptz not null default now()
);
alter table public.envios enable row level security;

create index if not exists envios_canal_idx on public.envios (canal_id, criado_em desc);
create index if not exists envios_item_idx on public.envios (item_id, canal_id);
create index if not exists envios_data_idx on public.envios (criado_em desc);

-- ---------------------------------------------------------------------------
-- Config editavel (chave 'robo' = o antigo config.json, sem os horarios, que agora sao do canal)
-- ---------------------------------------------------------------------------
create table if not exists public.config (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.config enable row level security;

-- Segredos das integracoes (url e apikey da Evolution). Sem policy: so a Edge Function le.
create table if not exists public.segredos (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.segredos enable row level security;

-- ---------------------------------------------------------------------------
-- Acesso do dono pela tela (o robo usa service_role e ignora RLS)
-- ---------------------------------------------------------------------------
drop policy if exists canais_admin on public.canais;
create policy canais_admin on public.canais for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists envios_admin on public.envios;
create policy envios_admin on public.envios for select to authenticated using (public.eh_admin());

drop policy if exists config_admin on public.config;
create policy config_admin on public.config for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists ofertas_admin_le on public.ofertas;
create policy ofertas_admin_le on public.ofertas for select to authenticated using (public.eh_admin());

drop policy if exists ofertas_admin_muda on public.ofertas;
create policy ofertas_admin_muda on public.ofertas for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- ---------------------------------------------------------------------------
-- O canal que ja existe: o grupo do Telegram, com a grade de hoje (:05, :25, :45 das 8h as 21h)
-- e o historico do que ja foi enviado
-- ---------------------------------------------------------------------------
do $$
declare
  v_canal uuid;
begin
  if not exists (select 1 from public.canais where tipo = 'telegram') then
    insert into public.canais (nome, tipo, ativo, destino_nome, horarios, ofertas_por_rodada)
    values (
      'Telegram · Achadinhos Kid', 'telegram', true, 'Achadinhos Kid',
      array(
        select lpad(h::text, 2, '0') || ':' || m
        from generate_series(8, 21) as h, unnest(array['05', '25', '45']) as m
        order by 1
      ),
      1
    )
    returning id into v_canal;

    insert into public.envios (canal_id, item_id, tipo, status, origem, criado_em)
    select v_canal, item_id, 'oferta', 'enviado', 'agendador', enviada_em
    from public.ofertas
    where status = 'enviada' and enviada_em is not null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fila de cada canal: oferta pendente que ainda nao saiu NAQUELE canal.
-- (o status 'enviada' da oferta fica so para o historico antigo; agora quem diz
--  "ja saiu" e a tabela envios, por canal)
-- Oferta que falhou 2x no mesmo canal sai da fila dele.
-- ---------------------------------------------------------------------------
create or replace function public.candidatas_do_canal(p_canal uuid, p_keywords text[], p_limite int default 200)
returns setof public.ofertas
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.ofertas o
  where o.status = 'pendente'
    and o.keyword = any (p_keywords)
    and not exists (
      select 1 from public.envios e
      where e.item_id = o.item_id and e.canal_id = p_canal and e.status = 'enviado'
    )
    and (
      select count(*) from public.envios e
      where e.item_id = o.item_id and e.canal_id = p_canal and e.status = 'falha'
    ) < 2
  order by o.score desc
  limit p_limite
$$;
revoke execute on function public.candidatas_do_canal(uuid, text[], int) from public, anon, authenticated;
grant execute on function public.candidatas_do_canal(uuid, text[], int) to service_role;

-- Fila por busca (a tela agrupa por categoria)
create or replace view public.fila_por_keyword with (security_invoker = true) as
select keyword, count(*) as pendentes, max(visto_em) as ultima_vez_vista
from public.ofertas
where status = 'pendente'
group by keyword;

-- as views antigas rodavam como dona e ficavam abertas pra chave publica
alter view public.saude_fila set (security_invoker = true);
alter view public.desempenho_keywords set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Agendador visto pela tela: jobs, ultimas execucoes e respostas das funcoes
-- ---------------------------------------------------------------------------
create or replace function public.cockpit_agendador()
returns jsonb
language plpgsql
security definer
set search_path = public, cron, net
as $$
begin
  if not public.eh_admin() then
    raise exception 'sem acesso';
  end if;

  return jsonb_build_object(
    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', jobname, 'quando', schedule, 'ativo', active) order by jobname), '[]')
      from cron.job
    ),
    'execucoes', (
      select coalesce(jsonb_agg(x), '[]') from (
        select j.jobname as nome, d.status, d.return_message as mensagem, d.start_time as inicio
        from cron.job_run_details d
        join cron.job j using (jobid)
        order by d.start_time desc
        limit 40
      ) x
    ),
    'respostas', (
      select coalesce(jsonb_agg(x), '[]') from (
        select id, status_code, left(content, 800) as conteudo, error_msg as erro, created as quando
        from net._http_response
        order by id desc
        limit 30
      ) x
    )
  );
end;
$$;
revoke execute on function public.cockpit_agendador() from public, anon;
grant execute on function public.cockpit_agendador() to authenticated;

-- Config de hoje (o config.json do robo, sem a grade de horarios)
insert into public.config (chave, valor) values ('robo', $cfg${
  "endpoint": "https://open-api.affiliate.shopee.com.br/graphql",
  "categorias": {
    "roupa": [
      "body bebê kit",
      "macacão bebê",
      "kit pagão bebê",
      "conjunto bebê menina",
      "conjunto bebê menino",
      "conjunto infantil menino",
      "conjunto infantil menina",
      "pijama infantil",
      "vestido infantil",
      "kit short infantil",
      "kit camiseta infantil",
      "meia bebê antiderrapante",
      "toalha de banho bebê capuz",
      "manta bebê",
      "cueiro bebê",
      "babador bebê kit",
      "pano de boca bebê",
      "fralda de pano kit"
    ],
    "fralda": [
      "fralda descartável",
      "fralda pampers",
      "fralda huggies",
      "fralda turma da mônica",
      "fralda personal baby",
      "fralda calça"
    ],
    "higiene": [
      "lenço umedecido bebê",
      "pomada assadura",
      "escova de dente infantil",
      "cortador de unha bebê",
      "repelente adesivo infantil"
    ],
    "alimentacao": [
      "kit talher bebê silicone",
      "mamadeira anticólica",
      "copo de transição",
      "chupeta",
      "prendedor de chupeta"
    ],
    "brinquedo": [
      "blocos de montar infantil",
      "brinquedo montessori",
      "lousa mágica",
      "massinha de modelar"
    ],
    "brinquedo_bebe": [
      "mordedor bebê",
      "brinquedo sensorial bebê"
    ],
    "seguranca": [
      "protetor de quina",
      "protetor de tomada"
    ]
  },
  "limitePorBusca": 20,
  "paginasPorBusca": 3,
  "pausaEntreBuscasMs": 500,
  "listType": 0,
  "sortType": 2,
  "filtros": {
    "comissaoMinima": 0.05,
    "descontoMinimo": 5,
    "vendasMinimas": 200,
    "notaMinima": 4.6,
    "precoMinimo": 10,
    "precoMaximo": 400,
    "palavrasBloqueadas": [
      "adulto",
      "adultos",
      "sex",
      "erotic",
      "erotico",
      "lingerie",
      "sensual",
      "+18",
      "usado",
      "seminovo"
    ]
  },
  "disparo": {
    "intervaloSegundos": 5,
    "validadeEmDias": 3
  },
  "campanha": {
    "nome": "Dia das Crianças",
    "inicio": "2026-10-02",
    "fim": "2026-10-12",
    "categorias": [
      "brinquedo",
      "brinquedo_bebe"
    ],
    "selo": "🎁 Ideia de presente pro Dia das Crianças",
    "topDoDiaHora": 21
  },
  "pesoCategoria": {
    "roupa": 3,
    "fralda": 3,
    "higiene": 2,
    "alimentacao": 1,
    "seguranca": 1,
    "brinquedo_bebe": 1,
    "brinquedo": 1
  },
  "filtrosPorCategoria": {
    "fralda": {
      "comissaoMinima": 0.02,
      "descontoMinimo": 3
    }
  }
}$cfg$::jsonb)
on conflict (chave) do nothing;

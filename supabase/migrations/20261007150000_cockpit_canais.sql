-- Cockpit: canais (Telegram e grupos de WhatsApp pela Evolution), cada um com a sua grade de horarios.
-- So ACRESCENTA ao que ja existe (envios, ajustes, bloqueios, coletas, cockpit_acao, cockpit_saude):
--   * tabela canais (nova)
--   * envios ganha canal_id, origem e tipo
--   * ajustes ganha a chave 'robo' (o config.json, editavel pela tela) se ainda nao tiver
--   * funcao candidatas_do_canal: a fila de cada canal
-- Ninguem le essas tabelas pelo navegador: a tela passa pela Edge Function "cockpit",
-- que usa a service_role (cockpit sem senha por enquanto).

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

alter table public.envios add column if not exists canal_id uuid references public.canais (id) on delete set null;
alter table public.envios add column if not exists origem text not null default 'agendador';  -- agendador | cockpit | github
alter table public.envios add column if not exists tipo text not null default 'oferta';       -- oferta | top
create index if not exists envios_canal_item_idx on public.envios (canal_id, item_id);
create index if not exists envios_enviado_idx on public.envios (enviado_em desc);

-- Segredos das integracoes (url e apikey da Evolution). Sem policy: so a Edge Function le.
create table if not exists public.segredos (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.segredos enable row level security;

-- O canal que ja existe: o grupo do Telegram, com a grade de hoje (:05, :25, :45 das 8h as 21h),
-- e o historico do que ja saiu nele (pra nao repetir oferta)
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

    insert into public.envios (item_id, canal, destino, enviado_em, ok, canal_id, origem)
    select item_id, 'telegram', 'grupo', enviada_em, true, v_canal, 'agendador'
    from public.ofertas
    where status = 'enviada' and enviada_em is not null;
  end if;
end;
$$;

-- Fila de um canal: pendente, ou ja enviada em OUTRO canal e vista pela Shopee ha pouco (preco ainda vale),
-- que ainda nao saiu NESTE canal. Fixada (prioridade) vem primeiro. 2 falhas no canal tiram a oferta dele.
-- Pulada, bloqueada e expirada nunca entram.
create or replace function public.candidatas_do_canal(p_canal uuid, p_keywords text[], p_validade_dias int default 3, p_limite int default 200)
returns setof public.ofertas
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.ofertas o
  where o.keyword = any (p_keywords)
    and (
      o.status = 'pendente'
      or (o.status = 'enviada' and o.visto_em > now() - make_interval(days => p_validade_dias))
    )
    and not exists (
      select 1 from public.envios e where e.item_id = o.item_id and e.canal_id = p_canal and e.ok
    )
    and 2 > (
      select count(*) from public.envios e where e.item_id = o.item_id and e.canal_id = p_canal and not e.ok
    )
  order by o.prioridade desc, o.score desc
  limit p_limite
$$;
revoke execute on function public.candidatas_do_canal(uuid, text[], int, int) from public, anon, authenticated;
grant execute on function public.candidatas_do_canal(uuid, text[], int, int) to service_role;

-- Config do robo (o config.json, sem a grade de horarios, que agora e de cada canal)
insert into public.ajustes (chave, valor) values ('robo', $cfg${
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

-- Cockpit sem senha (decisao do Bruno, 07/10): a funcao "cockpit" chama esta, que pega a chave do Vault
-- por conta propria e repassa para a cockpit_acao que ja existia (fixar, pular, bloquear, pausar...).
-- Se ainda nao existir chave no Vault, cria uma aleatoria. So a service_role executa.
create or replace function public.cockpit_acao_interna(p_acao text, p_alvo text default null, p_valor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text;
begin
  select decrypted_secret into v_chave from vault.decrypted_secrets where name = 'cockpit_chave';
  if v_chave is null then
    v_chave := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    perform vault.create_secret(v_chave, 'cockpit_chave');
  end if;
  return public.cockpit_acao(v_chave, p_acao, p_alvo, p_valor);
end;
$$;
revoke execute on function public.cockpit_acao_interna(text, text, text) from public, anon, authenticated;
grant execute on function public.cockpit_acao_interna(text, text, text) to service_role;

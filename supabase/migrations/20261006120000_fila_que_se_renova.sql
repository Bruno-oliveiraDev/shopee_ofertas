-- Fila que se renova.
-- Antes: a coleta ignorava produto que ja existia e a validade contava da PRIMEIRA coleta,
-- entao um produto que continuava na Shopee expirava em 3 dias e nunca mais voltava.
-- Agora: visto_em marca a ultima vez que a Shopee mostrou o produto; quem reaparece
-- volta pra fila com preco atualizado. O que ja foi enviado nunca e tocado (nao repete post).

alter table public.ofertas add column if not exists visto_em timestamptz;
update public.ofertas set visto_em = coletada_em where visto_em is null;
alter table public.ofertas alter column visto_em set default now();
alter table public.ofertas alter column visto_em set not null;

create index if not exists ofertas_visto_idx on public.ofertas (status, visto_em);

create or replace function public.abastecer_fila(linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novas int;
  v_renovadas int;
begin
  with dados as (
    select distinct on (item_id) *
    from jsonb_to_recordset(linhas) as x(
      item_id text, shop_id text, nome text, preco numeric, preco_de numeric,
      desconto integer, comissao numeric, vendas integer, nota numeric,
      loja text, imagem text, link text, keyword text, score numeric
    )
    where item_id is not null
    order by item_id, score desc nulls last
  ),
  gravadas as (
    insert into public.ofertas as o (
      item_id, shop_id, nome, preco, preco_de, desconto, comissao, vendas, nota,
      loja, imagem, link, keyword, score, status, coletada_em, visto_em
    )
    select
      item_id, shop_id, nome, preco, preco_de, coalesce(desconto, 0), coalesce(comissao, 0),
      coalesce(vendas, 0), nota, loja, imagem, link, keyword, coalesce(score, 0),
      'pendente', now(), now()
    from dados
    on conflict (item_id) do update set
      nome     = excluded.nome,
      preco    = excluded.preco,
      preco_de = excluded.preco_de,
      desconto = excluded.desconto,
      comissao = excluded.comissao,
      vendas   = excluded.vendas,
      nota     = excluded.nota,
      loja     = excluded.loja,
      imagem   = excluded.imagem,
      link     = excluded.link,
      keyword  = excluded.keyword,
      score    = excluded.score,
      visto_em = now(),
      status   = 'pendente'
    where o.status in ('pendente', 'expirada')
    returning (xmax = 0) as nova
  )
  select count(*) filter (where nova), count(*) filter (where not nova)
    into v_novas, v_renovadas
  from gravadas;

  return jsonb_build_object('novas', v_novas, 'renovadas', v_renovadas);
end;
$$;

-- so o robo (service_role) abastece a fila
revoke execute on function public.abastecer_fila(jsonb) from public, anon, authenticated;
grant execute on function public.abastecer_fila(jsonb) to service_role;

-- saude da fila num olhar so
create or replace view public.saude_fila as
select
  count(*) filter (where status = 'pendente')                                        as pendentes,
  count(*) filter (where status = 'enviada' and enviada_em > now() - interval '24 hours') as enviadas_24h,
  count(*) filter (where status = 'expirada')                                        as expiradas,
  count(*) filter (where status = 'falha')                                           as falhas,
  max(visto_em)                                                                      as ultima_coleta,
  max(enviada_em)                                                                    as ultimo_envio
from public.ofertas;

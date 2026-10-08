-- Retorno: quanto foi investido em anuncio x quanto voltou de comissao da Shopee.
-- Rodar DEPOIS de publicar as funcoes (o agendador chama coletar?tarefa=vendas).

-- Uma linha por venda (conversao) que a Shopee atribuiu aos nossos links
create table if not exists public.vendas (
  conversion_id text primary key,
  compra_em timestamptz,
  clique_em timestamptz,
  situacao text not null default 'pendente',      -- pendente | confirmada | cancelada
  status_shopee text,
  comissao numeric not null default 0,             -- tudo que nao foi cancelado
  comissao_confirmada numeric not null default 0,  -- so pedido concluido (a Shopee paga)
  comissao_shopee numeric not null default 0,      -- valor cru da Shopee, pra conferir
  valor_pedido numeric not null default 0,
  itens int not null default 0,
  sub_ids text,                                    -- "wa-roupa-h2005-c58e6e"
  canal text,                                      -- wa | tg (null = link sem subId)
  categoria text,
  horario text,
  pedidos jsonb,
  atualizado_em timestamptz not null default now()
);
create index if not exists vendas_compra_em on public.vendas (compra_em desc);

-- Gasto em anuncio por dia (digitado no cockpit)
create table if not exists public.investimentos (
  dia date primary key,
  valor numeric not null check (valor >= 0),
  nota text,
  atualizado_em timestamptz not null default now()
);

-- So a service_role (funcoes) le e escreve
alter table public.vendas enable row level security;
alter table public.investimentos enable row level security;
revoke all on public.vendas, public.investimentos from anon, authenticated;

-- Vendas da Shopee toda hora, aos :15
select cron.schedule('vendas', '15 * * * *', $$select public.chamar_funcao('coletar', '?tarefa=vendas')$$);

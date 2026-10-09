-- Trocar produto de um carrossel pelo cockpit.
-- O cockpit grava o pedido em "trocas" ({"2": "item_id novo"}, posicao 1 a 3) e o GitHub Actions
-- (carrossel-trocas.yml, a cada 5 min) regera as 5 imagens e limpa o pedido.
alter table public.carrosseis
  add column if not exists trocas jsonb,
  add column if not exists trocas_pedido_em timestamptz,
  add column if not exists troca_erro text;

-- Carrossel de DICAS (zero venda), 1 por dia: turno 'dicas' na tabela e agendamento as 15h de Brasilia (posta 16h).
alter table public.carrosseis drop constraint if exists carrosseis_turno_check;
alter table public.carrosseis add constraint carrosseis_turno_check check (turno in ('12h', '20h', 'dicas'));

-- Horario em UTC (Brasilia = UTC-3). Mesmo nome substitui, nao duplica.
select cron.schedule('gh-carrossel-dicas', '0 18 * * *', $$select public.rodar_workflow('carrossel.yml', '{"turno":"dicas"}')$$);  -- 15h

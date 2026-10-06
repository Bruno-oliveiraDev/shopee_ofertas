-- 3 ofertas por hora, espacadas: :05, :25 e :45, das 8h05 as 21h45 de Brasilia (42 por dia).
-- Horarios em UTC (Brasilia = UTC-3): 11h..23h e 0h UTC.
-- ATENCAO: isto LIGA o disparo do Supabase. So rode na hora da troca, junto com o desligamento
-- do disparo do GitHub, senao os dois postam ao mesmo tempo.
select cron.schedule('disparar-telegram', '5,25,45 0,11-23 * * *', $$select public.chamar_funcao('disparar')$$);

-- Voltar para 1 por hora:
--   select cron.schedule('disparar-telegram', '5 0,11-23 * * *', $$select public.chamar_funcao('disparar')$$);

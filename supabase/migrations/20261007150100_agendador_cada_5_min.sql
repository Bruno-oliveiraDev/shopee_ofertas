-- Rodar SO DEPOIS de publicar a funcao "disparar" nova (a que olha a grade de cada canal).
-- O agendador passa a bater a cada 5 minutos; cada canal decide se e a hora dele
-- pela lista "horarios" (editavel no cockpit). Pausar um canal = desligar o "ativo" dele.
select cron.unschedule('disparar-telegram') where exists (select 1 from cron.job where jobname = 'disparar-telegram');
select cron.schedule('disparar', '*/5 * * * *', $$select public.chamar_funcao('disparar')$$);

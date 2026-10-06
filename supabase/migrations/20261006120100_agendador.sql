-- Agendador no proprio banco: pg_cron chama as Edge Functions na hora exata.
-- Pre-requisito (uma vez, no SQL Editor, com os seus valores; nao vai para o git):
--   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'projeto_url');
--   select vault.create_secret('UM-SEGREDO-LONGO-ALEATORIO', 'cron_secret');
-- O mesmo cron_secret vai como secret CRON_SECRET das Edge Functions.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.chamar_funcao(nome text, consulta text default '')
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'projeto_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'cron_secret';

  if v_url is null or v_segredo is null then
    raise exception 'Cadastre projeto_url e cron_secret no Vault antes de ligar o agendador';
  end if;

  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || nome || consulta,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
end;
$$;

revoke execute on function public.chamar_funcao(text, text) from public, anon, authenticated;

-- Horarios em UTC (Brasilia = UTC-3).
-- Disparo: 08:05 a 21:05 de Brasilia, de hora em hora = 11:05..23:05 e 00:05 UTC (14 rodadas/dia).
select cron.schedule('disparar-telegram', '5 0,11-23 * * *', $$select public.chamar_funcao('disparar')$$);

-- Coleta: 7h, 13h e 19h de Brasilia, dividida em 3 chamadas de ~1/3 das buscas cada.
select cron.schedule('coletar-parte-1', '0 10,16,22 * * *', $$select public.chamar_funcao('coletar', '?parte=1&de=3')$$);
select cron.schedule('coletar-parte-2', '2 10,16,22 * * *', $$select public.chamar_funcao('coletar', '?parte=2&de=3')$$);
select cron.schedule('coletar-parte-3', '4 10,16,22 * * *', $$select public.chamar_funcao('coletar', '?parte=3&de=3')$$);

-- Para ver o que rodou:  select * from cron.job_run_details order by start_time desc limit 20;
-- Resposta das funcoes:  select id, status_code, content from net._http_response order by id desc limit 20;
-- Pausar o disparo:      select cron.unschedule('disparar-telegram');

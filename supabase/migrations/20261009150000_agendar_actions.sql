-- O agendador do GitHub parou de rodar sozinho em 06/10 (artes, carrosseis e trocas so rodavam na mao).
-- Agora quem acorda os workflows e o pg_cron do banco, que nunca falhou: ele chama a API do GitHub
-- (workflow_dispatch) na hora certa. Os .yml ficaram so com workflow_dispatch, pra nao rodar 2x.
--
-- Pre-requisito (uma vez, no SQL Editor; o token NAO vai pro git):
--   1. GitHub > Settings > Developer settings > Fine-grained tokens > Generate new token
--      Repository access: so o shopee_ofertas | Permissions > Actions: Read and write | validade 1 ano
--   2. select vault.create_secret('github_pat_...', 'github_token');

create or replace function public.rodar_workflow(arquivo text, entradas jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'github_token';
  if v_token is null then
    raise exception 'Cadastre o github_token no Vault antes de ligar o agendador dos workflows';
  end if;

  -- resposta 204 = GitHub aceitou (ver em net._http_response)
  return net.http_post(
    url := 'https://api.github.com/repos/Bruno-oliveiraDev/shopee_ofertas/actions/workflows/' || arquivo || '/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'achadinhos-agendador',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main', 'inputs', entradas),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function public.rodar_workflow(text, jsonb) from public, anon, authenticated;

-- Troca de produto so acorda o GitHub quando tem pedido (antes rodava 288x/dia a toa)
create or replace function public.rodar_trocas_pendentes()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from public.carrosseis where trocas is not null) then
    return public.rodar_workflow('carrossel-trocas.yml');
  end if;
  return null;
end;
$$;

revoke execute on function public.rodar_trocas_pendentes() from public, anon, authenticated;

-- Horarios em UTC (Brasilia = UTC-3). Rodar de novo este arquivo nao duplica: cron.schedule com o mesmo nome substitui.
select cron.schedule('gh-artes',         '0 10 * * *',  $$select public.rodar_workflow('videos.yml')$$);                          -- 07h
select cron.schedule('gh-carrossel-12h', '0 14 * * *',  $$select public.rodar_workflow('carrossel.yml', '{"turno":"12h"}')$$);  -- 11h
select cron.schedule('gh-carrossel-20h', '0 22 * * *',  $$select public.rodar_workflow('carrossel.yml', '{"turno":"20h"}')$$);  -- 19h
select cron.schedule('gh-trocas',        '*/5 * * * *', $$select public.rodar_trocas_pendentes()$$);

-- Conferir: select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid)
--             where jobname like 'gh-%' order by start_time desc limit 10;
--           select id, status_code, left(content, 200) from net._http_response order by id desc limit 10;

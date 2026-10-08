-- O video virou arte estatica (decisao do Bruno, 08/10): story 1080x1920 em url, feed 1080x1350 em url_feed.
-- A tabela continua "videos" (o lote e o cockpit ja usam esse nome).
alter table public.videos add column if not exists formato text not null default 'arte';
alter table public.videos add column if not exists url_feed text;

-- os 2 videos de teste de 08/10 saem da lista (o arquivo fica no Storage)
delete from public.videos where url like '%.mp4';

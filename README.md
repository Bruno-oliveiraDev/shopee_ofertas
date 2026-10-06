# Shopee Ofertas no Telegram

Coleta ofertas na Open API de Afiliados da Shopee, guarda numa fila no Supabase e posta no grupo do Telegram. Roda inteiro no Supabase: o `pg_cron` do banco chama duas Edge Functions na hora exata. Sem servidor e sem dependência npm.

```
pg_cron 7h/13h/19h  ->  Edge Function coletar   ->  fila (tabela ofertas)
pg_cron 8h05..21h05 ->  Edge Function disparar  ->  Telegram (14 posts/dia)
```

O GitHub Actions ficou só como plano B, com os botões manuais **Coletar ofertas** e **Disparar no Telegram**. O agendador do GitHub atrasava de 3 a 6 horas e pulava execuções: dos disparos de hora em hora, rodavam 3 a 5 por dia.

## Vindo da versão casa e cozinha

Se o Supabase é o mesmo da versão anterior, a fila ainda tem ofertas de cozinha pendentes. Rode isso uma vez no SQL Editor antes do próximo disparo, senão elas saem no grupo infantil:

```sql
update public.ofertas set status = expirada where status = pendente;
```

O histórico continua na tabela e a view `desempenho_keywords` segue funcionando, só com as palavras novas aparecendo dali pra frente.

## Curadoria do grupo infantil

O `config.json` tem duas travas a mais que a versão de casa:

- `notaMinima`: produto sem avaliação ou abaixo de 4,6 estrelas não entra. Com bebê, a família confia no que você indica.
- `palavrasBloqueadas`: qualquer termo dessa lista no nome do produto derruba a oferta. Busca por brinquedo na Shopee às vezes traz produto adulto, e um post desses acaba com o grupo.

Ficaram de fora de propósito: cadeirinha de carro, bebê conforto e andador. Cadeirinha precisa de selo do Inmetro, e boa parte do que é vendido em marketplace não tem. Andador é desaconselhado pela Sociedade Brasileira de Pediatria. Indicar esses produtos num grupo de pais é risco pra criança e pra reputação do grupo.

A IA que escreve o gancho está proibida de prometer segurança, benefício pra saúde ou desenvolvimento, e de inventar faixa etária.

## Como cada mensagem é escolhida

- **Gancho:** a IA (Gemini) escreve no tom de mãe indicando um achado. Se ela estiver fora do ar, o disparo usa uma frase escrita à mão da categoria (`src/frases.js`), sem repetir as últimas 15.
- **Ordem:** desconto, vendas e nota pesam junto com a comissão. Nunca saem duas ofertas da mesma categoria das 2 últimas. À noite (18h em diante) brinquedo e roupa ganham peso; de dia, enxoval e rotina (`src/selecao.js`).
- **Campanha:** `config.json > campanha` define período, categorias, selo e a hora da lista "Top 5 presentes" (rodada das :05). Fora do período, nada muda. Para a próxima data (Black Friday, Natal), basta trocar esse bloco.

## Estrutura

```
supabase/functions/_shared/config.json   buscas por categoria, filtros e campanha
supabase/functions/_shared/shopee.js     assinatura SHA256 e consulta GraphQL (com paginação)
supabase/functions/_shared/db.js         leitura e escrita no Supabase via REST
supabase/functions/_shared/telegram.js   montagem da mensagem e envio
supabase/functions/_shared/selecao.js    escolhe a próxima oferta (categoria, turno, campanha)
supabase/functions/_shared/coleta.js     abastece a fila
supabase/functions/_shared/disparo.js    posta a próxima da fila
supabase/functions/coletar/              Edge Function chamada pelo pg_cron
supabase/functions/disparar/             Edge Function chamada pelo pg_cron
supabase/migrations/                     fila que se renova + agendador
schema.sql                               tabela original (instalação do zero)
scripts/                                 os mesmos fluxos rodando em Node (plano B no GitHub)
```

O código em `_shared` é um só: roda na Edge Function (Deno) e nos scripts do GitHub (Node).

## Passo a passo

### 1. Banco

Crie um projeto novo em supabase.com, plano Free. Abra o SQL Editor, cole o conteudo de `schema.sql` e rode.

Em Settings, API, copie a URL do projeto e a chave `service_role`. Essa chave ignora RLS e nunca pode ir para o código.

### 2. Bot do Telegram

Fale com o @BotFather, `/newbot`, e guarde o token.

Adicione o bot ao grupo e promova a administrador, senão ele não consegue postar. Para descobrir o ID do grupo, mande qualquer mensagem lá e abra:

```
https://api.telegram.org/bot<SEU_TOKEN>/getUpdates
```

O ID do grupo vem negativo, no formato `-1001234567890`.

### 3. Supabase: migrations, segredos e funções

1. No SQL Editor, rode os dois arquivos de `supabase/migrations/`, na ordem.
2. Ainda no SQL Editor, cadastre no Vault a URL do projeto e um segredo longo e aleatório. Ele é a senha que o agendador usa para chamar as funções:

   ```sql
   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'projeto_url');
   select vault.create_secret('UM-SEGREDO-LONGO-ALEATORIO', 'cron_secret');
   ```

3. Em Edge Functions, Secrets, cadastre `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `CRON_SECRET`. O `CRON_SECRET` tem o mesmo valor do `cron_secret` do Vault. `SUPABASE_URL` e a service role a função já recebe sozinha.
4. Publique as funções `coletar` e `disparar` com verificação de JWT desligada. Quem as protege é o `CRON_SECRET`:

   ```bash
   supabase functions deploy coletar --no-verify-jwt
   supabase functions deploy disparar --no-verify-jwt
   ```

5. Teste sem postar: chame `disparar?teste=1` com o header `x-cron-secret`. Ela devolve a oferta escolhida e a mensagem pronta.

Para acompanhar:

```sql
select * from saude_fila;                                                   -- pendentes, enviadas nas últimas 24h, último envio
select * from cron.job_run_details order by start_time desc limit 20;       -- o que o agendador rodou
select id, status_code, content from net._http_response order by id desc limit 20; -- o que as funções responderam
```

### 4. Repositório (plano B)

Para os botões manuais do GitHub Actions funcionarem, cadastre em Settings, Secrets and variables, Actions:

| Secret | Onde pegar |
|---|---|
| `SHOPEE_APP_ID` | painel de afiliados da Shopee |
| `SHOPEE_APP_SECRET` | painel de afiliados da Shopee |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_CHAT_ID` | getUpdates |
| `SUPABASE_URL` | Settings, API |
| `SUPABASE_SERVICE_KEY` | Settings, API, service_role |

Na aba Actions, **Coletar ofertas** roda uma coleta completa, e **Disparar no Telegram** roda uma rodada. Por padrão, o disparo manual vem marcado como teste e não posta.

Se a coleta vier zerada, afrouxe os filtros no `config.json`. Comece com `comissaoMinima: 0.05` e `vendasMinimas: 50`.

## Rodando local

```bash
export SHOPEE_APP_ID=...
export SHOPEE_APP_SECRET=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...
node scripts/coletar.js
TESTE=1 node scripts/disparar.js
```

Precisa de Node 20 ou mais novo, por causa do `fetch` nativo.

## Ajustes que valem a pena

**Volume.** São 3 rodadas por hora, às :05, :25 e :45, das 8h05 às 21h45. Isso dá 42 rodadas por dia (migration `tres_por_hora`). `ofertasPorRodada` no `config.json` controla quantas ofertas saem em cada rodada: deixe em 1, porque espaçado converte melhor que rajada. Os horários ficam no `cron.schedule('disparar-telegram', ...)`. A lista `disparo.horarios` do config não é mais usada.

A trava contra post repetido (`JANELA_SEM_REPETIR_MIN` em `disparo.js`, 10 min) precisa ser menor que o espaço entre as rodadas.

**Fila.** A coleta busca `paginasPorBusca` páginas de cada palavra-chave. A validade (`validadeEmDias`) conta da última vez que a Shopee mostrou o produto, não da primeira: quem continua na Shopee continua na fila, com o preço atualizado. Produto já enviado nunca volta, então o grupo não recebe post repetido.

**Curadoria.** Os filtros são a diferença entre um grupo que as pessoas seguem e um grupo que elas silenciam. Comissão alta com produto ruim queima a lista.

**Horário.** Os cron do `pg_cron` estão em UTC. BRT é UTC-3, então `11` significa 8h aqui.

**Medir.** Depois de duas ou três semanas, a view `desempenho_keywords` mostra quais palavras-chave rendem. Corte as que não entregam e abra espaço para testar outras.

## Limites conhecidos

Projeto Supabase gratuito pausa após uma semana sem consultas. Com o agendador rodando todo dia, isso não acontece.

Cada chamada da coleta processa um terço das buscas, para caber no tempo limite das Edge Functions. Se aumentar muito as palavras-chave ou as páginas, divida em mais partes (`?parte=N&de=M` na migration).

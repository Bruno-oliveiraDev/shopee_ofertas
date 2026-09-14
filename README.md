# Shopee Ofertas no Telegram

Coleta ofertas na Open API de Afiliados da Shopee, guarda numa fila no Supabase e posta no grupo do Telegram. Roda inteiro no GitHub Actions, sem servidor e sem dependência npm.

```
coleta (3x ao dia)  ->  Supabase (fila)  ->  disparo (de hora em hora)  ->  Telegram
```

## Estrutura

```
config.json                     keywords e filtros de curadoria
schema.sql                      tabela e view, rodar uma vez no Supabase
src/shopee.js                   assinatura SHA256 e consulta GraphQL
src/db.js                       leitura e escrita no Supabase via REST
src/telegram.js                 montagem da mensagem e envio
scripts/coletar.js              abastece a fila
scripts/disparar.js             posta as proximas da fila
.github/workflows/              os tres agendamentos
```

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

### 3. Repositório

Crie um repositório privado, suba esses arquivos e cadastre em Settings, Secrets and variables, Actions:

| Secret | Onde pegar |
|---|---|
| `SHOPEE_APP_ID` | painel de afiliados da Shopee |
| `SHOPEE_APP_SECRET` | painel de afiliados da Shopee |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `TELEGRAM_CHAT_ID` | getUpdates |
| `SUPABASE_URL` | Settings, API |
| `SUPABASE_SERVICE_KEY` | Settings, API, service_role |

### 4. Primeiro teste

Na aba Actions, rode **Coletar ofertas** no botão `Run workflow`. O log mostra quantas ofertas cada palavra-chave devolveu e quantas passaram no filtro. Confira a tabela `ofertas` no Supabase.

Se vier tudo zerado, afrouxe os filtros no `config.json`. Comece com `comissaoMinima: 0.05` e `vendasMinimas: 50`.

Com a fila abastecida, rode **Disparar no Telegram** na mão e veja o post chegar no grupo.

### 5. Ativar

Os cron já estão nos workflows e passam a valer sozinhos depois do primeiro commit na branch padrão.

## Rodando local

```bash
export SHOPEE_APP_ID=...
export SHOPEE_APP_SECRET=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...
node scripts/coletar.js
```

Precisa de Node 20 ou mais novo, por causa do `fetch` nativo.

## Ajustes que valem a pena

**Volume.** `ofertasPorRodada` no `config.json` controla quantas ofertas saem por hora. Duas por hora, das 8h as 20h, dá 26 posts por dia. Para grupo novo, comece com uma.

**Curadoria.** Os filtros são a diferença entre um grupo que as pessoas seguem e um grupo que elas silenciam. Comissão alta com produto ruim queima a lista.

**Horário.** Os cron estão em UTC. BRT é UTC-3, então `11` no arquivo significa 8h aqui.

**Medir.** Depois de duas ou três semanas, a view `desempenho_keywords` mostra quais palavras-chave rendem. Corte as que não entregam e abra espaço para testar outras.

## Limites conhecidos

O agendamento do GitHub Actions não é pontual e pode atrasar alguns minutos em horário de pico.

O workflow `manter-ativo.yml` faz um commit vazio por mês porque o GitHub desativa agendamentos após 60 dias sem atividade no repositório.

Projeto Supabase gratuito pausa após uma semana sem consultas. Com a coleta rodando três vezes ao dia, isso não acontece.

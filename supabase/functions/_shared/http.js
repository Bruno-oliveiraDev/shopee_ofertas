// Porta de entrada das Edge Functions: so o agendador (pg_cron) chama, com o segredo do Vault.
export function servir(acao) {
  Deno.serve(async (req) => {
    const segredo = Deno.env.get('CRON_SECRET');
    if (!segredo || req.headers.get('x-cron-secret') !== segredo) {
      return new Response('nao autorizado', { status: 401 });
    }

    const parametros = Object.fromEntries(new URL(req.url).searchParams);

    try {
      const resultado = await acao(parametros);
      console.log(JSON.stringify(resultado));
      return Response.json(resultado);
    } catch (erro) {
      console.error(erro);
      return Response.json({ erro: String(erro?.message || erro) }, { status: 500 });
    }
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cockpit-chave',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Porta de entrada do cockpit. Por decisao do Bruno (07/10) fica SEM senha por enquanto:
// quem tem o endereco usa. Para fechar de novo, conferir uma chave aqui antes de executar.
// Corpo: { acao: 'nome', ...parametros }
export function servirCockpit(acoes) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const responder = (dados, status = 200) => Response.json(dados, { status, headers: CORS });

    let corpo = {};
    try {
      corpo = await req.json();
    } catch {
      return responder({ erro: 'Corpo invalido' }, 400);
    }

    const acao = acoes[corpo.acao];
    if (!acao) return responder({ erro: `Acao desconhecida: ${corpo.acao}` }, 400);

    try {
      const resultado = await acao(corpo);
      return responder(resultado ?? { ok: true });
    } catch (erro) {
      console.error(corpo.acao, erro);
      return responder({ erro: String(erro?.message || erro) }, 500);
    }
  });
}

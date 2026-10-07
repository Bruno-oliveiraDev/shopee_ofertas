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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** E-mail do usuario logado no cockpit (o token vem do login do Supabase no navegador). */
async function emailDoToken(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resposta = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!resposta.ok) return null;
  const usuario = await resposta.json();
  return usuario?.email || null;
}

// Porta de entrada do cockpit: so quem esta logado E esta na tabela admins.
// Corpo: { acao: 'nome', ...parametros }
export function servirCockpit(acoes, ehAdmin) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const responder = (dados, status = 200) => Response.json(dados, { status, headers: CORS });

    const email = await emailDoToken(req);
    if (!email || !(await ehAdmin(email))) return responder({ erro: 'Sem acesso ao cockpit' }, 401);

    let corpo = {};
    try {
      corpo = await req.json();
    } catch {
      return responder({ erro: 'Corpo invalido' }, 400);
    }

    const acao = acoes[corpo.acao];
    if (!acao) return responder({ erro: `Acao desconhecida: ${corpo.acao}` }, 400);

    try {
      const resultado = await acao(corpo, { email });
      console.log(JSON.stringify({ acao: corpo.acao, email }));
      return responder(resultado ?? { ok: true });
    } catch (erro) {
      console.error(corpo.acao, erro);
      return responder({ erro: String(erro?.message || erro) }, 500);
    }
  });
}

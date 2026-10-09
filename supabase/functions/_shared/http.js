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

// A LP e a /bio chamam estas sem senha (o endereco do cockpit aparece no codigo delas)
const ACOES_PUBLICAS = new Set(['bio_clique', 'bio_achados']);

/** Compara sem vazar pelo tempo de resposta quantos caracteres bateram. */
function mesmaSenha(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

// Porta de entrada do cockpit. Com o secret COCKPIT_SENHA, toda acao (menos as publicas) pede a senha
// no cabecalho x-cockpit-chave; sem o secret, fica aberto como era (decisao do Bruno, 07/10).
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

    const senha = Deno.env.get('COCKPIT_SENHA');
    if (senha && !ACOES_PUBLICAS.has(corpo.acao) && !mesmaSenha(req.headers.get('x-cockpit-chave'), senha)) {
      return responder({ erro: 'Senha do cockpit', senha: true }, 401);
    }

    try {
      const resultado = await acao(corpo);
      return responder(resultado ?? { ok: true });
    } catch (erro) {
      console.error(corpo.acao, erro);
      return responder({ erro: String(erro?.message || erro) }, 500);
    }
  });
}

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

import { env } from './env.js';

// Na Edge Function o Supabase injeta SUPABASE_SERVICE_ROLE_KEY; no GitHub o secret se chama SUPABASE_SERVICE_KEY.
const chave = () => env('SUPABASE_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');

async function chamar(caminho, opcoes = {}) {
  const url = (env('SUPABASE_URL') || '').replace(/\/$/, '');
  const resposta = await fetch(`${url}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: chave(),
      Authorization: `Bearer ${chave()}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(`Supabase ${resposta.status}: ${texto}`);
  }

  return texto ? JSON.parse(texto) : [];
}

/**
 * Manda a coleta para a funcao abastecer_fila (schema.sql): oferta nova entra na fila,
 * oferta pendente ou expirada que apareceu de novo volta com preco atualizado,
 * e oferta ja enviada nunca e tocada. Retorna { novas, renovadas }.
 */
export async function abastecerFila(linhas) {
  if (linhas.length === 0) return { novas: 0, renovadas: 0 };

  return chamar('rpc/abastecer_fila', {
    method: 'POST',
    body: JSON.stringify({ linhas }),
  });
}

/**
 * Um bom punhado da fila; a escolha final e feita em selecao.js.
 * So das buscas que estao na lista hoje: oferta de busca antiga que sobrou na fila nao entra.
 */
export function candidatasDaFila(keywords, quantidade = 200) {
  const lista = keywords.map((k) => `"${k.replace(/"/g, '')}"`).join(',');
  const filtro = encodeURIComponent(`(${lista})`);
  return chamar(`ofertas?status=eq.pendente&keyword=in.${filtro}&order=score.desc&limit=${quantidade}`);
}

/** Ultimas enviadas, mais nova primeiro, pra nao repetir categoria e nao postar duas vezes no mesmo horario. */
export function ultimasEnviadas(quantidade = 15) {
  return chamar(
    `ofertas?status=eq.enviada&enviada_em=not.is.null&order=enviada_em.desc&limit=${quantidade}&select=keyword,enviada_em`
  );
}

export function marcarComoEnviada(itemId) {
  return chamar(`ofertas?item_id=eq.${itemId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'enviada', enviada_em: new Date().toISOString() }),
  });
}

export function marcarComoFalha(itemId, motivo) {
  return chamar(`ofertas?item_id=eq.${itemId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'falha', erro: String(motivo).slice(0, 300) }),
  });
}

/** Sai da fila o que a Shopee parou de mostrar ha X dias (o preco guardado ja nao e confiavel). */
export function expirarAntigas(dias) {
  const limite = new Date(Date.now() - dias * 86400000).toISOString();

  return chamar(`ofertas?status=eq.pendente&visto_em=lt.${limite}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'expirada' }),
  });
}

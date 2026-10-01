const URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;

const base = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { ...base, ...(opcoes.headers || {}) },
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(`Supabase ${resposta.status}: ${texto}`);
  }

  return texto ? JSON.parse(texto) : [];
}

/** Insere ignorando item_id que ja existe. Retorna somente as ofertas novas. */
export function salvarOfertas(linhas) {
  if (linhas.length === 0) return Promise.resolve([]);

  return chamar('ofertas?on_conflict=item_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(linhas),
  });
}

/** Um bom punhado da fila; a escolha final e feita em selecao.js. */
export function candidatasDaFila(quantidade = 200) {
  return chamar(`ofertas?status=eq.pendente&order=score.desc&limit=${quantidade}`);
}

/** Ultimas enviadas, mais nova primeiro, pra nao repetir categoria nem frase. */
export function ultimasEnviadas(quantidade = 15) {
  return chamar(
    `ofertas?status=eq.enviada&enviada_em=not.is.null&order=enviada_em.desc&limit=${quantidade}&select=keyword,gancho`
  );
}

export function salvarGancho(itemId, gancho) {
  return chamar(`ofertas?item_id=eq.${itemId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ gancho }),
  });
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

/** Oferta velha demais perde a graca, entao sai da fila. */
export function expirarAntigas(dias) {
  const limite = new Date(Date.now() - dias * 86400000).toISOString();

  return chamar(`ofertas?status=eq.pendente&coletada_em=lt.${limite}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'expirada' }),
  });
}

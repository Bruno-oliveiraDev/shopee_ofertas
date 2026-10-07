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

// ---------------------------------------------------------------------------
// Cockpit: canais, envios por canal, config e segredos no banco
// ---------------------------------------------------------------------------

/** Config editada no cockpit (tabela config, chave 'robo'); sem ela, vale o config.json. */
export async function configDoBanco() {
  const linhas = await chamar('cockpit_config?chave=eq.robo&select=valor');
  return linhas[0]?.valor || null;
}

export function canaisAtivos() {
  return chamar('cockpit_canais?ativo=eq.true&order=criado_em');
}

export async function canal(id) {
  const linhas = await chamar(`cockpit_canais?id=eq.${encodeURIComponent(id)}`);
  if (!linhas[0]) throw new Error('Canal nao encontrado');
  return linhas[0];
}

/** Oferta pendente que ainda nao saiu neste canal (funcao candidatas_do_canal no banco). */
export function candidatasDoCanal(canalId, keywords, limite = 200) {
  return chamar('rpc/candidatas_do_canal', {
    method: 'POST',
    body: JSON.stringify({ p_canal: canalId, p_keywords: keywords, p_limite: limite }),
  });
}

/** Ultimos posts do canal, mais novo primeiro, com a busca da oferta (pra alternar categoria). */
export function ultimosDoCanal(canalId, quantidade = 15) {
  return chamar(
    `cockpit_envios?canal_id=eq.${canalId}&status=eq.enviado&order=criado_em.desc&limit=${quantidade}` +
      '&select=criado_em,origem,ofertas(keyword)'
  );
}

export function registrarEnvio({ canalId, itemId = null, tipo = 'oferta', status, erro = null, origem }) {
  return chamar('cockpit_envios', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      canal_id: canalId,
      item_id: itemId,
      tipo,
      status,
      erro: erro ? String(erro).slice(0, 500) : null,
      origem,
    }),
  });
}

export async function lerSegredos(chaves) {
  const lista = chaves.map((c) => `"${c}"`).join(',');
  const linhas = await chamar(`cockpit_segredos?chave=in.(${encodeURIComponent(lista)})&select=chave,valor`);
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}

export function gravarSegredo(chave, valor) {
  return chamar('cockpit_segredos?on_conflict=chave', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ chave, valor, atualizado_em: new Date().toISOString() }),
  });
}

export async function ofertaPorId(itemId) {
  const linhas = await chamar(`ofertas?item_id=eq.${encodeURIComponent(itemId)}`);
  if (!linhas[0]) throw new Error('Oferta nao encontrada');
  return linhas[0];
}

/** E-mail que pode usar o cockpit (tabela admins). */
export async function ehAdmin(email) {
  const linhas = await chamar(`cockpit_admins?email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=email`);
  return linhas.length > 0;
}

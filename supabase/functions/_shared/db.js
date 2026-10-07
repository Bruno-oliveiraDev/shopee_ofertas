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
// Cockpit: canais, envios por canal, ajustes, segredos e leituras da tela
// ---------------------------------------------------------------------------

export { chamar };

/** Config editada no cockpit (ajustes, chave 'robo'); sem ela, vale o config.json. */
export async function configDoBanco() {
  const linhas = await chamar('ajustes?chave=eq.robo&select=valor');
  return linhas[0]?.valor || null;
}

/** Pausas que a tela liga e desliga (ajustes disparo_pausado e whatsapp_pausado). */
export async function pausas() {
  const linhas = await chamar('ajustes?chave=in.(disparo_pausado,whatsapp_pausado)&select=chave,valor');
  const mapa = Object.fromEntries(linhas.map((l) => [l.chave, l.valor === true]));
  return { tudo: Boolean(mapa.disparo_pausado), whatsapp: Boolean(mapa.whatsapp_pausado) };
}

export function canaisAtivos() {
  return chamar('canais?ativo=eq.true&order=criado_em');
}

export async function canal(id) {
  const linhas = await chamar(`canais?id=eq.${encodeURIComponent(id)}`);
  if (!linhas[0]) throw new Error('Canal nao encontrado');
  return linhas[0];
}

/** Fila do canal (funcao candidatas_do_canal no banco): fixadas primeiro. */
export function candidatasDoCanal(canalId, keywords, validadeDias = 3, limite = 200) {
  return chamar('rpc/candidatas_do_canal', {
    method: 'POST',
    body: JSON.stringify({ p_canal: canalId, p_keywords: keywords, p_validade_dias: validadeDias, p_limite: limite }),
  });
}

/** Ultimos posts do canal, mais novo primeiro, com a busca da oferta (pra alternar categoria). */
// (envios nao tem chave estrangeira pra ofertas, entao a busca da oferta vem numa 2a consulta)
export async function ultimosDoCanal(canalId, quantidade = 15) {
  const envios = await chamar(
    `envios?canal_id=eq.${canalId}&ok=is.true&order=enviado_em.desc&limit=${quantidade}&select=item_id,enviado_em,origem`
  );
  const ids = [...new Set(envios.map((e) => e.item_id))].map((i) => `"${i}"`).join(',');
  const ofertas = ids ? await chamar(`ofertas?item_id=in.(${encodeURIComponent(ids)})&select=item_id,keyword,nome`) : [];
  const dados = Object.fromEntries(ofertas.map((o) => [o.item_id, o]));
  return envios.map((e) => ({ ...e, keyword: dados[e.item_id]?.keyword ?? null, nome: dados[e.item_id]?.nome ?? null }));
}

export function registrarEnvio({ canal, itemId = null, tipo = 'oferta', ok, erro = null, origem, msgId = null }) {
  return chamar('envios', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      item_id: itemId || '-',
      canal: canal.tipo,
      destino: canal.destino || canal.destino_nome || 'grupo',
      canal_id: canal.id,
      ok,
      erro: erro ? String(erro).slice(0, 500) : null,
      msg_id: msgId ? String(msgId) : null,
      origem,
      tipo,
    }),
  });
}

/** Oferta saiu pela 1a vez em algum canal: fica "enviada" (as views cockpit_* contam assim). */
export function marcarSaiu(itemId, telegramMsgId = null) {
  const corpo = { status: 'enviada', enviada_em: new Date().toISOString(), prioridade: 0 };
  if (telegramMsgId) corpo.telegram_msg_id = telegramMsgId;
  return chamar(`ofertas?item_id=eq.${encodeURIComponent(itemId)}&status=eq.pendente`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(corpo),
  });
}

export async function lerSegredos(chaves) {
  const lista = chaves.map((c) => `"${c}"`).join(',');
  const linhas = await chamar(`segredos?chave=in.(${encodeURIComponent(lista)})&select=chave,valor`);
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}

export function gravarSegredo(chave, valor) {
  return chamar('segredos?on_conflict=chave', {
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

/** Log da coleta por busca (tabela coletas: o que voltou, o que passou e por que o resto caiu). */
export function registrarColetas(linhas) {
  if (!linhas.length) return Promise.resolve();
  return chamar('coletas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(linhas) });
}

/** Acoes que ja existem no banco (cockpit_acao): fixar, pular, voltar, bloquear, desbloquear, pausar, retomar.
 *  A cockpit_acao_interna pega a chave do Vault sozinha (cockpit sem senha). */
export function acaoNoBanco(acao, alvo = null, valor = null) {
  return chamar('rpc/cockpit_acao_interna', {
    method: 'POST',
    body: JSON.stringify({ p_acao: acao, p_alvo: alvo, p_valor: valor }),
  });
}

import { env } from './env.js';
import { chamar } from './db.js';

// Vendas que a Shopee atribui aos nossos links (conversionReport da API de afiliados)
// e o link com subId, que diz de qual canal/categoria/horario veio cada venda.

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

async function sha256hex(texto) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Uma chamada assinada na API de afiliados (mesma assinatura da busca de ofertas). */
async function graphql(query) {
  const payload = JSON.stringify({ query });
  const appId = env('SHOPEE_APP_ID');
  const ts = Math.floor(Date.now() / 1000);
  const assinatura = await sha256hex(appId + ts + payload + env('SHOPEE_APP_SECRET'));
  const resposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${assinatura}` },
    body: payload,
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados) throw new Error(`Shopee respondeu ${resposta.status}`);
  if (dados.errors?.length) throw new Error(`Shopee recusou: ${JSON.stringify(dados.errors).slice(0, 300)}`);
  return dados.data;
}

// ---------------------------------------------------------------- subId

// A Shopee aceita ate 5 subIds, so letras e numeros. Volta na venda como "wa-roupa-h2005-c58e6e".
const limpar = (t) => String(t || '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 40);

/** subIds de um post: canal, categoria, horario e qual canal (pra separar 2 grupos de WhatsApp). */
export function subIdsDoPost(canal, categoria, horario) {
  return [canal.tipo === 'whatsapp' ? 'wa' : 'tg', limpar(categoria) || 'geral', `h${horario.replace(':', '')}`, limpar(canal.id).slice(0, 6)];
}

/** Link curto com subId. Se a Shopee falhar, devolve o link de sempre (o post nao pode parar por isso). */
export async function linkComSubId(oferta, subIds) {
  const origem = oferta.shop_id ? `https://shopee.com.br/product/${oferta.shop_id}/${oferta.item_id}` : oferta.link;
  try {
    const d = await graphql(`mutation{generateShortLink(input:{originUrl:${JSON.stringify(origem)},subIds:${JSON.stringify(subIds)}}){shortLink}}`);
    return d?.generateShortLink?.shortLink || oferta.link;
  } catch (erro) {
    console.warn(`Link com subId falhou (${oferta.item_id}): ${erro.message}`);
    return oferta.link;
  }
}

// ---------------------------------------------------------------- vendas

const CAMPOS = `purchaseTime clickTime conversionId conversionStatus totalCommission netCommission utmContent
  orders{orderId orderStatus items{itemId itemName itemPrice actualAmount qty itemTotalCommission shopName displayItemStatus}}`;

const num = (v) => Number(v) || 0;
const cancelado = (status) => /cancel|invalid|fail/i.test(String(status || ''));
const concluido = (status) => /complet/i.test(String(status || ''));

/** Linha da tabela vendas a partir de uma conversao da Shopee. */
export function linhaDaVenda(c) {
  let comissao = 0;
  let confirmada = 0;
  let valor = 0;
  let itens = 0;
  const pedidos = (c.orders || []).map((o) => ({
    pedido: o.orderId,
    status: o.orderStatus,
    itens: (o.items || []).map((i) => ({ item_id: String(i.itemId), nome: i.itemName, preco: num(i.itemPrice), pago: num(i.actualAmount), qtd: num(i.qty), comissao: num(i.itemTotalCommission), loja: i.shopName, situacao: i.displayItemStatus })),
  }));

  for (const p of pedidos) {
    if (cancelado(p.status)) continue;
    for (const i of p.itens) {
      comissao += i.comissao;
      valor += i.pago;
      itens += i.qtd || 1;
      if (concluido(p.status)) confirmada += i.comissao;
    }
  }

  const situacao = pedidos.length && pedidos.every((p) => cancelado(p.status)) ? 'cancelada'
    : pedidos.length && pedidos.every((p) => cancelado(p.status) || concluido(p.status)) ? 'confirmada'
    : 'pendente';

  // "wa-roupa-h2005-c58e6e" -> canal, categoria, horario (venda de link sem subId fica sem origem)
  // "vd-roupa-d1008" e o link do video do dia (nao tem horario)
  const [canal, categoria, marca] = String(c.utmContent || '').split('-');
  const deUmPost = canal === 'wa' || canal === 'tg' || canal === 'vd';
  const horario = marca?.startsWith('h') ? marca : null;

  const iso = (s) => (s ? new Date(Number(s) * 1000).toISOString() : null);
  return {
    conversion_id: String(c.conversionId),
    compra_em: iso(c.purchaseTime),
    clique_em: iso(c.clickTime),
    situacao,
    status_shopee: c.conversionStatus ?? null,
    comissao: Number(comissao.toFixed(2)),
    comissao_confirmada: Number(confirmada.toFixed(2)),
    comissao_shopee: num(c.netCommission ?? c.totalCommission),
    valor_pedido: Number(valor.toFixed(2)),
    itens,
    sub_ids: c.utmContent || null,
    canal: deUmPost ? canal : null,
    categoria: deUmPost ? categoria || null : null,
    horario: deUmPost && horario ? `${horario.slice(1, 3)}:${horario.slice(3, 5)}` : null,
    pedidos,
    atualizado_em: new Date().toISOString(),
  };
}

/**
 * Puxa as vendas dos ultimos N dias (a Shopee guarda 3 meses) e grava/atualiza no banco.
 * Roda toda hora: venda pendente vira confirmada ou cancelada com o tempo.
 */
export async function sincronizarVendas({ dias = 89 } = {}) {
  const fim = Math.floor(Date.now() / 1000);
  const inicio = fim - dias * 86400;
  const linhas = [];
  let scrollId = '';

  for (let pagina = 0; pagina < 40; pagina++) {
    const d = await graphql(
      `{conversionReport(purchaseTimeStart:${inicio},purchaseTimeEnd:${fim},limit:500${scrollId ? `,scrollId:${JSON.stringify(scrollId)}` : ''})` +
      `{nodes{${CAMPOS}} pageInfo{hasNextPage scrollId}}}`
    );
    const r = d?.conversionReport;
    linhas.push(...(r?.nodes || []).map(linhaDaVenda));
    if (!r?.pageInfo?.hasNextPage || !r.pageInfo.scrollId) break;
    scrollId = r.pageInfo.scrollId;
  }

  if (linhas.length) {
    await chamar('vendas?on_conflict=conversion_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(linhas),
    });
  }

  const soma = (campo) => Number(linhas.reduce((s, l) => s + l[campo], 0).toFixed(2));
  return { vendas: linhas.length, comissao: soma('comissao'), confirmada: soma('comissao_confirmada') };
}

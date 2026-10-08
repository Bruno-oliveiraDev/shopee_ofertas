import { env } from './env.js';
import { pontuar } from './selecao.js';

const CAMPOS = [
  'itemId',
  'shopId',
  'productName',
  'productLink',
  'offerLink',
  'imageUrl',
  'priceMin',
  'priceMax',
  'priceDiscountRate',
  'sales',
  'ratingStar',
  'commissionRate',
  'commission',
  'shopName',
  'shopType',
].join(' ');

/**
 * A Shopee assina cada requisicao com SHA256(appId + timestamp + payload + secret).
 * O payload precisa ser exatamente a string enviada no corpo, byte a byte.
 */
async function sha256hex(texto) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function assinar(payload) {
  const appId = env('SHOPEE_APP_ID');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha256hex(appId + timestamp + payload + env('SHOPEE_APP_SECRET'));

  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

/** Uma pagina de resultados de uma busca. temMais diz se vale pedir a proxima. */
export async function buscarOfertas(cfg, keyword, pagina = 1) {
  const termo = keyword.replace(/["\\]/g, '');
  const query =
    `{productOfferV2(keyword:"${termo}",listType:${cfg.listType},sortType:${cfg.sortType},` +
    `page:${pagina},limit:${cfg.limitePorBusca}){nodes{${CAMPOS}} pageInfo{page limit hasNextPage}}}`;

  const payload = JSON.stringify({ query });

  const resposta = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await assinar(payload),
    },
    body: payload,
  });

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok || !dados) {
    throw new Error(`Shopee respondeu ${resposta.status} para "${keyword}"`);
  }

  if (Array.isArray(dados.errors) && dados.errors.length) {
    throw new Error(`Shopee recusou "${keyword}": ${JSON.stringify(dados.errors)}`);
  }

  const resultado = dados?.data?.productOfferV2;
  return {
    produtos: resultado?.nodes ?? [],
    temMais: Boolean(resultado?.pageInfo?.hasNextPage),
  };
}

/** Converte o retorno cru da API na linha que vai para o banco. */
export function normalizar(produto, keyword) {
  const preco = parseFloat(produto.priceMin || '0');
  const desconto = Number(produto.priceDiscountRate || 0);
  const comissao = parseFloat(produto.commissionRate || '0');
  const vendas = Number(produto.sales || 0);

  const linha = {
    item_id: String(produto.itemId),
    shop_id: String(produto.shopId || ''),
    nome: String(produto.productName || '').slice(0, 200),
    preco,
    preco_de: desconto > 0 && desconto < 100 ? Number((preco / (1 - desconto / 100)).toFixed(2)) : null,
    desconto,
    comissao,
    vendas,
    nota: produto.ratingStar ? Number(parseFloat(produto.ratingStar).toFixed(1)) : null,
    loja: produto.shopName || null,
    imagem: produto.imageUrl || null,
    link: produto.offerLink,
    keyword,
    status: 'pendente',
  };

  // mesmo peso que a escolha do disparo usa, pra fila ja vir na ordem certa
  linha.score = Number(pontuar(linha).toFixed(3));
  return linha;
}

/** Minusculo e sem acento, pra comparar "Erótico" com "erotico". */
export const simplificar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * O termo aparece no comeco de uma palavra do nome: "cao" pega "Cão" mas nao "proteção",
 * "rn" pega "RN" mas nao "inverno", "menin" pega "menino" e "menina".
 */
export const temTermo = (nome, termo) => new RegExp(`(^|[^a-z0-9])${escapar(simplificar(termo))}`).test(nome);

/** Motivo de a oferta ficar de fora (vai pro log da coleta), ou null se passou. */
export function motivoReprovacao(linha, filtros) {
  if (!linha.link || !linha.preco) return 'sem link ou preco';

  // grupo de pais: qualquer termo bloqueado no nome derruba a oferta
  const nome = simplificar(linha.nome);
  const bloqueadas = filtros.palavrasBloqueadas || [];
  if (bloqueadas.some((p) => temTermo(nome, p))) return 'palavra bloqueada';

  // nicho: cada grupo de "exigir" precisa ter pelo menos 1 termo no nome.
  // Ex.: roupa = [["body","calca","macacao"...], ["bebe","infantil","rn"...]] -> "Body manga longa bebe" passa,
  // "Cabo Auxiliar Chupeta De Bateria" nao passa (busca "chupeta", mas nao tem termo de bebe).
  for (const grupo of filtros.exigir || []) {
    if (grupo.length && !grupo.some((p) => temTermo(nome, p))) return 'fora do nicho';
  }

  // produto infantil sem nota ou com nota baixa nao entra
  if (filtros.notaMinima && !(linha.nota >= filtros.notaMinima)) return 'nota baixa';

  if (linha.comissao < filtros.comissaoMinima) return 'comissao baixa';
  if (linha.desconto < filtros.descontoMinimo) return 'desconto baixo';
  if (linha.vendas < filtros.vendasMinimas) return 'poucas vendas';
  if (linha.preco < filtros.precoMinimo) return 'preco baixo';
  if (linha.preco > filtros.precoMaximo) return 'preco alto';
  return null;
}

export const passaNoFiltro = (linha, filtros) => motivoReprovacao(linha, filtros) === null;

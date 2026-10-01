import { createHash } from 'node:crypto';
import { pontuar } from './selecao.js';

const APP_ID = process.env.SHOPEE_APP_ID;
const APP_SECRET = process.env.SHOPEE_APP_SECRET;

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
function assinar(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash('sha256')
    .update(APP_ID + timestamp + payload + APP_SECRET)
    .digest('hex');

  return `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;
}

export async function buscarOfertas(cfg, keyword) {
  const termo = keyword.replace(/["\\]/g, '');
  const query =
    `{productOfferV2(keyword:"${termo}",listType:${cfg.listType},sortType:${cfg.sortType},` +
    `page:1,limit:${cfg.limitePorBusca}){nodes{${CAMPOS}} pageInfo{page limit hasNextPage}}}`;

  const payload = JSON.stringify({ query });

  const resposta = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: assinar(payload),
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

  return dados?.data?.productOfferV2?.nodes ?? [];
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
const simplificar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function passaNoFiltro(linha, filtros) {
  if (!linha.link || !linha.preco) return false;

  // grupo de pais: qualquer termo bloqueado no nome derruba a oferta
  const nome = simplificar(linha.nome);
  const bloqueadas = filtros.palavrasBloqueadas || [];
  if (bloqueadas.some((p) => nome.includes(simplificar(p)))) return false;

  // produto infantil sem nota ou com nota baixa nao entra
  if (filtros.notaMinima && !(linha.nota >= filtros.notaMinima)) return false;

  if (linha.comissao < filtros.comissaoMinima) return false;
  if (linha.desconto < filtros.descontoMinimo) return false;
  if (linha.vendas < filtros.vendasMinimas) return false;
  if (linha.preco < filtros.precoMinimo) return false;
  if (linha.preco > filtros.precoMaximo) return false;
  return true;
}

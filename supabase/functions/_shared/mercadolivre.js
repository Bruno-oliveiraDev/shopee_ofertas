// Mercado Livre como 2o distribuidor do grupo.
//
// O Mercado Livre nao tem API que gere link de afiliado e a busca publica (/sites/MLB/search) responde 403
// desde 2025. Entao o caminho e: o Bruno escolhe o produto no painel de afiliados, gera o link e cola no
// cockpit; aqui o robo descobre o codigo MLB do produto e, se o app do Mercado Livre estiver conectado,
// completa nome, preco e foto pela API. Sem app, a tela pede esses campos na mao.
//
// A oferta entra na MESMA fila da Shopee (tabela ofertas), com item_id comecando em "MLB": e assim que o
// disparo sabe que e do Mercado Livre (nao gera link com subId da Shopee e entra no rodizio de 1 a cada N).

import { chamar, gravarSegredo, lerSegredos, abastecerFila } from './db.js';
import { pontuar } from './selecao.js';

const API = 'https://api.mercadolibre.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export const ehML = (itemId) => /^MLB/i.test(String(itemId || ''));

/**
 * Acha o codigo do produto numa URL do Mercado Livre (tambem dentro do ?go= da tela anti-robo, que vem codificado).
 * Ordem: item_id=MLB... (anuncio escolhido numa pagina de catalogo) > /p/MLB... (catalogo) > MLB-123... (anuncio).
 */
export function codigoNaUrl(url) {
  let texto = String(url || '');
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(texto);
      if (d === texto) break;
      texto = d;
    } catch {
      break;
    }
  }
  const anuncioEscolhido = texto.match(/item_id[:=]MLB-?(\d{6,})/i);
  if (anuncioEscolhido) return { id: `MLB${anuncioEscolhido[1]}`, tipo: 'anuncio' };
  const catalogo = texto.match(/\/p\/(MLB\d{5,})/i);
  if (catalogo) return { id: catalogo[1].toUpperCase(), tipo: 'produto' };
  const anuncio = texto.match(/MLB-?(\d{6,})/i);
  if (anuncio) return { id: `MLB${anuncio[1]}`, tipo: 'anuncio' };
  return null;
}

/** Segue os redirecionamentos do link de afiliado (meli.la, /sec/, /social/) ate achar o codigo MLB. */
export async function seguirLink(link) {
  let url = link;
  for (let i = 0; i < 6; i++) {
    const achou = codigoNaUrl(url);
    if (achou) return { ...achou, url };

    const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html' } });
    const proximo = r.headers.get('location');
    if (!proximo) {
      // pagina sem redirecionamento: o link do produto pode estar no HTML (ex.: pagina /social/ do afiliado)
      const html = await r.text().catch(() => '');
      const noHtml = html.match(/https?:\/\/(?:www\.|produto\.)?mercadolivre\.com\.br\/[^"'\s<>]*MLB[^"'\s<>]*/i)?.[0];
      const codigo = codigoNaUrl(noHtml);
      return codigo ? { ...codigo, url: noHtml } : null;
    }
    url = new URL(proximo, url).toString();
  }
  return codigoNaUrl(url) ? { ...codigoNaUrl(url), url } : null;
}

// ---------------------------------------------------------------- app do Mercado Livre (opcional)

/** Token do app (client_credentials, vale ~6 h), guardado em segredos pra nao pedir a cada chamada. */
async function tokenDoApp() {
  const s = await lerSegredos(['ml_client_id', 'ml_client_secret', 'ml_token', 'ml_token_expira']);
  if (!s.ml_client_id || !s.ml_client_secret) return null;
  if (s.ml_token && Number(s.ml_token_expira) > Date.now() + 5 * 60 * 1000) return s.ml_token;

  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: s.ml_client_id, client_secret: s.ml_client_secret }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.access_token) throw new Error(`O Mercado Livre recusou o app: ${d?.message || d?.error || r.status}`);

  await gravarSegredo('ml_token', d.access_token);
  await gravarSegredo('ml_token_expira', String(Date.now() + (Number(d.expires_in) || 21600) * 1000));
  return d.access_token;
}

async function pegar(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Mercado Livre ${r.status}: ${d?.message || d?.code || 'sem detalhe'}`);
  return d;
}

const fotoGrande = (url) => (url ? String(url).replace(/^http:/, 'https:').replace(/-[A-Z]\.(jpg|webp)$/i, '-O.$1') : null);

/** Nome, preco, foto (e nota/vendas quando der) pela API, com o token do app. */
async function dadosPelaApi(codigo, token) {
  let dados;
  if (codigo.tipo === 'produto') {
    const p = await pegar(`${API}/products/${codigo.id}`, token);
    const w = p.buy_box_winner || {};
    dados = { nome: p.name, preco: w.price ?? null, preco_de: w.original_price ?? null, imagem: fotoGrande(p.pictures?.[0]?.url) };
  } else {
    const it = await pegar(`${API}/items/${codigo.id}`, token);
    dados = {
      nome: it.title,
      preco: it.price ?? null,
      preco_de: it.original_price ?? null,
      imagem: fotoGrande(it.pictures?.[0]?.secure_url || it.pictures?.[0]?.url || it.thumbnail),
      vendas: Number(it.sold_quantity) || 0,
    };
    // nota e opcional: se a API negar, segue sem
    try {
      const rv = await pegar(`${API}/reviews/item/${codigo.id}`, token);
      if (rv?.rating_average) dados.nota = Number(Number(rv.rating_average).toFixed(1));
    } catch {
      /* sem nota */
    }
  }
  return dados;
}

// ---------------------------------------------------------------- acoes do cockpit

const URL_NA_LINHA = /https?:\/\/\S+/i;

/** Uma linha por link colado: devolve o rascunho de cada um (o que deu pra completar sozinho). */
export async function previaML(texto) {
  const links = [...new Set(String(texto || '').split(/\s+/).map((l) => l.match(URL_NA_LINHA)?.[0]).filter(Boolean))].slice(0, 30);
  if (!links.length) throw new Error('Cole pelo menos um link do Mercado Livre.');

  let token = null;
  let avisoApp = null;
  try {
    token = await tokenDoApp();
  } catch (erro) {
    avisoApp = erro.message;
  }

  const itens = [];
  for (const link of links) {
    const item = { link, codigo: null, url_produto: null, nome: '', preco: null, preco_de: null, imagem: null, nota: null, vendas: 0, aviso: null, ja_existe: null };
    try {
      const codigo = await seguirLink(link);
      if (codigo) {
        item.codigo = codigo.id;
        item.url_produto = codigo.url;
        if (token) Object.assign(item, await dadosPelaApi(codigo, token));
      } else {
        item.aviso = 'Não achei o código do produto nesse link. Preencha os dados à mão.';
      }
    } catch (erro) {
      item.aviso = `Não consegui completar sozinho (${erro.message}). Preencha à mão.`;
    }
    if (item.codigo) {
      const [existe] = await chamar(`ofertas?item_id=eq.${encodeURIComponent(item.codigo)}&select=status`);
      item.ja_existe = existe?.status ?? null;
    }
    itens.push(item);
  }

  return { app: Boolean(token), aviso_app: avisoApp, itens };
}

async function idDoLink(link) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(link));
  return 'MLBX' + [...new Uint8Array(hash)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Grava na fila os itens revisados na tela. Cada item: link, codigo?, nome, preco, preco_de?, imagem?, nota?, vendas?, categoria. */
export async function salvarML(cfg, itens) {
  if (!Array.isArray(itens) || !itens.length) throw new Error('Nada para salvar');

  const linhas = [];
  for (const it of itens) {
    const link = String(it.link || '').trim();
    if (!/^https?:\/\//i.test(link)) throw new Error('Link inválido');
    const nome = String(it.nome || '').trim().slice(0, 200);
    if (!nome) throw new Error(`Falta o nome do produto (${link})`);
    const preco = numero(it.preco);
    if (!preco) throw new Error(`Falta o preço de "${nome.slice(0, 40)}"`);
    const precoDe = numero(it.preco_de);
    const keywords = cfg.categorias?.[it.categoria];
    if (!keywords?.length) throw new Error(`Categoria inválida para "${nome.slice(0, 40)}"`);

    const desconto = precoDe && precoDe > preco ? Math.round((1 - preco / precoDe) * 100) : 0;
    const linha = {
      item_id: /^MLB/i.test(String(it.codigo || '')) ? String(it.codigo).toUpperCase() : await idDoLink(link),
      shop_id: null,
      nome,
      preco,
      preco_de: desconto > 0 ? precoDe : null,
      desconto,
      comissao: Number(cfg.mercadoLivre?.comissaoEstimada ?? 0),
      vendas: Math.max(0, Math.round(Number(it.vendas) || 0)),
      nota: numero(it.nota),
      loja: 'Mercado Livre',
      imagem: /^https:\/\//i.test(String(it.imagem || '')) ? String(it.imagem).trim() : null,
      link,
      // a 1a busca da categoria: e o que faz a oferta entrar na fila do canal e contar na proporcao da categoria
      keyword: keywords[0],
    };
    linha.score = Number(pontuar(linha).toFixed(3));
    linhas.push(linha);
  }

  const r = await abastecerFila(linhas);
  return { ...r, recebidas: linhas.length, ignoradas: linhas.length - (r.novas + r.renovadas) };
}

/** Lista da tela: o que esta na fila do Mercado Livre e o que ja saiu. */
export function listaML() {
  return chamar(
    'ofertas?item_id=like.MLB*&status=in.(pendente,enviada,pulada,expirada)&order=coletada_em.desc&limit=150' +
      '&select=item_id,nome,preco,preco_de,desconto,imagem,link,keyword,status,coletada_em,enviada_em'
  );
}

export async function statusML() {
  const s = await lerSegredos(['ml_client_id', 'ml_client_secret']);
  return { app: Boolean(s.ml_client_id && s.ml_client_secret) };
}

/** Guarda as chaves do app e ja testa (o segredo nunca volta pra tela). */
export async function conectarAppML({ client_id, client_secret }) {
  const id = String(client_id || '').trim();
  const segredo = String(client_secret || '').trim();
  if (!/^\d{6,}$/.test(id)) throw new Error('O Client ID do Mercado Livre é só números');
  if (segredo.length < 16) throw new Error('Client Secret curto demais');

  await gravarSegredo('ml_client_id', id);
  await gravarSegredo('ml_client_secret', segredo);
  await gravarSegredo('ml_token_expira', '0');
  await tokenDoApp();
  return { app: true };
}

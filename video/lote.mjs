// Lote diario de videos: escolhe as melhores ofertas que JA foram pro grupo (o video manda pro grupo,
// entao o link precisa estar la), gera o video de cada uma, sobe pro Storage do Supabase e grava na tabela videos.
// O cockpit lista pra baixar e postar. Tudo nosso: FFmpeg + Piper, sem servico pago.
//
// Uso: node video/lote.mjs [quantidade]
// Variaveis: SUPABASE_URL, SUPABASE_SERVICE_KEY, SHOPEE_APP_ID, SHOPEE_APP_SECRET
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, gerarArte } from './gerar-arte.mjs';
import { textoDoPost } from './roteiro.mjs';

const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const QUANTIDADE = Number(process.argv[2] || process.env.QUANTIDADE || 5);
const BUCKET = 'videos';

async function banco(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Banco respondeu ${r.status} em ${caminho.split('?')[0]}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

async function subir(nome, arquivo, tipo) {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${nome}`, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': tipo, 'x-upsert': 'true' },
    body: await readFile(arquivo),
  });
  if (!r.ok) throw new Error(`Storage respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return `${BASE}/storage/v1/object/public/${BUCKET}/${nome}`;
}

/** Link curto com subId "vd-categoria-dMMDD": a venda que vier do video aparece no Retorno como Video. */
async function linkDoVideo(oferta, dia) {
  const origem = oferta.shop_id ? `https://shopee.com.br/product/${oferta.shop_id}/${oferta.item_id}` : oferta.link;
  const subIds = ['vd', String(oferta.categoria || 'geral').replace(/[^a-z0-9]/gi, '').toLowerCase(), `d${dia.slice(5).replace('-', '')}`];
  const payload = JSON.stringify({ query: `mutation{generateShortLink(input:{originUrl:${JSON.stringify(origem)},subIds:${JSON.stringify(subIds)}}){shortLink}}` });
  const appId = process.env.SHOPEE_APP_ID;
  const ts = Math.floor(Date.now() / 1000);
  const assinatura = createHash('sha256').update(appId + ts + payload + process.env.SHOPEE_APP_SECRET).digest('hex');
  try {
    const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${assinatura}` },
      body: payload,
    });
    return (await r.json())?.data?.generateShortLink?.shortLink || oferta.link;
  } catch {
    return oferta.link;
  }
}

/** Melhores ofertas enviadas nos ultimos 2 dias, uma por categoria, sem repetir produto de video dos ultimos 30 dias. */
async function escolher() {
  const desde = new Date(Date.now() - 2 * 86400e3).toISOString();
  const campos = 'item_id,shop_id,nome,preco,preco_de,desconto,vendas,nota,imagem,link,categoria,score';
  const [enviadas, feitos] = await Promise.all([
    banco(`ofertas?select=${campos}&status=eq.enviada&enviada_em=gte.${desde}&imagem=not.is.null&categoria=not.is.null&order=score.desc&limit=200`),
    banco(`videos?select=item_id&criado_em=gte.${new Date(Date.now() - 30 * 86400e3).toISOString()}`),
  ]);
  const jaTem = new Set(feitos.map((v) => v.item_id));
  const candidatas = enviadas.filter((o) => !jaTem.has(o.item_id) && o.preco > 0);

  const escolhidas = [];
  const categorias = new Set();
  // 1a volta: uma por categoria; 2a volta: completa com as melhores que sobraram
  for (const o of candidatas) if (escolhidas.length < QUANTIDADE && !categorias.has(o.categoria)) { escolhidas.push(o); categorias.add(o.categoria); }
  for (const o of candidatas) if (escolhidas.length < QUANTIDADE && !escolhidas.includes(o)) escolhidas.push(o);
  return escolhidas;
}

if (!BASE || !CHAVE) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY');
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
// REFAZER=sim: gera de novo as artes que ja existem no dia (ex.: depois de mudar o design)
async function jaDoDia() {
  const feitos = await banco(`videos?select=item_id&dia=eq.${dia}`);
  if (!feitos.length) return [];
  const ids = feitos.map((v) => `"${v.item_id}"`).join(',');
  return banco(`ofertas?select=item_id,shop_id,nome,preco,preco_de,desconto,vendas,nota,imagem,link,categoria,score&item_id=in.(${encodeURIComponent(ids)})`);
}
const ofertas = process.env.REFAZER === 'sim' ? await jaDoDia() : await escolher();
console.log(`${ofertas.length} oferta(s) pra arte em ${dia}`);
const navegador = await (await chromium()).launch();

let feitos = 0;
for (const oferta of ofertas) {
  const pasta = path.resolve('saida-artes', oferta.item_id);
  try {
    const arte = await gerarArte(oferta, pasta, navegador);
    const nome = `${dia}/${oferta.item_id}`;
    const url = await subir(`${nome}-story.jpg`, arte.story, 'image/jpeg');
    const feed = await subir(`${nome}-feed.jpg`, arte.feed, 'image/jpeg');
    const link = await linkDoVideo(oferta, dia);

    await banco('videos?on_conflict=dia,item_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        dia, item_id: oferta.item_id, nome: oferta.nome, categoria: oferta.categoria, preco: oferta.preco, preco_de: oferta.preco_de,
        desconto: oferta.desconto, formato: 'arte', url, capa: feed, url_feed: feed, legenda: textoDoPost(oferta), link, duracao: null,
      }),
    });
    feitos++;
    console.log(`ok  ${oferta.item_id}  ${oferta.nome.slice(0, 60)}`);
  } catch (erro) {
    console.error(`ERRO ${oferta.item_id}: ${erro.message}`);
  }
}

await navegador.close();
console.log(`${feitos}/${ofertas.length} arte(s) prontas`);
if (ofertas.length && !feitos) process.exit(1);

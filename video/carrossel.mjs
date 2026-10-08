// Carrossel de 5 imagens pro Instagram (1080x1350) e TikTok (1080x1920), 2 por dia:
//   12h "Achadinhos ate R$ X" (os mais baratos) e 20h "Os mais vendidos pro bebe".
// Imagem 1 = capa (colagem dos 3 produtos), 2 a 4 = os 3 produtos numerados, 5 = chamada pro grupo.
// Sobe no Storage (bucket videos, pasta carrossel/) e grava na tabela carrosseis; o cockpit mostra pra baixar e postar.
//
// Uso: node video/carrossel.mjs [12h|20h]   (sem turno: decide pela hora de Brasilia)
// Variaveis: SUPABASE_URL, SUPABASE_SERVICE_KEY
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CORES, TAMANHOS, brl, chromium, esc, fotoEmbutida, html, renderizar } from './gerar-arte.mjs';
import { nomeCurto } from './roteiro.mjs';

const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'videos';
const PRODUTOS = 3;
const POR_CATEGORIA = 1; // 3 produtos de 3 categorias diferentes

const TURNOS = {
  '12h': { cor: CORES.enxoval, ordem: (a, b) => a.preco - b.preco },
  '20h': { cor: CORES.roupa, ordem: (a, b) => b.vendas - a.vendas },
};

async function banco(caminho, opcoes = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Banco respondeu ${r.status} em ${caminho.split('?')[0]}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

async function subir(nome, arquivo) {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${nome}`, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: await readFile(arquivo),
  });
  if (!r.ok) throw new Error(`Storage respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return `${BASE}/storage/v1/object/public/${BUCKET}/${nome}?v=${Date.now()}`;
}

/** 3 produtos que foram pro grupo (o link esta la), sem repetir os carrosseis dos ultimos 7 dias. */
async function escolher(turno) {
  const campos = 'item_id,nome,preco,preco_de,desconto,vendas,nota,imagem,categoria';
  const usados = new Set(
    (await banco(`carrosseis?select=itens&criado_em=gte.${new Date(Date.now() - 7 * 86400e3).toISOString()}`)).flatMap((c) => c.itens || [])
  );
  // comeca pelos ultimos 2 dias e abre a janela se faltar produto
  for (const dias of [2, 4, 7, 14]) {
    const desde = new Date(Date.now() - dias * 86400e3).toISOString();
    const enviadas = await banco(`ofertas?select=${campos}&status=eq.enviada&enviada_em=gte.${desde}&imagem=not.is.null&categoria=not.is.null&order=score.desc&limit=400`);
    const candidatas = enviadas.filter((o) => !usados.has(o.item_id) && o.preco > 0).sort(TURNOS[turno].ordem);
    const escolhidas = [];
    const porCategoria = {};
    for (const o of candidatas) {
      if (escolhidas.length >= PRODUTOS) break;
      if ((porCategoria[o.categoria] || 0) >= POR_CATEGORIA) continue;
      porCategoria[o.categoria] = (porCategoria[o.categoria] || 0) + 1;
      escolhidas.push(o);
    }
    if (escolhidas.length >= PRODUTOS) return escolhidas;
  }
  throw new Error(`Menos de ${PRODUTOS} produtos novos enviados nos ultimos 14 dias`);
}

const tetoDoPreco = (ofertas) => {
  const maior = Math.max(...ofertas.map((o) => o.preco));
  return maior <= 20 ? 20 : maior <= 30 ? 30 : maior <= 50 ? 50 : Math.ceil(maior / 10) * 10;
};

/** Estilo comum da capa e da chamada final: a mesma moldura das artes. */
function base(cor, t, extra) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Poppins:wght@600;700;800&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:${t.w}px;height:${t.h}px;overflow:hidden;font-family:'Baloo 2',Poppins,sans-serif;padding:${t.borda}px;background-color:${cor.fundo};
    background-image:radial-gradient(rgba(255,255,255,.55) 5px,transparent 6px),radial-gradient(rgba(255,255,255,.3) 3px,transparent 4px);
    background-size:64px 64px,64px 64px;background-position:0 0,32px 32px}
  .tela{position:relative;height:100%;background:#fff;border-radius:${t.raio}px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 18px 40px -16px rgba(0,0,0,.28)}
  .marca{font-family:Poppins,sans-serif;font-size:${t.marca}px;font-weight:800;letter-spacing:3px;color:${cor.forte};text-align:center}
  .marca i{width:${t.marca * 0.5}px;height:${t.marca * 0.5}px;border-radius:50%;background:${cor.forte};display:inline-block;margin:0 12px;vertical-align:middle}
  .faixa{position:relative;height:${Math.round(t.faixa * 0.6)}px;background:${cor.forte};color:#fff;display:flex;align-items:center;justify-content:center;
    gap:20px;font-size:${Math.round(t.nome * 0.85)}px;font-weight:800}
  .onda{position:absolute;left:0;top:-${Math.round(t.faixa * 0.12) - 1}px;height:${Math.round(t.faixa * 0.12)}px;width:100%}
  ${extra}
</style></head><body>`;
}
const ONDA = (cor) =>
  `<svg class="onda" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0,60 C160,0 340,0 500,50 C660,100 840,100 1000,40 L1000,100 L0,100 Z" fill="${cor.forte}"/></svg>`;
const SETA = `<svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

function capa(turno, ofertas, fotos, t, cor) {
  const teto = tetoDoPreco(ofertas);
  const [linha1, destaque, linha2] = turno === '12h'
    ? [`${ofertas.length} achadinhos pro bebê`, `até R$ ${teto}`, 'pra comprar hoje na Shopee']
    : ['os mais vendidos', 'pro bebê', `${ofertas.length} campeões de venda da Shopee`];
  // 3 cartoes cabem na largura: lado + 2 x 0,72 lado (com a rotacao)
  const lado = Math.round((t.w - 2 * t.borda) * 0.35);
  return `${base(cor, t, `
  .topo{padding:${t.pad}px ${t.pad}px 0;text-align:center}
  .l1{margin-top:${Math.round(t.pad * 0.35)}px;font-size:${Math.round(t.nome * 0.95)}px;font-weight:800;color:${cor.escuro};line-height:1}
  .dest{font-size:${Math.round(t.nome * 2.1)}px;font-weight:800;color:${cor.forte};line-height:.95;letter-spacing:-2px}
  .l2{font-family:Poppins,sans-serif;font-size:${Math.round(t.nome * 0.42)}px;font-weight:700;color:${cor.escuro};opacity:.7;margin-top:6px}
  .leque{position:relative;flex:1;min-height:0;margin:${Math.round(t.pad * 0.4)}px 0 ${Math.round(t.pad * 0.8)}px}
  .item{position:absolute;top:50%;left:50%;width:${lado}px;height:${lado}px;border-radius:32px;background:#fff;padding:18px;
    box-shadow:0 0 0 6px ${cor.fundo},0 24px 40px -18px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
  .item img{max-width:100%;max-height:100%;object-fit:contain;border-radius:18px}
  .item b{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:${cor.forte};color:#fff;border-radius:999px;
    padding:4px 22px;font-size:${Math.round(t.nome * 0.62)}px;font-weight:800;box-shadow:0 6px 0 rgba(0,0,0,.12)}
  .item:nth-child(1){transform:translate(-122%,-44%) rotate(-8deg)}
  .item:nth-child(3){transform:translate(22%,-44%) rotate(8deg)}
  .item:nth-child(2){transform:translate(-50%,-54%) scale(1.12);z-index:2}
`)}
  <div class="tela">
    <div class="topo">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <div class="l1">${esc(linha1)}</div>
      <div class="dest">${esc(destaque)}</div>
      <div class="l2">${esc(linha2)}</div>
    </div>
    <div class="leque">
      ${fotos.slice(0, 3).map((f, i) => `<div class="item"><img src="${f}"><b>R$ ${brl(ofertas[i].preco)}</b></div>`).join('')}
    </div>
    <div class="faixa">${ONDA(cor)}arrasta pro lado ${SETA}</div>
  </div>
</body></html>`;
}

function chamada(t, cor) {
  return `${base(cor, t, `
  .meio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${t.pad}px;gap:${Math.round(t.pad * 0.45)}px}
  .q{font-size:${Math.round(t.nome * 1.6)}px;font-weight:800;color:${cor.escuro};line-height:1}
  .t{font-family:Poppins,sans-serif;font-size:${Math.round(t.nome * 0.62)}px;font-weight:600;color:${cor.escuro};opacity:.85;line-height:1.3;max-width:860px;text-wrap:balance}
  .t b{color:${cor.forte};opacity:1}
  .pilula{margin-top:${Math.round(t.pad * 0.3)}px;background:${cor.forte};color:#fff;border-radius:999px;padding:${Math.round(t.nome * 0.2)}px ${Math.round(t.nome * 0.8)}px;
    font-size:${Math.round(t.nome * 1.3)}px;font-weight:800;box-shadow:0 10px 0 rgba(0,0,0,.12)}
  .passos{display:flex;flex-direction:column;gap:14px;margin-top:${Math.round(t.pad * 0.3)}px;text-align:left}
  .passos div{font-family:Poppins,sans-serif;font-size:${Math.round(t.nome * 0.6)}px;font-weight:700;color:${cor.escuro};display:flex;align-items:center;gap:20px}
  .passos i{flex:none;width:${Math.round(t.nome * 0.95)}px;height:${Math.round(t.nome * 0.95)}px;border-radius:50%;background:${cor.fundo};color:${cor.escuro};
    font-style:normal;display:flex;align-items:center;justify-content:center;font-family:'Baloo 2';font-weight:800}
`)}
  <div class="tela">
    <div class="meio">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <div class="q">Gostou de algum?</div>
      <div class="t">O link de <b>todos</b> esses achados tá no nosso grupo de ofertas no WhatsApp</div>
      <div class="pilula">link na bio</div>
      <div class="passos">
        <div><i>1</i>Toca no link da bio</div>
        <div><i>2</i>Entra no grupo Achadinhos Kids</div>
        <div><i>3</i>Pega o link e compra na Shopee</div>
      </div>
    </div>
    <div class="faixa">${ONDA(cor)}ofertas novas todo dia</div>
  </div>
</body></html>`;
}

const HASHTAGS = '#achadinhos #achadosshopee #shopee #bebe #maternidade #enxovaldebebe #maedeprimeiraviagem #promocao';

function legenda(turno, ofertas) {
  const titulo = turno === '12h' ? `${ofertas.length} achadinhos pro bebê até R$ ${tetoDoPreco(ofertas)} 💸` : `Os ${ofertas.length} mais vendidos pro bebê na Shopee 🏆`;
  return [
    titulo,
    '',
    ...ofertas.map((o, i) => `${i + 1}. ${nomeCurto(o.nome, 40)}: a partir de R$ ${brl(o.preco)}`),
    '',
    '👉 O link de todos tá no grupo Achadinhos Kids: entra pelo link da bio!',
    'Salva esse post pra não perder e manda pra uma mãe que precisa ver 💕',
    'Preço da Shopee muda rápido.',
    '',
    HASHTAGS,
    '',
    'Links de afiliado: posso ganhar comissão, sem custo extra pra você.',
  ].join('\n');
}

// ---------------------------------------------------------------- execucao

export { capa, chamada, legenda };

async function principal() {
  if (!BASE || !CHAVE) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY');
  const agora = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).reduce((m, p) => ({ ...m, [p.type]: p.value }), {});
  const dia = `${agora.year}-${agora.month}-${agora.day}`;
  const turno = TURNOS[process.argv[2]] ? process.argv[2] : Number(agora.hour) < 16 ? '12h' : '20h';
  const { cor } = TURNOS[turno];

  const ofertas = await escolher(turno);
  console.log(`Carrossel ${turno} de ${dia}: ${ofertas.map((o) => o.item_id).join(', ')}`);
  const fotos = await Promise.all(ofertas.map((o) => fotoEmbutida(o.imagem)));

  const pasta = path.resolve('saida-carrossel', `${dia}-${turno}`);
  await mkdir(pasta, { recursive: true });
  const nav = await (await chromium()).launch();
  const slides = [];
  try {
    // 5 imagens, cada uma em 2 tamanhos: feed (Instagram) e story (TikTok)
    const paginas = [
      (t) => capa(turno, ofertas, fotos, t, cor),
      ...ofertas.map((o, i) => (t) => html(o, t, fotos[i], { cor, numero: i + 1 })),
      (t) => chamada(t, cor),
    ];
    for (const [i, montar] of paginas.entries()) {
      const slide = {};
      for (const formato of ['feed', 'story']) {
        const arquivo = await renderizar(nav, montar(TAMANHOS[formato]), TAMANHOS[formato], path.join(pasta, `${String(i + 1).padStart(2, '0')}-${formato}.jpg`));
        slide[formato] = await subir(`carrossel/${dia}-${turno}/${path.basename(arquivo)}`, arquivo);
      }
      slides.push(slide);
      console.log(`imagem ${i + 1}/${paginas.length} ok`);
    }
  } finally {
    await nav.close();
  }

  const titulo = turno === '12h' ? `Achadinhos até R$ ${tetoDoPreco(ofertas)}` : 'Os mais vendidos pro bebê';
  await banco('carrosseis?on_conflict=dia,turno', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ dia, turno, titulo, legenda: legenda(turno, ofertas), slides, itens: ofertas.map((o) => o.item_id) }),
  });
  console.log(`Carrossel "${titulo}" pronto`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await principal();

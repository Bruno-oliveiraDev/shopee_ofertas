// Carrossel de 5 imagens pro Instagram (1080x1350) e TikTok (1080x1920), 2 por dia:
//   12h "Achadinhos ate R$ X" (os mais baratos) e 20h "Os mais vendidos pro bebe".
// Conta uma HISTORINHA (video/historia.mjs): 1 = capa com o gancho, 2 a 4 = cada produto como uma cena da rotina,
// 5 = fecho da historia + convite pro grupo. Tambem gera o story animado (video/story-animado.mjs) quando tem FFmpeg.
// Sobe no Storage (bucket videos, pasta carrossel/) e grava na tabela carrosseis; o cockpit mostra pra baixar e postar.
//
// Uso: node video/carrossel.mjs [12h|20h]   (sem turno: decide pela hora de Brasilia)
//      node video/carrossel.mjs trocas      (atende as trocas de produto pedidas no cockpit)
// Variaveis: SUPABASE_URL, SUPABASE_SERVICE_KEY
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CORES, TAMANHOS, brl, chromium, esc, fotoEmbutida, renderizar } from './gerar-arte.mjs';
import { nomeCurto } from './roteiro.mjs';
import { NBCAL, simplificar } from '../supabase/functions/_shared/shopee.js';
import { historiaDoDia, passos } from './historia.mjs';
import { storyAnimado } from './story-animado.mjs';

const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CHAVE = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'videos';
const PRODUTOS = 3;
const POR_CATEGORIA = 1; // 3 produtos de 3 categorias diferentes
const CAMPOS = 'item_id,nome,preco,preco_de,desconto,vendas,nota,imagem,categoria';

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

async function subir(nome, arquivo, tipo = 'image/jpeg') {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${nome}`, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': tipo, 'x-upsert': 'true' },
    body: await readFile(arquivo),
  });
  if (!r.ok) throw new Error(`Storage respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return `${BASE}/storage/v1/object/public/${BUCKET}/${nome}?v=${Date.now()}`;
}

/** 3 produtos que foram pro grupo (o link esta la), sem repetir os carrosseis dos ultimos 7 dias. */
async function escolher(turno) {
  const usados = new Set(
    (await banco(`carrosseis?select=itens&criado_em=gte.${new Date(Date.now() - 7 * 86400e3).toISOString()}`)).flatMap((c) => c.itens || [])
  );
  // comeca pelos ultimos 2 dias e abre a janela se faltar produto
  for (const dias of [2, 4, 7, 14]) {
    const desde = new Date(Date.now() - dias * 86400e3).toISOString();
    const enviadas = await banco(`ofertas?select=${CAMPOS}&status=eq.enviada&enviada_em=gte.${desde}&imagem=not.is.null&categoria=not.is.null&order=score.desc&limit=400`);
    const candidatas = enviadas.filter((o) => !usados.has(o.item_id) && o.preco > 0 && !NBCAL.test(simplificar(o.nome))).sort(TURNOS[turno].ordem);
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

/**
 * Capa = o gancho da historia, grande, e os 3 produtos so espiando embaixo (cortados): da vontade de arrastar pra ver.
 */
function capa(historia, ofertas, fotos, t, cor) {
  const s = (f) => Math.round(t.nome * f);
  const lado = Math.round((t.w - 2 * t.borda) * (t.linhas === 3 ? 0.36 : 0.3));
  return `${base(cor, t, `
  .topo{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:${t.pad}px ${Math.round(t.pad * 1.1)}px 0;text-align:center;gap:${Math.round(t.pad * 0.35)}px}
  .gancho{font-size:${t.linhas === 3 ? s(1.55) : s(1.45)}px;font-weight:800;color:${cor.escuro};line-height:1;letter-spacing:-1.5px;text-wrap:balance}
  .sub{display:inline-flex;align-self:center;align-items:center;gap:14px;font-family:Poppins,sans-serif;font-size:${s(0.55)}px;font-weight:800;color:${cor.forte}}
  .sub svg{width:1em;height:1em}
  .espia{position:relative;flex:none;height:${Math.round(lado * 0.78)}px;margin-bottom:${Math.round(t.faixa * 0.12)}px}
  .item{position:absolute;bottom:-${Math.round(lado * 0.3)}px;left:50%;width:${lado}px;height:${lado}px;border-radius:28px;background:#fff;padding:14px;
    box-shadow:0 0 0 6px ${cor.fundo},0 18px 34px -16px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
  .item img{max-width:100%;max-height:100%;object-fit:contain;border-radius:16px}
  .item:nth-child(1){transform:translateX(-140%) rotate(-10deg)}
  .item:nth-child(2){transform:translateX(-50%) rotate(2deg);z-index:2;bottom:-${Math.round(lado * 0.18)}px}
  .item:nth-child(3){transform:translateX(40%) rotate(9deg)}
`)}
  <div class="tela">
    <div class="topo">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <div class="gancho">${esc(historia.gancho)}</div>
      <div class="sub">${esc(historia.sub)} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
    </div>
    <div class="espia">${fotos.slice(0, 3).map((f) => `<div class="item"><img src="${f}"></div>`).join('')}</div>
    <div class="faixa">${ONDA(cor)}arrasta pro lado ${SETA}</div>
  </div>
</body></html>`;
}

/**
 * Imagem de cada produto como CENA da historia: a frase da rotina em cima (grande), o produto no meio
 * e o nome + preco embaixo, menores. Quem le primeiro se identifica, depois ve o achado.
 */
function cena(oferta, frase, foto, t, cor, numero, total) {
  const s = (f) => Math.round(t.nome * f);
  const temDe = oferta.preco_de && oferta.preco_de > oferta.preco;
  return `${base(cor, t, `
  .topo{padding:${t.pad}px ${t.pad}px 0;text-align:center}
  .frase{margin-top:${Math.round(t.pad * 0.3)}px;font-size:${t.linhas === 3 ? s(1.08) : s(0.98)}px;font-weight:800;color:${cor.escuro};line-height:1.02;letter-spacing:-.5px;text-wrap:balance}
  .foto{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:${Math.round(t.pad * 0.4)}px ${t.pad}px}
  .foto img{width:100%;height:100%;object-fit:contain;border-radius:24px}
  .pag{position:absolute;left:${Math.round(t.pad * 0.6)}px;top:${Math.round(t.pad * 0.1)}px;font-family:Poppins,sans-serif;font-size:${s(0.36)}px;font-weight:800;
    color:${cor.forte};background:#fff;border:3px solid ${cor.fundo};border-radius:999px;padding:4px 16px}
  .selo{position:absolute;right:${Math.round(t.pad * 0.5)}px;top:${Math.round(t.pad * 0.05)}px;width:${s(1.9)}px;height:${s(1.9)}px;border-radius:50%;background:#FFD23F;
    color:${cor.escuro};display:flex;align-items:center;justify-content:center;transform:rotate(12deg);font-size:${s(0.62)}px;font-weight:800;box-shadow:0 8px 0 rgba(0,0,0,.12)}
  .faixa{height:auto;flex-direction:column;gap:4px;padding:${Math.round(t.pad * 0.45)}px ${t.pad}px ${Math.round(t.pad * 0.4)}px}
  .nome{font-family:Poppins,sans-serif;font-size:${s(0.42)}px;font-weight:700;opacity:.95;text-align:center;line-height:1.2;
    display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
  .preco{display:flex;align-items:baseline;gap:16px;line-height:1}
  .preco s{font-family:Poppins,sans-serif;font-size:${s(0.42)}px;font-weight:600;opacity:.8;text-decoration-thickness:3px}
  .preco b{font-size:${s(1.25)}px;font-weight:800;letter-spacing:-1px}
`)}
  <div class="tela">
    <div class="topo">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <div class="frase">${esc(frase)}</div>
    </div>
    <div class="foto">
      <img src="${foto}">
      <div class="pag">${numero}/${total}</div>
      ${oferta.desconto >= 15 ? `<div class="selo">-${Math.round(oferta.desconto)}%</div>` : ''}
    </div>
    <div class="faixa">${ONDA(cor)}
      <div class="nome">${esc(nomeCurto(oferta.nome, 40))}</div>
      <div class="preco">${temDe ? `<s>R$ ${brl(oferta.preco_de)}</s>` : ''}<b>R$ ${brl(oferta.preco)}</b></div>
    </div>
  </div>
</body></html>`;
}

const ZAP = `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.52 11.99c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>`;

/**
 * Ultima imagem: vende o GRUPO, nao o link. Mostra o que a pessoa recebe (print do grupo com os achados do post),
 * quanto recebe (achados por dia, numero real) e 1 acao so, no verde do WhatsApp (a unica coisa verde da tela).
 */
function chamada(t, cor, { ofertas = [], fotos = [], porDia = null, fecho = null } = {}) {
  const s = (f) => Math.round(t.nome * f);
  const hora = ['08:14', '10:02', '11:37'];
  return `${base(cor, t, `
  .meio{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${t.pad}px ${t.pad}px 0;gap:${Math.round(t.pad * 0.3)}px}
  .q{margin-top:${Math.round(t.pad * 0.1)}px;font-size:${fecho ? s(0.95) : t.linhas === 3 ? s(1.2) : s(1.4)}px;${fecho ? 'text-wrap:balance' : 'white-space:nowrap'};font-weight:800;color:${cor.escuro};line-height:.98;letter-spacing:-1px}
  .q b{color:${cor.forte}}
  .t{font-family:Poppins,sans-serif;font-size:${s(0.56)}px;font-weight:600;color:${cor.escuro};line-height:1.3;max-width:900px;text-wrap:balance;opacity:.85}
  .t b{color:${cor.forte};font-weight:800}
  .zap{position:relative;width:100%;flex:1;min-height:0;border-radius:28px;overflow:hidden;background:#EFE7DE;display:flex;flex-direction:column;
    box-shadow:0 0 0 4px ${cor.fundo},0 22px 40px -22px rgba(0,0,0,.45);text-align:left}
  .zap header{flex:none;background:#008069;color:#fff;display:flex;align-items:center;gap:16px;padding:${s(0.22)}px ${s(0.35)}px}
  .zap header i{flex:none;width:${s(0.9)}px;height:${s(0.9)}px;border-radius:50%;background:${cor.fundo};color:${cor.escuro};font-style:normal;
    display:flex;align-items:center;justify-content:center;font-family:Poppins;font-size:${s(0.34)}px;font-weight:800}
  .zap header b{display:block;font-family:Poppins;font-size:${s(0.42)}px;font-weight:700;line-height:1.1}
  .zap header small{display:block;font-family:Poppins;font-size:${s(0.3)}px;font-weight:500;opacity:.85}
  .conversa{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:${s(0.2)}px;padding:${s(0.25)}px ${s(0.3)}px;overflow:hidden}
  .dia{align-self:center;background:#fff;color:#54656F;border-radius:10px;padding:4px 16px;font-family:Poppins;font-size:${s(0.28)}px;font-weight:600;
    box-shadow:0 1px 1px rgba(0,0,0,.08)}
  .msg{flex:none;align-self:flex-start;max-width:92%;background:#fff;border-radius:6px 22px 22px 22px;padding:${s(0.16)}px;display:flex;gap:${s(0.22)}px;align-items:center;
    box-shadow:0 1px 1px rgba(0,0,0,.1);font-family:Poppins}
  .msg img{flex:none;width:${s(1.6)}px;height:${s(1.6)}px;object-fit:contain;background:#fff;border-radius:14px;border:1px solid #eee}
  .msg .n{font-size:${s(0.36)}px;font-weight:700;color:#111B21;line-height:1.15;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
  .msg .p{font-size:${s(0.36)}px;font-weight:600;color:#3B4A54;margin-top:2px}
  .msg .p s{opacity:.7}
  .msg .p b{color:#111B21;font-weight:800}
  .msg .l{font-size:${s(0.3)}px;color:#027EB5;margin-top:2px}
  .msg .h{font-size:${s(0.24)}px;color:#667781;text-align:right;margin-top:-4px}
  .botao{flex:none;display:flex;align-items:center;justify-content:center;gap:${s(0.25)}px;width:100%;background:#1FA855;color:#fff;border-radius:999px;
    padding:${s(0.28)}px ${s(0.4)}px;font-size:${s(0.8)}px;font-weight:800;line-height:1;box-shadow:0 10px 0 #12803F;margin-top:${Math.round(t.pad * 0.15)}px}
  .botao svg{width:${s(0.85)}px;height:${s(0.85)}px;flex:none}
  .bio{font-family:Poppins,sans-serif;font-size:${s(0.42)}px;font-weight:700;color:${cor.escuro};margin:${Math.round(t.pad * 0.2)}px 0 ${Math.round(t.faixa * 0.12 + t.pad * 0.3)}px}
  .bio b{color:${cor.forte}}
  .faixa{font-size:${s(0.62)}px}
`)}
  <div class="tela">
    <div class="meio">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <div class="q">${fecho ? `${esc(fecho[0])}<br><b>${esc(fecho[1])}</b>` : `Esses foram <b>só ${ofertas.length || 3}</b>`}</div>
      <div class="t">${porDia
        ? `Todo dia saem <b>+${porDia} achadinhos</b> assim no nosso grupo do WhatsApp, com o link de cada um`
        : 'Todo dia tem achadinho novo assim no nosso grupo do WhatsApp, com o link de cada um'}</div>
      <div class="zap">
        <header><i>AK</i><span><b>Achadinhos Kids</b><small>grupo de ofertas</small></span></header>
        <div class="conversa">
          <div class="dia">HOJE</div>
          ${ofertas.slice(0, 3).map((o, i) => `<div class="msg"><img src="${fotos[i]}"><div>
            <div class="n">${esc(nomeCurto(o.nome, 30))}</div>
            <div class="p">${o.preco_de > o.preco ? `<s>R$ ${brl(o.preco_de)}</s> por ` : ''}<b>R$ ${brl(o.preco)}</b></div>
            <div class="l">s.shopee.com.br/…</div>
            <div class="h">${hora[i]}</div></div></div>`).join('')}
        </div>
      </div>
      <div class="botao">${ZAP}Quero entrar no grupo</div>
      <div class="bio">o link tá na <b>bio</b> do perfil</div>
    </div>
    <div class="faixa">${ONDA(cor)}grátis · sem spam · sai quando quiser</div>
  </div>
</body></html>`;
}

/** Quantos achados o grupo recebe por dia (media dos 3 ultimos dias cheios, o canal que recebeu menos), arredondado pra baixo de 5 em 5. */
async function achadosPorDia() {
  try {
    const diaBRT = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    const hoje = new Date(`${diaBRT(new Date())}T00:00:00-03:00`);
    const inicio = new Date(hoje.getTime() - 3 * 86400e3);
    const linhas = await banco(`envios?select=enviado_em,canal_id&ok=is.true&enviado_em=gte.${inicio.toISOString()}&enviado_em=lt.${hoje.toISOString()}&limit=1000`);
    const conta = {};
    for (const l of linhas) {
      const dia = diaBRT(new Date(l.enviado_em));
      conta[dia] ??= {};
      conta[dia][l.canal_id] = (conta[dia][l.canal_id] || 0) + 1;
    }
    const porDia = Object.values(conta).map((c) => Math.min(...Object.values(c))).filter((n) => n > 0);
    if (!porDia.length) return null;
    const media = Math.floor(porDia.reduce((a, b) => a + b, 0) / porDia.length / 5) * 5;
    return media >= 10 ? media : null;
  } catch (e) {
    console.log(`Nao deu pra contar os achados por dia: ${e.message}`);
    return null;
  }
}

// o Instagram aceita no maximo 5 hashtags por post (desde dez/2025)
const HASHTAGS = '#achadinhos #achadosshopee #enxovaldebebe #maternidade #bebe';

/** Legenda conta a mesma historia do carrossel: gancho, as 3 cenas com o produto, fecho e convite. */
function legenda(historia, ofertas, porDia = null) {
  const linhas = passos(historia, ofertas).map((l) => l.replace(/^\d+\.\s*/, '').replace(/^…|…$/g, ''));
  return [
    `${historia.gancho} ${historia.sub} 👇`,
    '',
    ...ofertas.map((o, i) => `${i + 1}. ${linhas[i]}: ${nomeCurto(o.nome, 40)}, R$ ${brl(o.preco)}`),
    '',
    `${historia.fecho.join(' ')} 💛`,
    `👉 O link desses ${ofertas.length} tá no nosso grupo grátis do WhatsApp${porDia ? `, junto com +${porDia} achadinhos novos por dia` : ''}. Link na bio!`,
    'Conhece uma mãe que ia se identificar? Manda pra ela 💕',
    'Preço da Shopee muda rápido.',
    '',
    HASHTAGS,
  ].join('\n');
}

// ---------------------------------------------------------------- execucao

export { capa, cena, chamada, legenda, achadosPorDia, banco, subir };

/** Gera as 5 imagens (feed + story), sobe no Storage e grava o carrossel do dia/turno. */
async function montarEPublicar(dia, turno, ofertas) {
  const { cor } = TURNOS[turno];
  const historia = historiaDoDia(dia, turno);
  const frases = passos(historia, ofertas);
  console.log(`Carrossel ${turno} de ${dia}: ${ofertas.map((o) => o.item_id).join(', ')}`);
  const fotos = await Promise.all(ofertas.map((o) => fotoEmbutida(o.imagem)));
  const porDia = await achadosPorDia();

  const pasta = path.resolve('saida-carrossel', `${dia}-${turno}`);
  await mkdir(pasta, { recursive: true });
  const nav = await (await chromium()).launch();
  const slides = [];
  try {
    // 5 imagens, cada uma em 2 tamanhos: feed (Instagram) e story (TikTok)
    const paginas = [
      (t) => capa(historia, ofertas, fotos, t, cor),
      ...ofertas.map((o, i) => (t) => cena(o, frases[i], fotos[i], t, cor, i + 2, ofertas.length + 2)),
      (t) => chamada(t, cor, { ofertas, fotos, porDia, fecho: historia.fecho }),
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

  // story animado (video): so roda onde tem FFmpeg; se falhar, o carrossel sai igual
  if (process.env.STORY_ANIMADO !== '0') {
    try {
      const quadros = slides.map((_, i) => path.join(pasta, `${String(i + 1).padStart(2, '0')}-story.jpg`));
      const mp4 = await storyAnimado({ historia, frases, quadros, pasta });
      slides[0].video = await subir(`carrossel/${dia}-${turno}/story-animado.mp4`, mp4, 'video/mp4');
      console.log('story animado ok');
    } catch (e) {
      console.log(`Story animado nao saiu: ${e.message}`);
    }
  }

  const titulo = historia.gancho;
  await banco('carrosseis?on_conflict=dia,turno', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ dia, turno, titulo, legenda: legenda(historia, ofertas, porDia), slides, itens: ofertas.map((o) => o.item_id) }),
  });
  console.log(`Carrossel "${titulo}" pronto`);
}

/** Pedidos de troca feitos no cockpit: troca o produto da posicao e regera o carrossel inteiro (capa e chamada mostram os 3). */
async function processarTrocas() {
  const pedidos = await banco('carrosseis?select=id,dia,turno,itens,trocas,trocas_pedido_em&trocas=not.is.null&order=id');
  if (!pedidos.length) return console.log('Nenhuma troca pedida');
  for (const c of pedidos) {
    // so limpa o pedido que foi atendido; se pediram outra troca no meio, ela fica pra proxima rodada
    const limpar = (extra) =>
      banco(`carrosseis?id=eq.${c.id}&trocas_pedido_em=eq.${encodeURIComponent(c.trocas_pedido_em)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ trocas: null, ...extra }),
      });
    try {
      const itens = [...c.itens];
      for (const [posicao, item] of Object.entries(c.trocas)) itens[Number(posicao) - 1] = String(item);
      const lista = await banco(`ofertas?select=${CAMPOS}&item_id=in.(${itens.map((i) => `"${i}"`).join(',')})`);
      const ofertas = itens.map((i) => lista.find((o) => o.item_id === i));
      if (ofertas.some((o) => !o)) throw new Error('Um dos produtos escolhidos nao esta mais na base');
      await montarEPublicar(c.dia, c.turno, ofertas);
      await limpar({ troca_erro: null });
    } catch (e) {
      console.error(`Troca do carrossel ${c.id} falhou: ${e.message}`);
      await limpar({ troca_erro: e.message.slice(0, 300) });
    }
  }
}

async function principal() {
  if (!BASE || !CHAVE) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY');
  if (process.argv[2] === 'trocas') return processarTrocas();
  const agora = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).reduce((m, p) => ({ ...m, [p.type]: p.value }), {});
  const dia = `${agora.year}-${agora.month}-${agora.day}`;
  const turno = TURNOS[process.argv[2]] ? process.argv[2] : Number(agora.hour) < 16 ? '12h' : '20h';
  await montarEPublicar(dia, turno, await escolher(turno));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await principal();

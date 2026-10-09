// Arte estatica de uma oferta: moldura colorida, nome em cima, produto no meio, preco com a promocao embaixo.
// Monta em HTML e tira o "print" com o Chromium (Playwright), em 2 tamanhos:
//   story 1080x1920 (Status do WhatsApp, stories) e feed 1080x1350 (post do Instagram/Facebook).
//
// Uso: node video/gerar-arte.mjs oferta.json pasta-de-saida
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { nomeCurto } from './roteiro.mjs';

// moldura por categoria: fundo (borda com bolinhas), forte (faixa do preco) e escuro (texto)
export const CORES = {
  roupa: { fundo: '#FFB8CE', forte: '#E8457A', escuro: '#4A0D25' },
  fralda: { fundo: '#AFDBFF', forte: '#2A86DB', escuro: '#0A2F54' },
  enxoval: { fundo: '#D3C6FF', forte: '#7655EE', escuro: '#25175E' },
  higiene: { fundo: '#AEEBDC', forte: '#14A07D', escuro: '#08463A' },
  alimentacao: { fundo: '#FFE2A0', forte: '#E0860B', escuro: '#5A3600' },
  brinquedo: { fundo: '#FFC9AB', forte: '#F0662A', escuro: '#5E2304' },
  seguranca: { fundo: '#C6ECAF', forte: '#3F9E22', escuro: '#1D460B' },
  geral: { fundo: '#FFB8CE', forte: '#E8457A', escuro: '#4A0D25' },
};

export const TAMANHOS = {
  story: { w: 1080, h: 1920, borda: 44, raio: 64, nome: 82, linhas: 3, preco: 190, faixa: 400, marca: 30, pad: 70 },
  feed: { w: 1080, h: 1350, borda: 34, raio: 52, nome: 62, linhas: 2, preco: 140, faixa: 280, marca: 24, pad: 54 },
};

export const brl = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Prova social da Shopee: "★ 4,8 · 9 mil vendidos". So mostra o que ajuda (nota boa, vendas de verdade). */
export function provaSocial(oferta) {
  const partes = [];
  if (oferta.nota >= 4.5) partes.push(`<b>★</b> ${Number(oferta.nota).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);
  if (oferta.vendas >= 1000) partes.push(`${Math.floor(oferta.vendas / 1000)} mil+ vendidos`);
  else if (oferta.vendas >= 100) partes.push(`${Math.floor(oferta.vendas / 100) * 100}+ vendidos`);
  return partes.join(' · ');
}

async function chromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    // no computador do Bruno o Playwright mora no harness de QA
    const req = createRequire(process.env.PLAYWRIGHT_DE || 'C:/Users/Bruno Oliveira/.claude/_qa_setur/package.json');
    return req('playwright').chromium;
  }
}

/**
 * Moldura: borda colorida com bolinhas + tela branca arredondada. Dentro: marca e nome em cima,
 * produto grande no branco (as fotos da Shopee ja tem fundo branco) e faixa do preco com onda embaixo.
 */
export function html(oferta, t, fotoDataUrl, { cor: corFixa, numero } = {}) {
  const cor = corFixa || CORES[oferta.categoria] || CORES.geral;
  const temDe = oferta.preco_de && oferta.preco_de > oferta.preco;
  const [reais, centavos] = brl(oferta.preco).split(',');
  const selo = Math.round(t.preco * 1.25);
  const prova = provaSocial(oferta);
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Poppins:wght@600;700;800&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:${t.w}px;height:${t.h}px;overflow:hidden;font-family:'Baloo 2',Poppins,sans-serif;padding:${t.borda}px;
    background-color:${cor.fundo};
    background-image:radial-gradient(rgba(255,255,255,.55) 5px,transparent 6px),radial-gradient(rgba(255,255,255,.3) 3px,transparent 4px);
    background-size:64px 64px,64px 64px;background-position:0 0,32px 32px}
  .tela{position:relative;height:100%;background:#fff;border-radius:${t.raio}px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 18px 40px -16px rgba(0,0,0,.28)}
  .topo{padding:${t.pad}px ${t.pad}px 0;text-align:center}
  .marca{display:inline-flex;align-items:center;gap:12px;font-family:Poppins,sans-serif;font-size:${t.marca}px;font-weight:800;letter-spacing:3px;
    color:${cor.forte}}
  .marca i{width:${t.marca * 0.5}px;height:${t.marca * 0.5}px;border-radius:50%;background:${cor.forte};display:inline-block}
  h1{margin-top:${Math.round(t.pad * 0.3)}px;font-size:${t.nome}px;line-height:1.02;font-weight:800;color:${cor.escuro};
    display:-webkit-box;-webkit-line-clamp:${t.linhas};-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}
  .foto{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:${Math.round(t.pad * 0.5)}px ${t.pad}px}
  .foto img{width:100%;height:100%;object-fit:contain;border-radius:24px}
  .prova{position:absolute;left:50%;bottom:${Math.round(t.faixa * 0.12) + 10}px;transform:translateX(-50%);white-space:nowrap;background:#fff;color:${cor.escuro};
    font-family:Poppins,sans-serif;font-size:${Math.round(t.marca * 1.25)}px;font-weight:700;padding:${Math.round(t.marca * 0.35)}px ${Math.round(t.marca * 0.9)}px;
    border-radius:999px;box-shadow:0 0 0 3px ${cor.fundo},0 10px 24px -10px rgba(0,0,0,.35)}
  .prova b{color:#F5A400}
  .selo{position:absolute;right:${Math.round(t.pad * 0.6)}px;top:${Math.round(t.pad * 0.2)}px;width:${selo}px;height:${selo}px;border-radius:50%;
    background:#FFD23F;color:${cor.escuro};display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(12deg);
    box-shadow:0 10px 0 rgba(0,0,0,.12)}
  .selo b{font-size:${Math.round(selo * 0.34)}px;font-weight:800;line-height:.9;letter-spacing:-1px}
  .selo span{font-family:Poppins,sans-serif;font-size:${Math.round(selo * 0.13)}px;font-weight:800;letter-spacing:2px}
  .faixa{position:relative;height:${t.faixa}px;background:${cor.forte};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding-top:${Math.round(t.faixa * 0.08)}px}
  .onda{position:absolute;left:0;right:0;top:-${Math.round(t.faixa * 0.12) - 1}px;height:${Math.round(t.faixa * 0.12)}px;width:100%}
  .de{font-family:Poppins,sans-serif;font-size:${Math.round(t.preco * 0.2)}px;font-weight:600;opacity:.85}
  .de s{text-decoration-thickness:3px}
  .linha{display:flex;align-items:center;gap:${Math.round(t.preco * 0.1)}px;line-height:1}
  .apartir{font-family:Poppins,sans-serif;font-size:${Math.round(t.preco * 0.17)}px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
    text-align:right;line-height:1.15;opacity:.95}
  .por{font-size:${t.preco}px;font-weight:800;letter-spacing:-3px;white-space:nowrap;line-height:.95;text-shadow:0 6px 0 rgba(0,0,0,.12)}
  .por small{font-size:.36em;letter-spacing:0;vertical-align:.95em;margin-right:8px}
  .por sup{font-size:.42em;letter-spacing:0;vertical-align:.9em}
  .numero{position:absolute;left:${Math.round(t.pad * 0.6)}px;top:${Math.round(t.pad * 0.2)}px;width:${Math.round(selo * 0.62)}px;height:${Math.round(selo * 0.62)}px;
    border-radius:50%;background:${cor.forte};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(selo * 0.36)}px;font-weight:800;
    box-shadow:0 8px 0 rgba(0,0,0,.12)}
</style></head><body>
  <div class="tela">
    <div class="topo">
      <div class="marca"><i></i>ACHADINHOS KIDS<i></i></div>
      <h1>${esc(nomeCurto(oferta.nome, t.linhas === 3 ? 50 : 40))}</h1>
    </div>
    <div class="foto">
      <img src="${fotoDataUrl}">
      ${numero ? `<div class="numero">${numero}</div>` : ''}
      ${prova ? `<div class="prova">${prova}</div>` : ''}
      ${oferta.desconto > 0 ? `<div class="selo"><b>-${Math.round(oferta.desconto)}%</b><span>OFF</span></div>` : ''}
    </div>
    <div class="faixa">
      <svg class="onda" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0,60 C160,0 340,0 500,50 C660,100 840,100 1000,40 L1000,100 L0,100 Z" fill="${cor.forte}"/></svg>
      ${temDe ? `<div class="de">de <s>R$ ${brl(oferta.preco_de)}</s> por</div>` : ''}
      <div class="linha">
        <div class="apartir">a partir<br>de</div>
        <div class="por"><small>R$</small>${reais}<sup>,${centavos}</sup></div>
      </div>
    </div>
  </div>
</body></html>`;
}

/** Foto da oferta embutida no HTML (data URL): o print nao depende de a Shopee responder durante a renderizacao. */
export async function fotoEmbutida(url) {
  const foto = await fetch(url);
  if (!foto.ok) throw new Error(`Foto da oferta nao baixou (${foto.status})`);
  const tipo = foto.headers.get('content-type') || 'image/jpeg';
  return `data:${tipo};base64,${Buffer.from(await foto.arrayBuffer()).toString('base64')}`;
}

/** Tira o print de um HTML no tamanho t e salva em arquivo (jpg). */
export async function renderizar(nav, conteudo, t, arquivo) {
  const pagina = await nav.newPage({ viewport: { width: t.w, height: t.h } });
  try {
    await pagina.setContent(conteudo, { waitUntil: 'networkidle' });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: arquivo, type: 'jpeg', quality: 90 });
  } finally {
    await pagina.close();
  }
  return arquivo;
}

/** Gera story.jpg e feed.jpg na pasta. Recebe um navegador aberto pra reaproveitar no lote. */
export async function gerarArte(oferta, pasta, navegador, opcoes = {}) {
  await mkdir(pasta, { recursive: true });
  const dataUrl = await fotoEmbutida(oferta.imagem);

  const proprio = !navegador;
  const nav = navegador || (await (await chromium()).launch());
  const saidas = {};
  try {
    for (const [nome, t] of Object.entries(TAMANHOS)) {
      saidas[nome] = await renderizar(nav, html(oferta, t, dataUrl, opcoes), t, path.join(pasta, `${nome}.jpg`));
    }
  } finally {
    if (proprio) await nav.close();
  }
  return saidas;
}

export { chromium };

// uso pela linha de comando
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const oferta = JSON.parse(await readFile(process.argv[2], 'utf8'));
  console.log(await gerarArte(oferta, path.resolve(process.argv[3] || 'saida-arte')));
}

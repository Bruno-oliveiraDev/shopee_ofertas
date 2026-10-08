// Arte estatica de uma oferta: moldura colorida, nome em cima, produto no meio, preco com a promocao embaixo.
// Monta em HTML e tira o "print" com o Chromium (Playwright), em 2 tamanhos:
//   story 1080x1920 (Status do WhatsApp, stories) e feed 1080x1350 (post do Instagram/Facebook).
//
// Uso: node video/gerar-arte.mjs oferta.json pasta-de-saida
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { nomeCurto } from './roteiro.mjs';

// moldura por categoria: o feed fica colorido e cada assunto tem a sua cor
const CORES = {
  roupa: { fundo: '#FF8FB1', escuro: '#7A1238' },
  fralda: { fundo: '#7CC4FF', escuro: '#0B3D6B' },
  enxoval: { fundo: '#B9A4FF', escuro: '#35217A' },
  higiene: { fundo: '#6FD8C0', escuro: '#0B5446' },
  alimentacao: { fundo: '#FFC861', escuro: '#6B4300' },
  brinquedo: { fundo: '#FF9F6B', escuro: '#7A2E05' },
  seguranca: { fundo: '#9BDB7A', escuro: '#25560E' },
  geral: { fundo: '#FF8FB1', escuro: '#7A1238' },
};

const TAMANHOS = {
  story: { w: 1080, h: 1920, foto: 820, nome: 74, linhas: 3, preco: 150, topo: 150, base: 170 },
  feed: { w: 1080, h: 1350, foto: 620, nome: 54, linhas: 2, preco: 112, topo: 60, base: 60 },
};

const brl = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function chromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    // no computador do Bruno o Playwright mora no harness de QA
    const req = createRequire(process.env.PLAYWRIGHT_DE || 'C:/Users/Bruno Oliveira/.claude/_qa_setur/package.json');
    return req('playwright').chromium;
  }
}

function html(oferta, t, fotoDataUrl) {
  const cor = CORES[oferta.categoria] || CORES.geral;
  const temDe = oferta.preco_de && oferta.preco_de > oferta.preco;
  const [reais, centavos] = brl(oferta.preco).split(',');
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800;900&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:${t.w}px;height:${t.h}px;background:${cor.fundo};font-family:Poppins,sans-serif;overflow:hidden;
    display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:28px;padding:${t.topo}px 70px ${t.base}px}
  .marca{font-size:${Math.round(t.nome * 0.42)}px;font-weight:700;color:${cor.escuro};background:#fff;border-radius:999px;padding:8px 26px;letter-spacing:.5px}
  h1{font-size:${t.nome}px;line-height:1.12;font-weight:800;color:${cor.escuro};text-align:center;margin-top:${Math.round(t.nome * 0.4)}px;
    display:-webkit-box;-webkit-line-clamp:${t.linhas};-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}
  .topo{display:flex;flex-direction:column;align-items:center;width:100%}
  .cartao{position:relative;width:${t.foto}px;height:${t.foto}px;background:#fff;border-radius:56px;padding:28px;
    box-shadow:0 30px 60px -20px rgba(0,0,0,.35)}
  .cartao img{width:100%;height:100%;object-fit:contain;border-radius:32px}
  .selo{position:absolute;top:-34px;right:-34px;width:${Math.round(t.foto * 0.27)}px;height:${Math.round(t.foto * 0.27)}px;border-radius:50%;
    background:#EE2D4D;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(10deg);
    box-shadow:0 12px 24px -8px rgba(0,0,0,.4);border:8px solid #fff}
  .selo b{font-size:${Math.round(t.foto * 0.085)}px;font-weight:900;line-height:1}
  .selo span{font-size:${Math.round(t.foto * 0.04)}px;font-weight:800;line-height:1.1}
  .preco{background:#fff;border-radius:44px;padding:26px 56px 30px;text-align:center;box-shadow:0 20px 40px -18px rgba(0,0,0,.3)}
  .de{font-size:${Math.round(t.preco * 0.3)}px;font-weight:600;color:#8A8A99}
  .de s{text-decoration-color:#EE2D4D;text-decoration-thickness:4px}
  .apartir{font-size:${Math.round(t.preco * 0.22)}px;font-weight:700;color:${cor.escuro};text-transform:uppercase;letter-spacing:2px;margin-top:4px}
  .por{font-size:${t.preco}px;font-weight:900;color:#0E9F5B;line-height:1;letter-spacing:-2px;white-space:nowrap}
  .por small{font-size:.42em;letter-spacing:0;vertical-align:.9em;margin-right:6px}
  .por sup{font-size:.45em;vertical-align:.85em;letter-spacing:0}
</style></head><body>
  <div class="topo">
    <div class="marca">ACHADINHOS KIDS</div>
    <h1>${esc(nomeCurto(oferta.nome, t.linhas === 3 ? 50 : 40))}</h1>
  </div>
  <div class="cartao">
    <img src="${fotoDataUrl}">
    ${oferta.desconto > 0 ? `<div class="selo"><b>-${Math.round(oferta.desconto)}%</b><span>OFF</span></div>` : ''}
  </div>
  <div class="preco">
    ${temDe ? `<div class="de">de <s>R$ ${brl(oferta.preco_de)}</s></div>` : ''}
    <div class="apartir">a partir de</div>
    <div class="por"><small>R$</small>${reais}<sup>,${centavos}</sup></div>
  </div>
</body></html>`;
}

/** Gera story.jpg e feed.jpg na pasta. Recebe um navegador aberto pra reaproveitar no lote. */
export async function gerarArte(oferta, pasta, navegador) {
  await mkdir(pasta, { recursive: true });
  const foto = await fetch(oferta.imagem);
  if (!foto.ok) throw new Error(`Foto da oferta nao baixou (${foto.status})`);
  const tipo = foto.headers.get('content-type') || 'image/jpeg';
  const dataUrl = `data:${tipo};base64,${Buffer.from(await foto.arrayBuffer()).toString('base64')}`;

  const proprio = !navegador;
  const nav = navegador || (await (await chromium()).launch());
  const saidas = {};
  try {
    for (const [nome, t] of Object.entries(TAMANHOS)) {
      const pagina = await nav.newPage({ viewport: { width: t.w, height: t.h } });
      await pagina.setContent(html(oferta, t, dataUrl), { waitUntil: 'networkidle' });
      await pagina.evaluate(() => document.fonts.ready);
      saidas[nome] = path.join(pasta, `${nome}.jpg`);
      await pagina.screenshot({ path: saidas[nome], type: 'jpeg', quality: 90 });
      await pagina.close();
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

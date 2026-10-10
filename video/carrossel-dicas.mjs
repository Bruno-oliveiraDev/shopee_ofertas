// Carrossel de DICAS (zero venda), 1 por dia: 6 imagens sobre foto neutra (CC0, pasta video/fundos).
//   1 = capa com o gancho, 2 a 5 = as 4 dicas, 6 = fecho (salva, manda pra uma amiga, segue o perfil).
// Sem produto, preco ou link: o perfil e quem leva pro grupo. Grava em carrosseis com turno 'dicas'.
//
// Uso: node video/carrossel-dicas.mjs [AAAA-MM-DD]   (sem data: hoje em Brasilia)
//      node video/carrossel-dicas.mjs previa pasta [tema]   (so gera as imagens locais, sem banco)
// Variaveis: SUPABASE_URL, SUPABASE_SERVICE_KEY
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAMANHOS, chromium, esc, renderizar } from './gerar-arte.mjs';
import { TEMAS, legendaDicas, temaDoDia } from './dicas.mjs';

const PASTA_FUNDOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fundos');
const PERFIL = '@achadinhos_kids2';

/** 6 fotos do dia, sem repetir entre si; a sequencia anda a cada dia pra nao repetir o post de ontem. */
async function fundosDoDia(dia, quantos) {
  const arquivos = (await readdir(PASTA_FUNDOS)).filter((f) => /\.jpe?g$/i.test(f)).sort();
  if (!arquivos.length) return Array(quantos).fill(null);
  const d = new Date(`${dia}T12:00:00Z`);
  const doAno = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
  const escolhidos = Array.from({ length: quantos }, (_, i) => arquivos[(doAno * quantos + i) % arquivos.length]);
  return Promise.all(escolhidos.map(async (f) => `data:image/jpeg;base64,${(await readFile(path.join(PASTA_FUNDOS, f))).toString('base64')}`));
}

/** Moldura comum: foto em tela cheia + veu pra leitura. Story deixa 250 px livres em cima e 340 embaixo. */
function base(t, fundo, extra) {
  const story = t.h > 1500;
  const s = (f) => Math.round(t.w * f);
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@500;600;700&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{width:${t.w}px;height:${t.h}px;overflow:hidden;font-family:Inter,sans-serif;color:#FFF8EE;position:relative;
    background:${fundo ? `#3B3530 url(${fundo}) center/cover` : 'linear-gradient(160deg,#C9B8A6,#8C7B6B)'}}
  .veu{position:absolute;inset:0;background:linear-gradient(180deg,rgba(25,20,16,.35) 0%,rgba(25,20,16,.05) 35%,rgba(25,20,16,.15) 55%,rgba(25,20,16,.72) 100%)}
  .area{position:absolute;left:${s(0.075)}px;right:${s(0.075)}px;top:${story ? 270 : s(0.07)}px;bottom:${story ? 360 : s(0.07)}px;display:flex;flex-direction:column}
  .topo{display:flex;justify-content:space-between;align-items:center;font-size:${s(0.024)}px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:.92}
  .pontos{display:flex;gap:10px}
  .pontos i{width:${s(0.011)}px;height:${s(0.011)}px;border-radius:50%;background:rgba(255,248,238,.45)}
  .pontos i.on{background:#FFF8EE}
  .serif{font-family:Fraunces,serif}
  ${extra}
</style></head><body><div class="veu"></div>`;
}

const pontos = (n, total) => `<div class="pontos">${Array.from({ length: total }, (_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;

function capa(tema, t, fundo, total) {
  const s = (f) => Math.round(t.w * f);
  return `${base(t, fundo, `
  .gancho{margin-top:auto;font-size:${s(0.092)}px;font-weight:700;line-height:1.02;letter-spacing:-1px;text-wrap:balance;text-shadow:0 2px 24px rgba(0,0,0,.35)}
  .rodape{margin-top:${s(0.04)}px;display:flex;align-items:center;gap:14px;font-size:${s(0.03)}px;font-weight:600}
  .rodape span{display:inline-block;padding:10px 22px;border:2px solid rgba(255,248,238,.8);border-radius:999px}
`)}
  <div class="area">
    <div class="topo"><span>dica de mãe pra mãe</span>${pontos(0, total)}</div>
    <div class="gancho serif">${esc(tema.gancho)}</div>
    <div class="rodape"><span>arrasta pro lado →</span></div>
  </div>
</body></html>`;
}

function dica(d, i, t, fundo, total) {
  const s = (f) => Math.round(t.w * f);
  return `${base(t, fundo, `
  .cartao{margin-top:auto;background:rgba(255,250,243,.93);color:#3A302A;border-radius:${s(0.035)}px;padding:${s(0.06)}px ${s(0.06)}px ${s(0.065)}px;
    box-shadow:0 20px 50px -20px rgba(0,0,0,.5)}
  .num{font-size:${s(0.075)}px;font-weight:700;color:#B88A6A;line-height:1}
  .t{margin-top:${s(0.02)}px;font-size:${s(0.062)}px;font-weight:700;line-height:1.08;letter-spacing:-.5px;text-wrap:balance}
  .x{margin-top:${s(0.025)}px;font-size:${s(0.036)}px;font-weight:500;line-height:1.42;color:#5A4D44;text-wrap:pretty}
`)}
  <div class="area">
    <div class="topo"><span>${PERFIL}</span>${pontos(i + 1, total)}</div>
    <div class="cartao">
      <div class="num serif">${String(i + 1).padStart(2, '0')}</div>
      <div class="t serif">${esc(d.t)}</div>
      <div class="x">${esc(d.x)}</div>
    </div>
  </div>
</body></html>`;
}

function fecho(t, fundo, total) {
  const s = (f) => Math.round(t.w * f);
  return `${base(t, fundo, `
  .meio{margin:auto 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:${s(0.035)}px}
  .a{font-size:${s(0.085)}px;font-weight:700;line-height:1.05;text-shadow:0 2px 24px rgba(0,0,0,.35)}
  .b{font-size:${s(0.04)}px;font-weight:600;line-height:1.4;max-width:${s(0.75)}px;text-wrap:balance}
  .perfil{margin-top:${s(0.02)}px;padding:${s(0.022)}px ${s(0.05)}px;border-radius:999px;background:rgba(255,250,243,.93);color:#3A302A;font-size:${s(0.038)}px;font-weight:700}
`)}
  <div class="area">
    <div class="topo"><span>dica de mãe pra mãe</span>${pontos(total - 1, total)}</div>
    <div class="meio">
      <div class="a serif">Salva pra lembrar 💛</div>
      <div class="b">e manda pra uma mãe que precisa ver isso hoje</div>
      <div class="perfil">mais dicas assim no ${PERFIL}</div>
    </div>
  </div>
</body></html>`;
}

/** Gera as 6 imagens (feed + story) do tema numa pasta. Devolve [{feed, story}] com os caminhos locais. */
export async function gerarDicas(tema, dia, pasta) {
  await mkdir(pasta, { recursive: true });
  const total = tema.dicas.length + 2;
  const fundos = await fundosDoDia(dia, total);
  const paginas = [
    (t) => capa(tema, t, fundos[0], total),
    ...tema.dicas.map((d, i) => (t) => dica(d, i, t, fundos[i + 1], total)),
    (t) => fecho(t, fundos[total - 1], total),
  ];
  const nav = await (await chromium()).launch();
  const slides = [];
  try {
    for (const [i, montar] of paginas.entries()) {
      const slide = {};
      for (const formato of ['feed', 'story']) {
        slide[formato] = await renderizar(nav, montar(TAMANHOS[formato]), TAMANHOS[formato], path.join(pasta, `${String(i + 1).padStart(2, '0')}-${formato}.jpg`));
      }
      slides.push(slide);
    }
  } finally {
    await nav.close();
  }
  return slides;
}

async function principal() {
  if (process.argv[2] === 'previa') {
    const tema = TEMAS.find((x) => x.id === process.argv[4]) || temaDoDia(new Date().toISOString().slice(0, 10));
    console.log(await gerarDicas(tema, new Date().toISOString().slice(0, 10), path.resolve(process.argv[3] || 'saida-dicas')));
    return console.log(legendaDicas(tema));
  }
  const { banco, subir } = await import('./carrossel.mjs');
  const dia = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const tema = temaDoDia(dia);
  console.log(`Dicas de ${dia}: ${tema.id}`);
  const locais = await gerarDicas(tema, dia, path.resolve('saida-carrossel', `${dia}-dicas`));
  const slides = [];
  for (const l of locais) {
    const slide = {};
    for (const formato of ['feed', 'story']) slide[formato] = await subir(`carrossel/${dia}-dicas/${path.basename(l[formato])}`, l[formato]);
    slides.push(slide);
  }
  await banco('carrosseis?on_conflict=dia,turno', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ dia, turno: 'dicas', titulo: tema.gancho, legenda: legendaDicas(tema), slides, itens: [] }),
  });
  console.log(`Carrossel de dicas "${tema.gancho}" pronto`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await principal();

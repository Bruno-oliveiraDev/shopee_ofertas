// Carrossel de DICAS (zero venda), 1 por dia, no modelo "Revista de mãe" (vencedor do loop de 10/10/2026):
//   capa (foto real em cima, papel rasgado e gancho) -> 4 dicas (foto, papel, foto, caneta) -> cola pra printar -> fecho (manda pra uma amiga).
// Os templates ficam em video/templates-dicas (CSS, auto-ajuste do texto e QA dentro de cada HTML: window.__pronto devolve os erros).
// Dica com foto que não coube vira dica de papel (plano B). Qualquer outro erro de QA derruba o post antes de gravar.
// Fotos: video/fundos + tags.json (capa, foco, assunto; nunca sonoSeguro:false nem evitar:true). Grava em carrosseis com turno 'dicas'.
//
// Uso: node video/carrossel-dicas.mjs [AAAA-MM-DD]   (sem data: hoje em Brasilia)
//      node video/carrossel-dicas.mjs previa pasta [tema] [AAAA-MM-DD]   (so gera as imagens locais, sem banco)
// Variaveis: SUPABASE_URL, SUPABASE_SERVICE_KEY
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAMANHOS, chromium } from './gerar-arte.mjs';
import { ATIVOS, TEMAS, legendaDicas, temaDoDia } from './dicas.mjs';
import { GANCHOS } from './ganchos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA_FUNDOS = path.join(AQUI, 'fundos');
const PASTA_TEMPLATES = path.join(AQUI, 'templates-dicas');
const PERFIL = '@achadinhos_kids';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// palavra de 1-2 letras gruda na seguinte (sem "É" ou "a" sozinho no fim da linha)
const cola = (t) => String(t ?? '').replace(/(^|\s)(\S{1,2}) (?=\S)/g, '$1$2 ');
const aspas = (t) => String(t ?? '').replace(/"([^"]*)"/g, '“$1”');
const fmt = (t) => esc(cola(aspas(t))).replace(/\*(.+?)\*/g, '<span class="mk">$1</span>');
const itens = (lista) => lista.map((it) => `<div class="item" data-txt><span class="caixa"></span><span class="it" data-papel="item" data-piso="40">${esc(it)}</span></div>`).join('');
const preencher = (tpl, v) => tpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => v[k] ?? '');
const doAno = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  return Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
};

// o Chromium do GitHub nao tem fonte de emoji: emoji so na legenda
const semEmoji = (t) => t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();

/** Marca-texto amarelo no fim do gancho: o trecho depois de ":" (se curto) ou as 3 últimas palavras. */
function marcar(gancho) {
  if (gancho.includes('*')) return gancho;
  const i = gancho.lastIndexOf(':');
  if (i > 0 && gancho.length - i < 42) return `${gancho.slice(0, i + 1)} *${gancho.slice(i + 1).trim()}*`;
  const p = gancho.split(' ');
  return p.length > 4 ? `${p.slice(0, -3).join(' ')} *${p.slice(-3).join(' ')}*` : gancho;
}

/** Fecho com destinatária certa (o envio é o que o Instagram mais premia). */
const FECHO = {
  'sono-seguro': 'Manda pra quem *vai montar o berço.*',
  visitas: 'Manda pro *grupo da família.*',
  parceiro: 'Manda pro *pai do bebê.*',
  'mala-maternidade': 'Manda pra amiga que *está esperando bebê.*',
  'enxoval-esperto': 'Manda pra amiga que *está montando o enxoval.*',
  'primeiro-mes': 'Manda pra amiga que *acabou de ganhar bebê.*',
  'carga-mental': 'Manda pra quem *divide a casa com você.*',
};

/** Gancho do dia: a cada volta completa dos temas usa o próximo dos 5 ganchos testáveis. */
function ganchoDoDia(tema, dia) {
  // o fecho ja pede o envio: gancho que comeca com Manda/Salva fica de fora da capa
  const opcoes = [tema.gancho, ...(GANCHOS[tema.id] || [])].filter((g, i, a) => a.indexOf(g) === i && g.length <= 70 && !/^(manda|salva)/i.test(g));
  if (!opcoes.length) return tema.gancho;
  return opcoes[Math.floor(doAno(dia) / ATIVOS.length) % opcoes.length];
}

/** Fotos do dia (capa, 2 dicas, fecho), sem repetir no post; a sequência anda a cada dia. */
async function fotosDoDia(dia) {
  const { fotos } = JSON.parse(await readFile(path.join(PASTA_FUNDOS, 'tags.json'), 'utf8'));
  const boas = fotos.filter((f) => f.sonoSeguro !== false && !f.evitar);
  const n = doAno(dia);
  const roda = (lista, k) => lista[(n * 2 + k) % lista.length];
  const capa = roda(boas.filter((f) => f.capa), 0);
  const fecho = roda(boas.filter((f) => f !== capa && (f.assunto || []).some((a) => ['maos', 'pes', 'colo'].includes(a))), 0);
  const resto = boas.filter((f) => f !== capa && f !== fecho && !f.capa);
  const dicas = [roda(resto, 0), roda(resto, 1)];
  if (dicas[0] === dicas[1]) dicas[1] = roda(resto, 2);
  const embutir = async (f) => ({ url: `data:image/jpeg;base64,${(await readFile(path.join(PASTA_FUNDOS, f.arquivo))).toString('base64')}`, foco: f.foco || '50% 40%' });
  return { capa: await embutir(capa), fecho: await embutir(fecho), dicas: await Promise.all(dicas.map(embutir)) };
}

/** Os slides do post a partir do tema (formato de dicas.mjs: gancho, 4 dicas {t, x}). */
function montarSlides(tema, gancho, fotos) {
  const tons = ['foto', 'papel', 'foto', 'caneta'];
  let f = 0;
  return [
    { tipo: 'capa', foto: fotos.capa, kicker: doAno(tema._dia) % 2 ? 'pra salvar' : 'de mãe pra mãe', titulo: marcar(semEmoji(gancho)), sub: `${tema.dicas.length} dicas, arrasta pro lado` },
    ...tema.dicas.map((d, i) => ({ tipo: 'dica', n: i + 1, tom: tons[i % tons.length], foto: tons[i % tons.length] === 'foto' ? fotos.dicas[f++ % 2] : null, titulo: d.t, texto: d.x })),
    { tipo: 'cola', kicker: 'pra printar', nota: 'cola na geladeira', titulo: 'Resumo pra não esquecer', itens: tema.dicas.map((d) => d.t) },
    { tipo: 'fecho', foto: fotos.fecho, titulo: FECHO[tema.id] || 'Manda pra uma amiga que *é mãe também.*', sub: 'Ela vai lembrar de você.', depois: 'Salva pra reler. Grupo de achados: link na bio.' },
  ];
}

function variaveis(s, k, total, semente, formato, comFoto) {
  return {
    FORMATO: formato, SEMENTE: `${semente}:${k}`, PERFIL: esc(PERFIL), PAG: `${k + 1}/${total}`,
    TOM: s.tom === 'caneta' ? 'caneta' : '', DESTAQUE: s.destaque ? 'destaque' : '',
    ...(comFoto && s.foto ? { FOTO_URL: s.foto.url, FOTO_FOCO: s.foto.foco } : {}),
    KICKER: esc(s.kicker), TITULO: fmt(s.titulo), SUB: fmt(s.sub), TEXTO: fmt(s.texto), N: esc(s.n),
    NOTA: s.nota ? esc((s.tipo === 'cola' ? '' : '↳ ') + s.nota) : '', ITENS: s.itens ? itens(s.itens) : '', DEPOIS: esc(s.depois),
  };
}

/** Gera as imagens (feed + story) do tema numa pasta. Devolve { slides: [{feed, story}], gancho }. */
export async function gerarDicas(tema, dia, pasta) {
  await mkdir(pasta, { recursive: true });
  const gancho = ganchoDoDia(tema, dia);
  const slides = montarSlides({ ...tema, _dia: dia }, gancho, await fotosDoDia(dia));
  const templates = {};
  for (const nome of ['capa', 'dica-foto', 'dica-papel', 'cola', 'fecho']) templates[nome] = await readFile(path.join(PASTA_TEMPLATES, `${nome}.html`), 'utf8');

  const nav = await (await chromium()).launch();
  const pagina = await nav.newPage({ deviceScaleFactor: 1 });
  const saida = [];
  try {
    for (const [k, s] of slides.entries()) {
      const slide = {};
      for (const formato of ['feed', 'story']) {
        const t = TAMANHOS[formato];
        await pagina.setViewportSize({ width: t.w, height: t.h });
        // plano B: dica com foto que não coube vira dica de papel
        const tentativas = s.tipo === 'dica' ? (s.foto ? ['dica-foto', 'dica-papel'] : ['dica-papel']) : [s.tipo];
        let erros = [];
        for (const nome of tentativas) {
          await pagina.setContent(preencher(templates[nome], variaveis(s, k, slides.length, `${dia}:${tema.id}`, formato, nome !== 'dica-papel')), { waitUntil: 'networkidle' });
          erros = await pagina.evaluate(() => window.__pronto);
          if (!erros.length) break;
          console.log(`  slide ${k + 1} ${formato} (${nome}): ${erros.join(' | ')}${nome === 'dica-foto' ? ' -> plano B (papel)' : ''}`);
        }
        if (erros.length) throw new Error(`Slide ${k + 1} (${formato}) reprovou no QA: ${erros.join(' | ')}`);
        slide[formato] = path.join(pasta, `${String(k + 1).padStart(2, '0')}-${formato}.jpg`);
        await pagina.screenshot({ path: slide[formato], type: 'jpeg', quality: 90 });
      }
      saida.push(slide);
    }
  } finally {
    await nav.close();
  }
  return { slides: saida, gancho };
}

async function principal() {
  if (process.argv[2] === 'previa') {
    const dia = process.argv[5] || new Date().toISOString().slice(0, 10);
    const tema = TEMAS.find((x) => x.id === process.argv[4]) || temaDoDia(dia);
    const { slides, gancho } = await gerarDicas(tema, dia, path.resolve(process.argv[3] || 'saida-dicas'));
    console.log(slides);
    return console.log(legendaDicas(tema, gancho));
  }
  const { banco, subir } = await import('./carrossel.mjs');
  const dia = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const tema = temaDoDia(dia);
  console.log(`Dicas de ${dia}: ${tema.id}`);
  const { slides: locais, gancho } = await gerarDicas(tema, dia, path.resolve('saida-carrossel', `${dia}-dicas`));
  const slides = [];
  for (const l of locais) {
    const slide = {};
    for (const formato of ['feed', 'story']) slide[formato] = await subir(`carrossel/${dia}-dicas/${path.basename(l[formato])}`, l[formato]);
    slides.push(slide);
  }
  const titulo = gancho.replace(/\*/g, '');
  await banco('carrosseis?on_conflict=dia,turno', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ dia, turno: 'dicas', titulo, legenda: legendaDicas(tema, gancho), slides, itens: [] }),
  });
  console.log(`Carrossel de dicas "${titulo}" pronto`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await principal();

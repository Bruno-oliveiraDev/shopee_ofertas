// Carrossel de ACHADOS (12h e 20h) no modelo "a lista que cabe num post-it" (vencedor do loop de 10/10/2026):
//   1 capa (foto CC0 de gente + gancho à mão + post-it com 3 palavras) -> 1 slide por produto (polaroid, pra que serve, preço discreto
//   com #publi) -> fecho (manda pra uma amiga; o grupo só como "link do grupo na bio").
// Templates em video/templates-achados (achados.css/js fazem os traços à mão, o encaixe do texto e o QA: window.__QA = {erros, avisos}).
// O texto de cada produto sai de USOS (pelo nome) ou da categoria: frase de uso verdadeira e genérica, nunca promessa de saúde.
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAMANHOS, brl, chromium, fotoEmbutida } from './gerar-arte.mjs';
import { nomeCurto } from './roteiro.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.join(AQUI, 'templates-achados');
const PASTA_FUNDOS = path.join(AQUI, 'fundos');
const PERFIL = '@achadinhos_kids';

/** Erro de QA num produto: o job troca o produto e tenta de novo. */
export class ProdutoRuim extends Error {
  constructor(itemId, msg) { super(msg); this.itemId = itemId; }
}

// [regex no nome, palavra do post-it (até 12), pra que serve (até 140, com *marca*), anotação à mão (até 30)]
const USOS = [
  [/\bbody\b|bodies/i, 'body', 'Abre embaixo: troca a fralda *sem tirar a roupa toda*. Bebê pequeno usa vários por dia.', 'tem que ter vários'],
  [/pijama|macac[aã]o/i, 'pijama', 'Peça inteira *não deixa a barriga de fora* quando ele se mexe dormindo.', 'perde o tamanho rápido'],
  [/\bmeias?\b/i, 'meia', 'Meia de bebê *some na máquina de lavar*. Kit com várias resolve a semana.', 'sempre falta um pé'],
  [/sapatinho|pantufa/i, 'sapatinho', 'Sapatinho macio *segura a meia no pé* e mantém o pezinho quente.', 'confere o tamanho'],
  [/touca|gorro/i, 'touca', 'Touquinha pros *primeiros dias e pro frio*. Ocupa nada na bolsa.', 'leva na bolsa'],
  [/\bshorts?\b|tapa.?fralda|\bcal[cç]a\b|mij[aã]o|conjunto|vestido|camiseta|jardineira|roupa/i, 'roupinha', 'Bebê *perde o tamanho em poucas semanas*. Achado bom é o que deixa trocar sem dó.', 'confere a tabela'],
  [/len[cç]o|lencinho/i, 'lenço', 'Lenço umedecido acaba *sem a gente ver*. Um pacote extra na bolsa e outro no trocador.', 'um em cada canto'],
  [/^(?!.*(toalha|pano|tapa)).*fralda/i, 'fralda', 'Recém-nascido usa *muitas fraldas por dia*. Preço bom no pacote faz diferença no mês.', 'confere o tamanho'],
  [/toalha/i, 'toalha', 'Toalha *com capuz* cobre a cabecinha logo que sai do banho.', 'separa antes do banho'],
  [/manta|cueiro/i, 'manta', 'Manta leve *vai pra todo lado*: carrinho, colo, sofá.', 'lava antes de usar'],
  [/\blixa|cortador de unha|tesourinha/i, 'unha', 'Unha de bebê *cresce rápido e arranha o rostinho*. Lixa devagar, sem lâmina perto do dedo.', 'faz com ele dormindo'],
  [/kit (de )?higiene|escova.*pente|pente.*escova/i, 'higiene', 'Escova, pente e cortador *no mesmo estojo*. Fica tudo pronto no trocador.', 'tudo num lugar só'],
  [/shampoo|sabonete|condicionador|hidratante|banho/i, 'banho', 'Produto de banho de bebê *acaba rápido*. Vale ter um de reserva.', 'confere a idade indicada'],
  [/babador/i, 'babador', 'Babador *segura a sujeira* da papinha e da baba. Troca e lava fácil.', 'tenha vários'],
  [/\bcopo/i, 'copo', 'Copo com alça *ajuda a segurar sozinho* na fase de aprender.', 'a bagunça faz parte'],
  [/mordedor/i, 'mordedor', 'Pra fase de *levar tudo à boca*: melhor um mordedor que o controle da TV.', 'lava antes de dar'],
  [/protetor(es)? de tomada|tomada/i, 'tomada', 'Tomada baixa fica *na altura da mão* de quem engatinha.', 'atrás do sofá também'],
  [/quina|canto/i, 'quina', 'Quina de mesa fica *na altura da cabeça* de quem começou a andar.', 'mesa de centro primeiro'],
  [/trocador/i, 'troca', 'Troca de fralda *em qualquer lugar*: casa da vó, carro, shopping.', 'dobra e cabe na bolsa'],
  [/organizador|cesto|cesta/i, 'organizar', 'Tudo do bebê *num lugar só*: você acha de madrugada sem acender a luz.', 'um por tamanho'],
];
const POR_CATEGORIA = {
  roupa: ['roupinha', 'Bebê *perde o tamanho em poucas semanas*. Achado bom é o que deixa trocar sem dó.', 'confere a tabela'],
  fralda: ['fralda', 'Fralda e lenço *acabam na pior hora*. Preço bom no pacote faz diferença no mês.', 'confere o tamanho'],
  higiene: ['higiene', 'Coisa de higiene que *a gente usa todo dia*. Vale ter uma de reserva.', 'confere a idade indicada'],
  enxoval: ['enxoval', 'Item de enxoval que *você usa de verdade*, sem gastar muito.', 'lava antes de usar'],
  alimentacao: ['papinha', 'Pra hora da papinha *ficar mais fácil* (e a bagunça, menor).', 'a bagunça faz parte'],
  utilidades: ['casa', 'Coisinha pequena que *deixa a rotina mais leve*.', 'achado do grupo'],
};
const PADRAO = ['achado', 'Coisa que *faz falta no dia a dia* com bebê, por um preço que cabe no mês.', 'achado do grupo'];

export function usoDe(oferta) {
  const r = USOS.find(([re]) => re.test(oferta.nome || ''));
  const [palavra, texto, nota] = r ? r.slice(1) : POR_CATEGORIA[oferta.categoria] || PADRAO;
  return { palavra, texto, nota };
}

const doAno = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  return Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
};
const teto = (ofertas) => Math.ceil(Math.max(...ofertas.map((o) => o.preco)) / 5) * 5;

/** Gancho da capa: frase verdadeira com o teto real dos preços (nada de "o que mais vende" sem dado). */
function capaTexto(ofertas, dia, turno) {
  const n = ofertas.length, r = `R$ ${teto(ofertas)}`;
  const opcoes = turno === '20h'
    ? [['anota aí:', `${n} achados de bebê que cabem no mês`, `tudo até ${r}, e o que cada um resolve`],
      ['achados de hoje:', `o que eu colocaria na lista do bebê`, `${n} coisas até ${r}`],
      ['pra lista:', `${n} coisas pequenas que fazem falta todo dia`, `até ${r} cada, sem enrolação`]]
    : [['achados de hoje:', `${n} coisas pro bebê, tudo até ${r}`, 'e o que cada uma resolve'],
      ['anota aí:', `o que resolve o dia com bebê e custa até ${r}`, `${n} achados, sem enrolação`],
      ['pra lista:', `achei ${n} coisas boas até ${r}`, 'arrasta pra ver pra que serve cada uma']];
  const [kicker, gancho, sub] = opcoes[doAno(dia) % opcoes.length];
  return { kicker, gancho, sub };
}

const ENVIOS = [
  ['Manda pra uma amiga que tá montando o enxoval.', 'Ela vai lembrar de você.'],
  ['Manda pra amiga que tá esperando bebê.', 'Ela vai agradecer na primeira semana.'],
  ['Manda pra quem vive dizendo que bebê é caro.', 'Dá pra gastar menos com o que faz falta.'],
];

/** Fotos CC0 de gente (capa e fecho), diferentes entre si e das do carrossel de dicas do mesmo dia. */
async function fotosDeGente(dia, turno) {
  const { fotos } = JSON.parse(await readFile(path.join(PASTA_FUNDOS, 'tags.json'), 'utf8'));
  // bebê dormindo fica fora (mesmo seguro, deita de lado em tapete parece contrariar a SBP na miniatura)
  const boas = fotos.filter((f) => f.sonoSeguro !== false && !f.evitar && f.luz !== 'noite' && !(f.assunto || []).some((a) => ['sono', 'berco', 'madrugada', 'descanso'].includes(a)));
  const k = doAno(dia) * 3 + (turno === '20h' ? 2 : 1);
  const capa = boas[k % boas.length];
  const fecho = boas.filter((f) => f !== capa)[(k + 7) % (boas.length - 1)];
  const embutir = async (f) => ({ url: `data:image/jpeg;base64,${(await readFile(path.join(PASTA_FUNDOS, f.arquivo))).toString('base64')}`, foco: f.foco || '50% 40%' });
  return { capa: await embutir(capa), fecho: await embutir(fecho) };
}

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a URL da foto vai crua (data: URL); o resto escapado. CSS e JS entram inline (setContent não lê arquivo relativo).
const preencher = (html, dados, css, js) => html
  .replace('<link rel="stylesheet" href="{{BASE}}achados.css">', `<style>${css}</style>`)
  .replace('<script src="{{BASE}}achados.js"></script>', `<script>${js}</script>`)
  .replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k) => (k in dados ? (/^FOTO(_CAPA|_FECHO)?$/.test(k) ? dados[k] : esc(dados[k])) : m));

/**
 * Gera as imagens (feed + story) na pasta. Devolve { slides: [{feed, story}], titulo, legenda }.
 * Se a foto ou o texto de um produto não passar no QA, lança ProdutoRuim(item_id) pro job trocar o produto.
 */
export async function gerarAchados(ofertas, { dia, turno, pasta }) {
  await mkdir(pasta, { recursive: true });
  const [css, js, ...tpls] = await Promise.all(['achados.css', 'achados.js', 'capa.html', 'produto.html', 'fecho.html'].map((a) => readFile(path.join(PASTA, a), 'utf8')));
  const [tCapa, tProduto, tFecho] = tpls;
  const usos = ofertas.map(usoDe);
  const postit = Object.fromEntries([0, 1, 2].map((i) => [`POSTIT_${i + 1}`, usos[i]?.palavra || '']));
  const comum = { SEMENTE: `achados-${dia}-${turno}`, PERFIL, DE: String(ofertas.length), ...postit };
  const total = ofertas.length + 2;
  const capa = capaTexto(ofertas, dia, turno);
  const gente = await fotosDeGente(dia, turno);
  const fotos = await Promise.all(ofertas.map((o) => fotoEmbutida(o.imagem)));
  const [envio, porque] = ENVIOS[doAno(dia) % ENVIOS.length];

  const paginas = [
    { tpl: tCapa, dados: { FOTO_CAPA: gente.capa.url, FOTO_FOCO: gente.capa.foco, KICKER: capa.kicker, GANCHO: capa.gancho, SUB: capa.sub } },
    ...ofertas.map((o, i) => ({ tpl: tProduto, item: o.item_id, dados: {
      N: String(i + 1), ATUAL: String(i + 1), LADO: i % 2 ? 'dir' : 'esq', PAGINA: `${i + 2}/${total}`,
      NOME: nomeCurto(o.nome, 34), FOTO: fotos[i], FOTO_MODO: 'polaroid', FOTO_CORTE: '', MIRA: '',
      TEXTO: usos[i].texto, NOTA: usos[i].nota, PRECO: `R$ ${brl(o.preco)}`,
    } })),
    { tpl: tFecho, dados: { PAGINA: `${total}/${total}`, FOTO_FECHO: gente.fecho.url, FOTO_FOCO: gente.fecho.foco, ENVIO: envio, PORQUE: porque,
      GRUPO: 'Todo dia tem achado assim no *grupo grátis* do WhatsApp.', RODAPE: 'grátis · sem spam · #publi' } },
  ];

  const nav = await (await chromium()).launch();
  const pagina = await nav.newPage({ deviceScaleFactor: 1 });
  const slides = [];
  try {
    for (const [k, p] of paginas.entries()) {
      const slide = {};
      for (const formato of ['feed', 'story']) {
        const t = TAMANHOS[formato];
        await pagina.setViewportSize({ width: t.w, height: t.h });
        await pagina.setContent(preencher(p.tpl, { ...comum, ...p.dados, FORMATO: formato }, css, js), { waitUntil: 'networkidle' });
        await pagina.waitForFunction(() => window.__PRONTO === true, null, { timeout: 20000 });
        const { erros } = await pagina.evaluate(() => window.__QA);
        if (erros.length) {
          const msg = `slide ${k + 1} (${formato}) reprovou: ${erros.join(' | ')}`;
          throw p.item ? new ProdutoRuim(p.item, msg) : new Error(msg);
        }
        slide[formato] = path.join(pasta, `${String(k + 1).padStart(2, '0')}-${formato}.jpg`);
        await pagina.screenshot({ path: slide[formato], type: 'jpeg', quality: 90 });
      }
      slides.push(slide);
    }
  } finally {
    await nav.close();
  }

  const titulo = `${capa.kicker} ${capa.gancho}`;
  return { slides, titulo, legenda: legenda(ofertas, usos, capa) };
}

// o Instagram aceita no maximo 5 hashtags por post (desde dez/2025)
const HASHTAGS = '#achadinhos #achadosshopee #enxovaldebebe #maternidade #bebe';

/** #publi na frente (regra do CONAR), o que cada um resolve, o envio e o grupo pela bio. */
function legenda(ofertas, usos, capa) {
  const limpo = (t) => t.replace(/\*/g, '');
  return [
    '#publi · links de afiliado',
    '',
    `${capa.gancho.charAt(0).toUpperCase()}${capa.gancho.slice(1)} 👇`,
    '',
    ...ofertas.map((o, i) => `${i + 1}. ${nomeCurto(o.nome, 40)} (R$ ${brl(o.preco)}): ${limpo(usos[i].texto)}`),
    '',
    'Qual desses faz mais falta aí na sua casa?',
    'Manda pra uma amiga que tá montando o enxoval 💛',
    '👉 Os links ficam no nosso grupo grátis do WhatsApp. Link na bio!',
    'Preço da Shopee muda rápido.',
    '',
    HASHTAGS,
  ].join('\n');
}

// Escolhe a proxima oferta pensando no grupo, nao so na comissao:
// alterna categoria, respeita o peso de cada assunto e puxa roupa e fralda pra noite.

const NOITE_A_PARTIR_DAS = 18;
const CATEGORIAS_NOITE = ['roupa', 'fralda'];

/** Todas as buscas, na ordem das categorias. */
export const todasKeywords = (cfg) => Object.values(cfg.categorias).flat();

export function categoriaDe(cfg, keyword) {
  for (const [categoria, keywords] of Object.entries(cfg.categorias)) {
    if (keywords.includes(keyword)) return categoria;
  }
  return 'geral';
}

/** Data e hora de Brasilia, que e o que importa pro grupo. */
export function agoraBrasilia(data = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(data).map((p) => [p.type, p.value])
  );

  return {
    dia: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
  };
}

export function campanhaAtiva(cfg, agora = agoraBrasilia()) {
  const c = cfg.campanha;
  if (!c) return null;
  return agora.dia >= c.inicio && agora.dia <= c.fim ? c : null;
}

/** Peso de "a mae clica": desconto e vendas pesam tanto quanto a comissao. */
export function pontuar(oferta) {
  const nota = oferta.nota ? Math.max(0, oferta.nota - 4.6) * 5 : 0;
  return (
    Number(oferta.comissao || 0) * 50 +
    Number(oferta.desconto || 0) / 5 +
    Math.min(Number(oferta.vendas || 0), 5000) / 1000 +
    nota
  );
}

// quantos posts pra tras contam na hora de ver qual categoria esta "devendo"
const JANELA_DA_PROPORCAO = 30;

/** Peso da categoria agora: o do cockpit (pesoCategoria), com um empurrao pra roupa e fralda a noite. */
function pesoAgora(cfg, categoria, noite) {
  let peso = cfg.pesoCategoria?.[categoria] ?? 1;
  if (noite && CATEGORIAS_NOITE.includes(categoria)) peso *= 1.5;
  return peso;
}

/**
 * Ordena as candidatas para esta rodada.
 * recentes: categorias das ultimas ofertas enviadas, mais nova primeiro.
 *
 * 1o escolhe a CATEGORIA, depois a melhor oferta dentro dela. Antes era tudo numa nota so e o peso
 * nao vencia a comissao: fralda (2-3% de comissao) saiu 1 vez em ~100 posts com peso 3.
 * Agora cada categoria recebe a fatia do peso dela: com roupa 3, fralda 3, higiene 3, enxoval 2 e
 * alimentacao 2, fralda fica com 3/13 dos posts. Vai a que mais esta "devendo" nos ultimos 30 posts.
 */
export function escolher(cfg, candidatas, recentes, quantidade, agora = agoraBrasilia()) {
  const noite = agora.hora >= NOITE_A_PARTIR_DAS;
  const ultimas = [...recentes];
  const escolhidas = [];
  const restantes = [...candidatas];

  while (escolhidas.length < quantidade && restantes.length > 0) {
    const porCategoria = new Map();
    for (const oferta of restantes) {
      const categoria = categoriaDe(cfg, oferta.keyword);
      if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
      porCategoria.get(categoria).push(oferta);
    }

    // mesma categoria das 2 ultimas fica de fora, a nao ser que seja o que sobrou
    const bloqueadas = new Set(ultimas.slice(0, 2));
    let disponiveis = [...porCategoria.keys()].filter((c) => !bloqueadas.has(c));
    if (disponiveis.length === 0) disponiveis = [...porCategoria.keys()];

    // so as categorias com oferta na fila dividem os posts
    const pesos = new Map(disponiveis.map((c) => [c, pesoAgora(cfg, c, noite)]));
    const total = [...pesos.values()].reduce((s, p) => s + p, 0);
    const janela = ultimas.slice(0, JANELA_DA_PROPORCAO);
    const deve = (c) => (pesos.get(c) / total) * (janela.length + 1) - janela.filter((x) => x === c).length;

    const categoria = disponiveis.sort((a, b) => deve(b) - deve(a) || pesos.get(b) - pesos.get(a))[0];
    const melhor = porCategoria.get(categoria).sort((a, b) => pontuar(b) - pontuar(a))[0];

    escolhidas.push(melhor);
    ultimas.unshift(categoria);
    restantes.splice(restantes.indexOf(melhor), 1);
  }

  return escolhidas;
}

/**
 * Limites da coleta para a busca: os gerais com os da categoria por cima (config.filtrosPorCategoria).
 * O "exigir" SOMA: o geral (ser de bebe/crianca) vale sempre, o da categoria vem junto.
 * Se substituisse, "chupeta" so exigiria a palavra chupeta e o cabo de chupeta de bateria passaria.
 */
export function filtrosDe(cfg, keyword) {
  const daCategoria = cfg.filtrosPorCategoria?.[categoriaDe(cfg, keyword)] || {};
  return { ...cfg.filtros, ...daCategoria, exigir: [...(cfg.filtros?.exigir || []), ...(daCategoria.exigir || [])] };
}

// palavras que nao ajudam a dizer se dois anuncios sao o mesmo produto
const VAZIAS = new Set(['para', 'com', 'sem', 'kit', 'pecas', 'peca', 'unidades', 'unidade', 'und', 'pcs', 'pct', 'pacote',
  'bebe', 'bebes', 'infantil', 'infantis', 'crianca', 'criancas', 'menino', 'menina', 'unissex', 'baby', 'novo', 'nova',
  'promocao', 'oferta', 'original', 'qualidade', 'premium', 'envio', 'imediato', 'pronta', 'entrega', 'atacado', 'cores', 'cor']);

const simples = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Palavras que identificam o produto (sem numero, medida e palavra vazia). */
export function assinatura(nome) {
  return new Set(
    simples(nome)
      .split(/[^a-z]+/)
      .filter((p) => p.length >= 3 && !VAZIAS.has(p))
      .slice(0, 8)
  );
}

/**
 * Dois anuncios sao "o mesmo produto" quando a maior parte das palavras do menor aparece no outro.
 * Pega "20 Protetor de Silicone de Mesa Quina" x "Kit 12 Protetor Quina de Mesa em Silicone".
 */
export function parecidos(a, b) {
  if (!a.size || !b.size) return false;
  let comuns = 0;
  for (const p of a) if (b.has(p)) comuns++;
  return comuns / Math.min(a.size, b.size) >= 0.6;
}

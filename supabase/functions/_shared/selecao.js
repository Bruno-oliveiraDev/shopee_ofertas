// Escolhe a proxima oferta pensando no grupo, nao so na comissao:
// alterna categoria, respeita o peso de cada assunto e puxa roupa e fralda pra noite.

const NOITE_A_PARTIR_DAS = 18;
const CATEGORIAS_NOITE = ['roupa', 'fralda'];
const CATEGORIAS_DIA = ['fralda', 'higiene', 'alimentacao', 'seguranca'];

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

/**
 * Ordena as candidatas para esta rodada.
 * recentes: categorias das ultimas ofertas enviadas, mais nova primeiro.
 */
export function escolher(cfg, candidatas, recentes, quantidade, agora = agoraBrasilia()) {
  const noite = agora.hora >= NOITE_A_PARTIR_DAS;
  const ultimas = [...recentes];
  const escolhidas = [];
  const restantes = [...candidatas];

  while (escolhidas.length < quantidade && restantes.length > 0) {
    const bloqueadas = new Set(ultimas.slice(0, 2));

    const comNota = restantes.map((oferta) => {
      const categoria = categoriaDe(cfg, oferta.keyword);
      let nota = pontuar(oferta);

      if (noite && CATEGORIAS_NOITE.includes(categoria)) nota += 4;
      if (!noite && CATEGORIAS_DIA.includes(categoria)) nota += 2;
      // peso do assunto (config.pesoCategoria): o que o grupo quer ver mais vem mais vezes.
      // Com o bloqueio das 2 ultimas, peso alto em roupa e fralda faz 2 de cada 3 posts serem delas.
      nota += ((cfg.pesoCategoria?.[categoria] ?? 1) - 1) * 3;
      // mesma categoria das 2 ultimas cai bastante, mas nao some se for o que sobrou
      if (bloqueadas.has(categoria)) nota -= 100;

      return { oferta, categoria, nota };
    });

    comNota.sort((a, b) => b.nota - a.nota);
    const melhor = comNota[0];

    escolhidas.push(melhor.oferta);
    ultimas.unshift(melhor.categoria);
    restantes.splice(restantes.indexOf(melhor.oferta), 1);
  }

  return escolhidas;
}

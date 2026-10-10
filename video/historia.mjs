// Historinha do carrossel: em vez de "3 produtos baratos", uma pequena historia da rotina com bebe
// que a pessoa reconhece e quer arrastar pra ver o fim. Sem IA e sem custo: roteiros fixos que se revezam.
//
// Cada historia tem:
//   gancho  -> capa (a frase que faz parar de rolar; abre um "e ai?")
//   sub     -> linha pequena da capa que puxa pro lado
//   passo   -> frase de cima de cada produto (i = 0, 1, 2), costura a cena do produto na historia
//   fecho   -> ultima imagem, antes do convite pro grupo (2 linhas)
//   fala    -> versao falada do gancho e do fecho (story animado)
// A cena de cada produto vem da categoria dele (CENAS): o objeto da rotina, sempre com artigo ("o body...", "a fralda...").
//
// Regra: nada de numero inventado, depoimento ou promessa de saude. E a voz de uma mae contando a rotina.

export const CENAS = {
  roupa: ['o body que já não fecha mais', 'a roupinha que dura um mês', 'o pijama que ficou pequeno do nada'],
  fralda: ['a fralda que acaba na pior hora', 'o pacote de fralda que some em dias'],
  higiene: ['o kit do banho que vive acabando', 'o lencinho que acaba sem a gente ver'],
  enxoval: ['a toalha de capuz que todo mundo esquece', 'a manta que vai pra todo lado'],
  alimentacao: ['a mamadeira das 3 da manhã', 'o pratinho da papinha (e da bagunça)'],
  utilidades: ['aquela coisinha que salva a madrugada', 'o detalhe que deixa a rotina mais leve'],
  geral: ['aquilo que faz falta todo dia'],
};

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** Junta a preposicao com o artigo da cena: com('de', 'o body') -> 'do body'; com('em', 'a fralda') -> 'na fralda'. */
function com(prep, cena) {
  const tabela = {
    de: { o: 'do', a: 'da', os: 'dos', as: 'das', aquela: 'daquela', aquilo: 'daquilo' },
    em: { o: 'no', a: 'na', os: 'nos', as: 'nas', aquela: 'naquela', aquilo: 'naquilo' },
    pra: { o: 'pro', a: 'pra', os: 'pros', as: 'pras', aquela: 'pra aquela', aquilo: 'pra aquilo' },
  }[prep];
  const [primeira, ...resto] = cena.split(' ');
  return tabela[primeira] ? [tabela[primeira], ...resto].join(' ') : `${prep} ${cena}`;
}

export const HISTORIAS = [
  {
    id: 'enxoval-caro',
    gancho: 'Achei que ia ser caro montar o enxoval…',
    sub: 'até que eu descobri isso',
    passo: (cena, i) => [`Primeiro foi ${cena}…`, `Depois, ${cena}…`, `E até ${cena}…`][i],
    fecho: ['Hoje eu não pago', 'mais preço cheio'],
    fala: { gancho: 'Eu achei que ia ser caro montar o enxoval. Até que eu descobri isso.', fecho: 'Hoje eu não pago mais preço cheio.' },
  },
  {
    id: 'cresce-rapido',
    gancho: 'Ninguém me avisou que bebê cresce TÃO rápido',
    sub: 'e o bolso não acompanha',
    passo: (cena, i) => [`Primeiro: ${cena}`, `Depois: ${cena}`, `E ainda: ${cena}`][i],
    fecho: ['Criança cresce rápido demais', 'pra gente pagar preço cheio'],
    fala: { gancho: 'Ninguém me avisou que bebê cresce tão rápido. E o bolso não acompanha.', fecho: 'Criança cresce rápido demais pra gente pagar preço cheio.' },
  },
  {
    id: 'madrugada',
    gancho: '3 da manhã, bebê chorando e você percebe que…',
    sub: 'faltou justo aquilo',
    passo: (cena, i) => [`Foi aí que eu lembrei ${com('de', cena)}`, `E ${com('de', cena)}`, `E ${com('de', cena)}`][i],
    fecho: ['A madrugada já é difícil.', 'O resto dá pra resolver barato'],
    fala: { gancho: 'Três da manhã, bebê chorando, e você percebe que faltou justo aquilo.', fecho: 'A madrugada já é difícil. O resto dá pra resolver barato.' },
  },
  {
    id: 'lista-cha',
    gancho: 'O que ninguém coloca na lista do chá de bebê',
    sub: 'mas você vai usar todo dia',
    passo: (cena, i) => `${i + 1}. ${cap(cena)}`,
    fecho: ['Salva esse post', 'pra não esquecer'],
    fala: { gancho: 'O que ninguém coloca na lista do chá de bebê, mas você vai usar todo dia.', fecho: 'Salva esse post pra não esquecer.' },
  },
  {
    id: 'primeira-vez',
    gancho: 'O erro que eu cometi no primeiro enxoval',
    sub: 'paguei tudo no preço cheio',
    passo: (cena, i) => [`Paguei cheio ${com('em', cena)}…`, `…${com('em', cena)}…`, `…e até ${com('em', cena)}`][i],
    fecho: ['Aprendi do jeito difícil.', 'Você não precisa'],
    fala: { gancho: 'O erro que eu cometi no primeiro enxoval: paguei tudo no preço cheio.', fecho: 'Aprendi do jeito difícil. Você não precisa.' },
  },
  {
    id: 'respiro',
    gancho: 'Mãe também merece um respiro no bolso',
    sub: '3 achados que cabem no mês',
    passo: (cena, i) => [cap(com('pra', cena)), cap(com('pra', cena)), `E ${com('pra', cena)}`][i],
    fecho: ['Cuidar do bebê', 'sem apertar o mês'],
    fala: { gancho: 'Mãe também merece um respiro no bolso. Olha esses três achados.', fecho: 'Cuidar do bebê, sem apertar o mês.' },
  },
];

/** Historia do dia: reveza pelo dia do ano e pelo turno, pra nao repetir no mesmo dia nem em dias seguidos. */
export function historiaDoDia(dia, turno) {
  const d = new Date(`${dia}T12:00:00Z`);
  const doAno = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
  return HISTORIAS[(doAno * 2 + (turno === '20h' ? 1 : 0)) % HISTORIAS.length];
}

// cena certeira pelo NOME do produto (vale mais que a categoria: "kit talheres" e alimentacao mas nao e mamadeira)
const PELO_NOME = [
  [/\bbody\b|bodies/i, 'o body que já não fecha mais'],
  [/pijama|macac[aã]o/i, 'o pijama que ficou pequeno do nada'],
  [/toalha/i, 'a toalha de capuz que todo mundo esquece'],
  [/manta|cueiro/i, 'a manta que vai pra todo lado'],
  [/mamadeira/i, 'a mamadeira das 3 da manhã'],
  [/prato|talher|babador|colher|papinha|refei[cç][aã]o|copo/i, 'o pratinho da papinha (e da bagunça)'],
  [/len[cç]o|lencinho/i, 'o lencinho que acaba sem a gente ver'],
  [/shampoo|sabonete|banho|pomada/i, 'o kit do banho que vive acabando'],
  [/^(?!.*(toalha|pano)).*fralda/i, 'a fralda que acaba na pior hora'],
  [/chupeta/i, 'a chupeta que some quando mais precisa'],
  [/meia/i, 'a meinha que some na máquina de lavar'],
];

/** Cena de cada produto: pelo nome quando der, senao pela categoria; nunca repete a mesma frase no carrossel. */
export function cenas(ofertas) {
  const usadas = new Set();
  return ofertas.map((o) => {
    const opcoes = [...PELO_NOME.filter(([re]) => re.test(o.nome || '')).map(([, c]) => c), ...(CENAS[o.categoria] || []), ...CENAS.geral];
    const cena = opcoes.find((c) => !usadas.has(c)) || opcoes[0];
    usadas.add(cena);
    return cena;
  });
}

/** Frase de cima de cada produto, ja com a cena costurada. */
export function passos(historia, ofertas) {
  return cenas(ofertas).map((cena, i) => historia.passo(cena, i));
}

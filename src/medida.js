// Le do nome do produto quanto vem na embalagem, pra mostrar o preco por grama, ml ou unidade.
// Na duvida nao mostra nada: preco por unidade errado tira credibilidade do grupo.

const NUM = '(\\d+(?:[.,]\\d+)?)';

// Grama e ml so fazem sentido em produto que se gasta (pomada, lenco, shampoo).
// Mamadeira de 240ml ou banheira de 30 litros falam de tamanho, nao de quantidade.
const CONSUMIVEL =
  /\b(pomadas?|cremes?|shampoos?|sabonetes?|condicionador|oleos?|hidratantes?|locao|locoes|colonias?|talcos?|lencos?|fraldas?|leite|papinhas?|pasta|gel|repelentes?|protetor solar|algodao|cotonetes?|hastes)\b/i;

const PESO = [
  { re: new RegExp(`${NUM}\\s*(kg|quilos?)\\b`, 'gi'), fator: 1000 },
  { re: new RegExp(`${NUM}\\s*(g|gr|grs|gramas?)\\b`, 'gi'), fator: 1 },
];

const VOLUME = [
  { re: new RegExp(`${NUM}\\s*(l|lt|litros?)\\b`, 'gi'), fator: 1000 },
  { re: new RegExp(`${NUM}\\s*(ml)\\b`, 'gi'), fator: 1 },
];

const UNIDADES = /(\d+)\s*(unidades|unidade|unids?|unds?|un|pcs|pecas|pares|par)\b/gi;
const KIT = /\b(?:kit|pacote|caixa|combo|cx)\s*(?:com|c\/)?\s*(\d+)\b/gi;

// '8 e 6 Pecas', '10/20/30 un': o anuncio tem variacoes e o preco mostrado e o da mais barata
const VARIACOES = /\d+\s*(?:\/|\be\b|\bou\b)\s*\d+/i;

const numero = (texto) => parseFloat(texto.replace(',', '.'));

/** Todas as quantidades encontradas, ja na unidade base (g ou ml). Repetidas contam uma vez. */
function achar(nome, regras) {
  const valores = new Set();
  for (const { re, fator } of regras) {
    for (const m of nome.matchAll(re)) valores.add(numero(m[1]) * fator);
  }
  return [...valores].filter((v) => v > 0);
}

function inteiros(nome, re) {
  const valores = new Set();
  for (const m of nome.matchAll(re)) valores.add(Number(m[1]));
  return [...valores].filter((v) => v > 1 && v <= 1000);
}

/**
 * Devolve { total, rotulo } ou null.
 * "Kit 3 Pomadas 30g" vira 90 gramas; "Lenco 50 unidades kit com 4" vira 200 unidades.
 * Nome com duas medidas diferentes ("150ml e 250ml") e ambiguo, entao nao mostra.
 */
export function medidaDoProduto(nome, { aceitaUnidade = true } = {}) {
  // sem acento: o \b do JavaScript nao reconhece "ó" ou "ç" como letra
  const texto = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (VARIACOES.test(texto)) return null;

  const kits = inteiros(texto, KIT);
  if (kits.length > 1) return null;
  const multiplicador = kits[0] || 1;

  if (CONSUMIVEL.test(texto)) {
    const gramas = achar(texto, PESO);
    const ml = achar(texto, VOLUME);

    if (gramas.length === 1 && ml.length === 0) return { total: gramas[0] * multiplicador, rotulo: 'Grama' };
    if (ml.length === 1 && gramas.length === 0) return { total: ml[0] * multiplicador, rotulo: 'ml' };
    if (gramas.length + ml.length > 0) return null;
  }

  if (!aceitaUnidade) return null;

  const unidades = inteiros(texto, UNIDADES);
  if (unidades.length > 1) return null;
  // 'Kit 4 Pecas' fala da mesma coisa duas vezes, nao e 4 x 4
  if (unidades.length === 1) {
    const repetido = unidades[0] === multiplicador;
    return { total: repetido ? unidades[0] : unidades[0] * multiplicador, rotulo: 'Unidade' };
  }
  if (kits.length === 1) return { total: kits[0], rotulo: 'Unidade' };

  return null;
}

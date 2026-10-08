// Roteiro do video e texto do post, so com os dados da oferta (sem IA, sem custo).
// Cada cena tem: fala (o que a narracao diz) + o que aparece na tela (titulo, preco ou rodape).

const brl = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 11,99" pra tela e "11 reais e 99" pra fala (o Piper le melhor assim). */
function falaDoPreco(v) {
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  return centavos ? `${reais} reais e ${centavos}` : `${reais} reais`;
}

// palavra de anuncio que nao diz nada do produto
const ENCHIMENTO = /(?<![a-zà-ú])(promo[cç][aã]o|oferta|premium|original|envio (imediato|r[aá]pido|sortido)|pronta entrega|sortido|sortida|lan[cç]amento|atacado|barato|top|novo|nova)(?![a-zà-ú])/gi;

const LIGACOES = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'para', 'p', 'em', 'ou', 'a', 'o', 'no', 'na']);

/**
 * Nome curto e limpo: sem medidas, codigos e numeros soltos (o nome da Shopee e enorme).
 * "Kit de 4, 2 e 1 Conjunto Infantil Pijama..." -> "Kit Conjunto Infantil Pijama Manga Longa"
 * (antes sobrava "Kit de , e Conjunto", que saiu na tela e na voz).
 */
export function nomeCurto(nome, maxCaracteres = 44) {
  let limpo = String(nome)
    .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
    .replace(/(\bde\s+)?\d+(\s*[,/x]\s*\d+)*(\s*(e|ou)\s*\d+)?\s*(cm|mm|m|ml|l|g|kg|pçs|pcs|peças|pecas|pç|un|und|unid|unidades|meses|anos)?(?![a-zà-ú])/gi, ' ')
    .replace(ENCHIMENTO, ' ')
    .replace(/[-–|+/,;:.!*%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // nome TODO EM MAIUSCULA vira normal
  const letras = limpo.replace(/[^A-Za-zÀ-ú]/g, '');
  if (letras && letras === letras.toUpperCase()) limpo = limpo.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  // tira ligacao repetida ("de e") e corta sem estourar o tamanho
  const palavras = [];
  for (const p of limpo.split(' ')) {
    if (LIGACOES.has(p.toLowerCase()) && (!palavras.length || LIGACOES.has(palavras.at(-1).toLowerCase()))) continue;
    if ([...palavras, p].join(' ').length > maxCaracteres) break;
    palavras.push(p);
  }
  // nao termina em "de", "com", "para"...
  // nem em ligacao ("de", "com") nem em tamanho solto ("RN P M G")
  while (palavras.length > 2 && (LIGACOES.has(palavras.at(-1).toLowerCase()) || palavras.at(-1).length <= 2)) palavras.pop();
  return palavras.join(' ');
}

// ganchos por categoria; a escolha e fixa por produto (mesmo produto = mesmo gancho)
const GANCHOS = {
  roupa: [['Roupinha de bebê nesse preço?', 'Roupinha de bebê nesse preço? Olha isso!'], ['Achei a roupinha mais barata', 'Mãe, achei a roupinha mais barata da Shopee!']],
  fralda: [['Fralda com desconto de verdade', 'Fralda com desconto de verdade, olha só!'], ['Para de pagar caro em fralda', 'Para de pagar caro em fralda!']],
  higiene: [['Achado de higiene do bebê', 'Olha esse achado pra higiene do bebê!']],
  alimentacao: [['Achado pra hora da papinha', 'Achado pra hora da papinha!']],
  brinquedo: [['Brinquedo que vale cada centavo', 'Esse brinquedo vale cada centavo!'], ['Presente bom e barato', 'Procurando presente bom e barato? Olha esse!']],
  brinquedo_bebe: [['Brinquedo pro bebê', 'Olha esse brinquedo pro bebê!']],
  seguranca: [['Casa segura pro bebê', 'Deixa a casa segura pro bebê gastando pouco!']],
  geral: [['Olha esse achado', 'Mãe, olha esse achado da Shopee!']],
};

export function roteiro(oferta) {
  const opcoes = GANCHOS[oferta.categoria] || GANCHOS.geral;
  const [ganchoTela, ganchoFala] = opcoes[Number(String(oferta.item_id).slice(-2)) % opcoes.length];
  const nome = nomeCurto(oferta.nome);
  const temDe = oferta.preco_de && oferta.preco_de > oferta.preco;

  const cenas = [
    { titulo: ganchoTela, fala: ganchoFala },
    { titulo: nome, fala: nome + '.' },
  ];

  if (temDe) {
    cenas.push({
      titulo: `${oferta.desconto}% OFF`,
      preco: { de: `R$ ${brl(oferta.preco_de)}`, por: `R$ ${brl(oferta.preco)}` },
      fala: `De ${falaDoPreco(oferta.preco_de)}, por só ${falaDoPreco(oferta.preco)}. São ${oferta.desconto} por cento de desconto!`,
    });
  } else {
    cenas.push({ titulo: 'Preço de achado', preco: { de: '', por: `R$ ${brl(oferta.preco)}` }, fala: `Só ${falaDoPreco(oferta.preco)}!` });
  }

  if (oferta.nota) {
    cenas.push({
      titulo: `Nota ${String(oferta.nota).replace('.', ',')} na Shopee`,
      rodape: `+${Number(oferta.vendas).toLocaleString('pt-BR')} vendidos`,
      fala: `Nota ${String(oferta.nota).replace('.', ',')}, com mais de ${oferta.vendas} vendidos.`,
    });
  }

  cenas.push({ titulo: 'Link na bio', rodape: 'Entra no grupo e pega o link', fala: 'O link tá no nosso grupo de achadinhos. Entra pelo link da bio!' });
  return cenas;
}

const HASHTAGS = {
  roupa: '#roupinhadebebe #enxovaldebebe #modainfantil',
  fralda: '#fralda #maternidade #maedeprimeiraviagem',
  higiene: '#bebe #maternidade #dicasdemae',
  alimentacao: '#introducaoalimentar #bebe #maternidade',
  brinquedo: '#brinquedos #presenteinfantil #diadascriancas',
  brinquedo_bebe: '#brinquedosdebebe #desenvolvimentoinfantil #bebe',
  seguranca: '#segurancainfantil #bebe #maternidade',
};

/** Legenda pronta pra colar no Reels/TikTok/Shorts. */
export function textoDoPost(oferta) {
  const temDe = oferta.preco_de && oferta.preco_de > oferta.preco;
  return [
    `${nomeCurto(oferta.nome)} 👶`,
    '',
    temDe ? `❌ De R$ ${brl(oferta.preco_de)}\n🔥 A partir de R$ ${brl(oferta.preco)} (-${oferta.desconto}%)` : `🔥 A partir de R$ ${brl(oferta.preco)}`,
    oferta.nota ? `⭐ ${String(oferta.nota).replace('.', ',')} · +${Number(oferta.vendas).toLocaleString('pt-BR')} vendidos` : '',
    '',
    '👉 O link tá no grupo Achadinhos Kids: entra pelo link da bio!',
    'Preço da Shopee muda rápido, corre.',
    '',
    `${HASHTAGS[oferta.categoria] || '#achadinhos'} #achadinhos #shopee #achadosshopee`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
}

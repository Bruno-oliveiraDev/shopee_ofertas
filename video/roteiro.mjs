// Roteiro do video e texto do post, so com os dados da oferta (sem IA, sem custo).
// Cada cena tem: fala (o que a narracao diz) + o que aparece na tela (titulo, preco ou rodape).

const brl = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 11,99" pra tela e "11 reais e 99" pra fala (o Piper le melhor assim). */
function falaDoPreco(v) {
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);
  return centavos ? `${reais} reais e ${centavos}` : `${reais} reais`;
}

/** Nome curto e limpo: sem medidas, codigos e repeticao de palavra-chave (o nome da Shopee e enorme). */
export function nomeCurto(nome) {
  const limpo = String(nome)
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b\d+([.,/]\d+)*\s*(cm|mm|m|ml|g|kg|pçs|pcs|un|und|unidades)?\b/gi, ' ')
    .replace(/[-–|+/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const palavras = limpo.split(' ').slice(0, 6);
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
    temDe ? `❌ De R$ ${brl(oferta.preco_de)}\n🔥 Por R$ ${brl(oferta.preco)} (-${oferta.desconto}%)` : `🔥 Por R$ ${brl(oferta.preco)}`,
    oferta.nota ? `⭐ ${String(oferta.nota).replace('.', ',')} · +${Number(oferta.vendas).toLocaleString('pt-BR')} vendidos` : '',
    '',
    '👉 O link tá no grupo Achadinhos Kids: entra pelo link da bio!',
    'Preço da Shopee muda rápido, corre.',
    '',
    `${HASHTAGS[oferta.categoria] || '#achadinhos'} #achadinhos #shopee #achadosshopee`,
    '',
    'Link de afiliado: posso ganhar comissão, sem custo extra pra você.',
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
}

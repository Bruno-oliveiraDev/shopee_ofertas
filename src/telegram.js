import { medidaDoProduto } from './medida.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const api = (metodo) => `https://api.telegram.org/bot${TOKEN}/${metodo}`;

const escapar = (texto) =>
  String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const brl = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "(R$ 0,46 / Grama)" quando o nome diz quanto vem; vazio quando nao da pra saber. */
function precoPorMedida(oferta) {
  const medida = medidaDoProduto(oferta.nome, {
    aceitaUnidade: !CATEGORIAS_SEM_UNIDADE.includes(oferta.categoria),
  });
  if (!medida) return '';

  const valor = oferta.preco / medida.total;
  if (valor < 0.01) return '';

  return ` (R$ ${brl(valor)} / ${medida.rotulo})`;
}

// "Blocos de montar 500 pecas" a R$ 0,08 a peca nao ajuda ninguem a decidir
const CATEGORIAS_SEM_UNIDADE = ['brinquedo', 'brinquedo_bebe'];

const pct = (valor) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Modelo fixo: so os numeros mudam de uma oferta pra outra
export function montarMensagem(oferta) {
  const linhas = [`<b>${escapar(oferta.nome.slice(0, 90))}</b>`, ''];

  const temDesconto = oferta.preco_de && oferta.preco_de > oferta.preco;

  if (temDesconto) {
    linhas.push(`❌ De: R$ ${brl(oferta.preco_de)}`);
    linhas.push('');
  }

  linhas.push(`🔥 Por: R$ ${brl(oferta.preco)}${precoPorMedida(oferta)}`);

  if (temDesconto) {
    const economia = ((oferta.preco_de - oferta.preco) / oferta.preco_de) * 100;
    linhas.push(`✅ Economize: ${pct(economia)}%`);
  }

  if (oferta.nota) {
    linhas.push('');
    linhas.push(`⭐ ${oferta.nota} · ${oferta.vendas}+ vendidos`);
  }

  linhas.push('');
  linhas.push(`<a href="${oferta.link}">Veja mais detalhes</a>`);

  return linhas.join('\n').slice(0, 1000);
}

/** Lista da noite na campanha: varios presentes numa mensagem so. */
export function montarTopDoDia(ofertas, campanha) {
  const linhas = [
    `🎁 <b>Top ${ofertas.length} presentes de ${escapar(campanha.nome)} de hoje</b>`,
    '',
    'Ainda sem ideia de presente? Separei os achados mais bem avaliados do dia 👇',
    '',
  ];

  ofertas.forEach((o, i) => {
    const off = o.desconto > 0 ? ` (${o.desconto}% OFF)` : '';
    linhas.push(`${i + 1}. <a href="${o.link}">${escapar(o.nome.slice(0, 60))}</a>`);
    linhas.push(`    💸 R$ ${brl(o.preco)}${off}`);
  });

  return linhas.join('\n');
}

export function postarTexto(texto) {
  return enviar('sendMessage', {
    text: texto,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

async function enviar(metodo, corpo) {
  const resposta = await fetch(api(metodo), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, ...corpo }),
  });

  const dados = await resposta.json();

  if (!dados.ok) {
    throw new Error(`Telegram (${metodo}): ${dados.description}`);
  }

  return dados.result;
}

/**
 * Tenta postar com foto. Se o Telegram recusar a imagem da Shopee,
 * cai para mensagem de texto em vez de perder a oferta.
 */
export async function postarOferta(oferta) {
  const caption = montarMensagem(oferta);

  if (oferta.imagem) {
    try {
      return await enviar('sendPhoto', {
        photo: oferta.imagem,
        caption,
        parse_mode: 'HTML',
      });
    } catch (erro) {
      console.warn(`Foto recusada (${oferta.item_id}), enviando como texto. ${erro.message}`);
    }
  }

  return enviar('sendMessage', {
    text: caption,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: false },
  });
}

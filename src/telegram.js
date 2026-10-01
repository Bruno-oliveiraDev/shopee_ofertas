const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const api = (metodo) => `https://api.telegram.org/bot${TOKEN}/${metodo}`;

const escapar = (texto) =>
  String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const brl = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function montarMensagem(oferta) {
  const linhas = [];

  const nome = escapar(oferta.nome.slice(0, 90));

  // o gancho abre a mensagem como texto corrido, do jeito que uma mae escreveria pra outra
  if (oferta.gancho) {
    linhas.push(escapar(oferta.gancho));
    linhas.push('');
  }

  linhas.push(`🧸 <b>${nome}</b>`);

  const off = oferta.desconto > 0 ? ` (${oferta.desconto}% OFF)` : '';
  linhas.push(
    oferta.preco_de
      ? `💸 De <s>R$ ${brl(oferta.preco_de)}</s> por <b>R$ ${brl(oferta.preco)}</b>${off}`
      : `💸 <b>R$ ${brl(oferta.preco)}</b>`
  );

  if (oferta.nota) linhas.push(`⭐ ${oferta.nota} · ${oferta.vendas}+ vendidos`);

  linhas.push('');
  linhas.push(`👉 <a href="${oferta.link}">Quero ver na Shopee</a>`);

  return linhas.join('\n').slice(0, 1000);
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

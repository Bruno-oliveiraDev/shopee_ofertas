const API_KEY = process.env.GEMINI_API_KEY;
const MODELO = process.env.GEMINI_MODELO || 'gemini-2.5-flash';

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

const REGRAS = `Voce escreve ganchos curtos para um canal de ofertas no Telegram.

Regras:
- Uma linha por produto, no maximo 60 caracteres
- Nunca cite preco, porcentagem de desconto, nota ou quantidade vendida, porque esses dados ja aparecem na mensagem
- Nunca use travessao nem dois pontos
- Sem emoji, sem hashtag, sem aspas
- Enquadramento positivo, fale do que a pessoa ganha com o produto
- Nada de promessa exagerada, urgencia falsa ou palavra em caixa alta
- Portugues do Brasil, tom de amigo indicando um achado`;

/**
 * Gera os ganchos em uma unica chamada para o lote inteiro.
 * Se a IA falhar por qualquer motivo, devolve mapa vazio e a mensagem
 * cai no nome do produto, que e o comportamento padrao.
 */
export async function gerarGanchos(ofertas) {
  const vazio = new Map();

  if (!API_KEY || ofertas.length === 0) return vazio;

  const lista = ofertas.map((o) => ({
    id: o.item_id,
    produto: o.nome.slice(0, 120),
    loja: o.loja,
  }));

  const prompt = `${REGRAS}

Produtos:
${JSON.stringify(lista, null, 2)}

Responda apenas com um array JSON no formato [{"id": "...", "gancho": "..."}], um item para cada produto recebido.`;

  try {
    const resposta = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!resposta.ok) {
      throw new Error(`Gemini respondeu ${resposta.status}`);
    }

    const dados = await resposta.json();
    const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) throw new Error('Gemini devolveu resposta vazia');

    const itens = JSON.parse(texto);
    const mapa = new Map();

    for (const item of Array.isArray(itens) ? itens : []) {
      const gancho = limpar(item?.gancho);
      if (item?.id && gancho) mapa.set(String(item.id), gancho);
    }

    console.log(`Ganchos gerados: ${mapa.size} de ${ofertas.length}`);
    return mapa;
  } catch (erro) {
    console.warn(`IA indisponivel, usando nome do produto. ${erro.message}`);
    return vazio;
  }
}

/** Ultima barreira contra gancho fora do padrao. */
function limpar(texto) {
  if (typeof texto !== 'string') return null;

  const limpo = texto
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/["""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpo.length < 8 || limpo.length > 70) return null;

  // se escapou preco, porcentagem ou link, descarta e volta pro nome do produto
  if (/R\$|\d+\s*%|https?:\/\//i.test(limpo)) return null;

  return limpo;
}

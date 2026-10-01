const API_KEY = process.env.GEMINI_API_KEY;
const MODELO = process.env.GEMINI_MODELO || 'gemini-2.5-flash';

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

// lote pequeno cabe folgado na resposta; o lote unico de antes vinha cortado
const TAMANHO_LOTE = 20;
const ESPERAS_MS = [5000, 15000, 40000];

const REGRAS = `Voce escreve a chamada de cada produto num grupo de ofertas infantis no Telegram.
Quem le sao maes, pais, avos e quem esta montando enxoval ou procurando presente.

O tom e de uma mae animada mandando um achado pra amiga no WhatsApp. Natural, carinhoso, empolgado, nada de texto de anuncio.
Exemplos do tom (nao copie, varie sempre):
- Olhaaa que achado pra quem tem bebe pequeno! Esse aspirador limpa o narizinho rapidinho e ainda vem com estojo pra levar na bolsa
- Gente, esse kit de body e perfeito pro enxoval, tecido macio e ja vem varias cores pra trocar o dia todo
- Quem tem crianca em casa vai amar isso aqui, esses blocos de montar rendem horas de brincadeira longe da tela

Regras:
- Uma ou duas frases, entre 80 e 180 caracteres
- Diga pra que serve na rotina e o que facilita pra familia, ou como diverte a crianca, com base so no nome do produto
- Varie a abertura (Olhaaa, Gente, Mae, Achei, Que fofura, Quem tem bebe, etc), nao comece sempre igual
- Pode usar no maximo um emoji, no fim
- Nunca cite preco, desconto, nota ou quantidade vendida, porque isso ja aparece na mensagem
- Nunca prometa seguranca, beneficio para a saude, desenvolvimento ou aprendizado, nem cite pediatra ou certificacao
- Nunca indique idade, tamanho ou material que nao esteja no nome do produto
- Sem urgencia falsa (ultimas unidades, so hoje), sem hashtag, sem aspas, sem travessao, sem palavra em caixa alta
- Portugues do Brasil, linguagem do dia a dia`;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Um pedido ao Gemini para um lote. Lanca erro em qualquer falha. */
async function pedirLote(lote) {
  const lista = lote.map((o) => ({
    id: o.item_id,
    produto: o.nome.slice(0, 120),
    categoria: o.keyword,
  }));

  const prompt = `${REGRAS}

Produtos:
${JSON.stringify(lista, null, 2)}

Responda apenas com um array JSON no formato [{"id": "...", "gancho": "..."}], um item para cada produto recebido.`;

  const resposta = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Gemini respondeu ${resposta.status} usando o modelo ${MODELO}. ${detalhe.slice(0, 200)}`);
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

  return mapa;
}

/** Tenta de novo quando o Gemini esta sobrecarregado ou responde torto. */
async function pedirComRetentativa(lote) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await pedirLote(lote);
    } catch (erro) {
      if (tentativa >= ESPERAS_MS.length) throw erro;
      console.warn(`IA falhou (tentativa ${tentativa + 1}), tentando de novo. ${erro.message}`);
      await pausa(ESPERAS_MS[tentativa]);
    }
  }
}

/**
 * Gera os ganchos em lotes pequenos, com retentativa.
 * Lote que falhar de vez fica sem gancho, e o disparo tenta de novo na hora de postar.
 */
export async function gerarGanchos(ofertas) {
  const mapa = new Map();

  if (!API_KEY || ofertas.length === 0) return mapa;

  for (let i = 0; i < ofertas.length; i += TAMANHO_LOTE) {
    const lote = ofertas.slice(i, i + TAMANHO_LOTE);

    try {
      const parcial = await pedirComRetentativa(lote);
      for (const [id, gancho] of parcial) mapa.set(id, gancho);
    } catch (erro) {
      console.warn(`IA indisponivel no lote ${i / TAMANHO_LOTE + 1}, segue sem gancho. ${erro.message}`);
    }
  }

  console.log(`Ganchos gerados: ${mapa.size} de ${ofertas.length}`);
  return mapa;
}

/** Ultima barreira contra gancho fora do padrao. */
function limpar(texto) {
  if (typeof texto !== 'string') return null;

  const limpo = texto
    .replace(/[–—]/g, ' ')
    .replace(/["“”'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpo.length < 30 || limpo.length > 220) return null;

  // se escapou preco, porcentagem ou link, descarta e volta pro nome do produto
  if (/R\$|\d+\s*%|https?:\/\//i.test(limpo)) return null;

  return limpo;
}

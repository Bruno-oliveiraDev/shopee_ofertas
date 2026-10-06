import { buscarOfertas, normalizar, passaNoFiltro } from './shopee.js';
import { abastecerFila, expirarAntigas } from './db.js';
import { todasKeywords } from './selecao.js';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Busca as palavras-chave na Shopee e abastece a fila.
 * parte/de dividem a lista (parte 1 de 3 pega a 1a, 4a, 7a busca...) pra cada chamada
 * caber no tempo limite da Edge Function.
 */
export async function coletar(cfg, { parte = 1, de = 1 } = {}) {
  const log = [];
  const keywords = todasKeywords(cfg).filter((_, i) => i % de === parte - 1);
  const paginas = cfg.paginasPorBusca || 1;
  const pausaMs = cfg.pausaEntreBuscasMs ?? 1500; // respeita o rate limit da Shopee

  const candidatas = [];
  let buscas = 0;
  let falhas = 0;

  for (const keyword of keywords) {
    let retornadas = 0;
    let aprovadas = 0;

    for (let pagina = 1; pagina <= paginas; pagina++) {
      buscas++;
      try {
        const { produtos, temMais } = await buscarOfertas(cfg, keyword, pagina);
        const ok = produtos
          .map((p) => normalizar(p, keyword))
          .filter((linha) => passaNoFiltro(linha, cfg.filtros));

        retornadas += produtos.length;
        aprovadas += ok.length;
        candidatas.push(...ok);

        await pausa(pausaMs);
        if (!temMais) break;
      } catch (erro) {
        falhas++;
        log.push(`${keyword} (pagina ${pagina}): ${erro.message}`);
        await pausa(pausaMs);
        break;
      }
    }

    log.push(`${keyword}: ${retornadas} retornadas, ${aprovadas} aprovadas`);
  }

  if (buscas > 0 && falhas === buscas) {
    throw new Error('Todas as buscas falharam. Verifique credenciais e assinatura.');
  }

  // tira duplicata dentro da propria rodada antes de mandar pro banco
  const unicas = [...new Map(candidatas.map((o) => [o.item_id, o])).values()];

  const fila = await abastecerFila(unicas);
  await expirarAntigas(cfg.disparo.validadeEmDias);

  log.push(`Candidatas: ${unicas.length} | Novas: ${fila.novas} | Renovadas: ${fila.renovadas}`);

  return { parte, de, buscas: keywords.length, candidatas: unicas.length, ...fila, log };
}

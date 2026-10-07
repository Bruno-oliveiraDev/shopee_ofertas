import { buscarOfertas, normalizar, motivoReprovacao } from './shopee.js';
import { abastecerFila, expirarAntigas, registrarColetas } from './db.js';
import { todasKeywords, categoriaDe } from './selecao.js';

// fralda de marca paga 2-3% de comissao e quase nao tem desconto: com o filtro geral nao entrava nenhuma.
// config.filtrosPorCategoria troca so os limites daquela categoria, o resto vem de config.filtros.
const filtrosDe = (cfg, keyword) => ({ ...cfg.filtros, ...(cfg.filtrosPorCategoria?.[categoriaDe(cfg, keyword)] || {}) });

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
  const registro = [];
  let buscas = 0;
  let falhas = 0;

  for (const keyword of keywords) {
    const categoria = categoriaDe(cfg, keyword);
    const reprovadas = {};
    let retornadas = 0;
    let aprovadas = 0;
    let erroBusca = null;

    for (let pagina = 1; pagina <= paginas; pagina++) {
      buscas++;
      try {
        const { produtos, temMais } = await buscarOfertas(cfg, keyword, pagina);
        const ok = [];
        for (const linha of produtos.map((p) => normalizar(p, keyword))) {
          const motivo = motivoReprovacao(linha, filtrosDe(cfg, keyword));
          if (motivo) reprovadas[motivo] = (reprovadas[motivo] || 0) + 1;
          else ok.push({ ...linha, categoria });
        }

        retornadas += produtos.length;
        aprovadas += ok.length;
        candidatas.push(...ok);

        await pausa(pausaMs);
        if (!temMais) break;
      } catch (erro) {
        falhas++;
        erroBusca = erro.message;
        log.push(`${keyword} (pagina ${pagina}): ${erro.message}`);
        await pausa(pausaMs);
        break;
      }
    }

    log.push(`${keyword}: ${retornadas} retornadas, ${aprovadas} aprovadas`);
    registro.push({ keyword, categoria, retornadas, aprovadas, reprovadas, erro: erroBusca ? erroBusca.slice(0, 300) : null });
  }

  // o log da coleta nunca derruba a coleta
  await registrarColetas(registro).catch((e) => log.push(`Log da coleta falhou: ${e.message}`));

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

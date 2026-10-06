import { candidatasDaFila, ultimasEnviadas, marcarComoEnviada, marcarComoFalha } from './db.js';
import { postarOferta, postarTexto, montarMensagem, montarTopDoDia } from './telegram.js';
import { agoraBrasilia, campanhaAtiva, categoriaDe, escolher, todasKeywords } from './selecao.js';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP_DO_DIA = 5;
// duas chamadas no mesmo horario (agendador repetiu, ou alguem rodou na mao) postariam em dobro
const JANELA_SEM_REPETIR_MIN = 20;

/**
 * Posta a(s) proxima(s) oferta(s) da fila.
 * teste: escolhe e monta a mensagem, mas nao posta nem marca nada no banco.
 */
export async function disparar(cfg, { teste = false } = {}) {
  const log = [];
  const agora = agoraBrasilia();
  const campanha = campanhaAtiva(cfg, agora);
  const candidatas = await candidatasDaFila(todasKeywords(cfg));
  const base = { teste, horario: `${agora.dia} ${agora.hora}:${String(agora.minuto).padStart(2, '0')}`, fila: candidatas.length };

  if (candidatas.length === 0) {
    return { ...base, enviadas: 0, motivo: 'Fila vazia. Nada a postar nesta rodada.' };
  }

  const historico = await ultimasEnviadas();

  const ultimoEnvio = historico[0] ? new Date(historico[0].enviada_em) : null;
  if (!teste && ultimoEnvio && Date.now() - ultimoEnvio.getTime() < JANELA_SEM_REPETIR_MIN * 60 * 1000) {
    return { ...base, enviadas: 0, motivo: `Ja houve envio as ${ultimoEnvio.toISOString()}, pulando esta rodada.` };
  }

  const categoriasRecentes = historico.map((o) => categoriaDe(cfg, o.keyword));

  // Na campanha, a rodada das :05 do horario da noite vira a lista "Top 5 presentes"
  const horaDoTop = campanha && agora.hora === campanha.topDoDiaHora && agora.minuto < 30;

  if (horaDoTop) {
    const presentes = candidatas
      .filter((o) => campanha.categorias.includes(categoriaDe(cfg, o.keyword)))
      .sort((a, b) => (b.nota || 0) - (a.nota || 0) || b.vendas - a.vendas)
      .slice(0, TOP_DO_DIA);

    if (presentes.length >= 3) {
      const texto = montarTopDoDia(presentes, campanha);
      if (teste) return { ...base, enviadas: 0, top: presentes.map((o) => o.nome), mensagens: [texto] };

      await postarTexto(texto);
      for (const o of presentes) await marcarComoEnviada(o.item_id);
      return { ...base, enviadas: presentes.length, top: presentes.map((o) => o.nome) };
    }

    log.push('Poucos presentes na fila para o top do dia, segue o disparo normal.');
  }

  const fila = escolher(cfg, candidatas, categoriasRecentes, cfg.disparo.ofertasPorRodada, agora);

  // a categoria decide se o preco por unidade aparece (brinquedo nao tem)
  for (const oferta of fila) oferta.categoria = categoriaDe(cfg, oferta.keyword);

  const resumo = (o) => ({ item_id: o.item_id, categoria: o.categoria, nome: o.nome, preco: o.preco });

  if (teste) {
    return { ...base, enviadas: 0, escolhidas: fila.map(resumo), mensagens: fila.map(montarMensagem), log };
  }

  let enviadas = 0;

  for (const [i, oferta] of fila.entries()) {
    try {
      await postarOferta(oferta);
      await marcarComoEnviada(oferta.item_id);
      enviadas++;
      log.push(`Enviada: ${oferta.item_id} | ${oferta.categoria} | ${oferta.nome.slice(0, 50)}`);
    } catch (erro) {
      await marcarComoFalha(oferta.item_id, erro.message);
      log.push(`Falhou: ${oferta.item_id} | ${erro.message}`);
    }

    if (i < fila.length - 1) await pausa(cfg.disparo.intervaloSegundos * 1000);
  }

  return { ...base, enviadas, de: fila.length, escolhidas: fila.map(resumo), log };
}

import { canaisAtivos, candidatasDoCanal, ultimosDoCanal, registrarEnvio } from './db.js';
import { postarOferta, postarTexto, montarMensagem, montarTopDoDia } from './telegram.js';
import { postarOfertaWhatsApp, postarTextoWhatsApp } from './whatsapp.js';
import { agoraBrasilia, campanhaAtiva, categoriaDe, escolher, todasKeywords } from './selecao.js';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP_DO_DIA = 5;
// o agendador bate a cada 5 min; se ele repetir (ou alguem chamar na mao), o canal nao posta 2x no mesmo horario
const JANELA_SEM_REPETIR_MIN = 4;

/** "08:05" do horario atual, arredondado pra baixo de 5 em 5 min (o pg_cron pode atrasar uns segundos). */
export function horarioDaRodada(agora = agoraBrasilia()) {
  const minuto = Math.floor(agora.minuto / 5) * 5;
  return `${String(agora.hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

const formatoDo = (canal) => (canal.tipo === 'whatsapp' ? 'whatsapp' : 'html');

function postar(canal, oferta) {
  return canal.tipo === 'whatsapp' ? postarOfertaWhatsApp(canal, oferta) : postarOferta(oferta, canal.destino);
}

function postarLista(canal, texto) {
  return canal.tipo === 'whatsapp' ? postarTextoWhatsApp(canal, texto) : postarTexto(texto, canal.destino);
}

/**
 * Rodada do agendador: cada canal ativo cuja grade tem o horario de agora posta.
 * Nada de horario fixo no codigo: a grade e editada no cockpit.
 */
export async function rodada(cfg, { origem = 'agendador' } = {}) {
  const agora = agoraBrasilia();
  const horario = horarioDaRodada(agora);
  const canais = await canaisAtivos();
  const daVez = canais.filter((c) => (c.horarios || []).includes(horario));

  const resultados = [];
  for (const canal of daVez) {
    try {
      resultados.push(await dispararNoCanal(cfg, canal, { origem }));
    } catch (erro) {
      // um canal quebrado (WhatsApp caiu, por exemplo) nao derruba os outros
      await registrarEnvio({ canalId: canal.id, status: 'falha', erro: erro.message, origem }).catch(() => {});
      resultados.push({ canal: canal.nome, enviadas: 0, erro: erro.message });
    }
  }

  return { horario: `${agora.dia} ${horario}`, canaisAtivos: canais.length, daVez: daVez.length, resultados };
}

/**
 * Posta a(s) proxima(s) oferta(s) da fila neste canal.
 * teste: escolhe e monta a mensagem, mas nao posta nem registra nada.
 * oferta: posta exatamente esta (botao "enviar agora" da fila no cockpit).
 */
export async function dispararNoCanal(cfg, canal, { teste = false, origem = 'agendador', oferta = null } = {}) {
  const log = [];
  const agora = agoraBrasilia();
  const base = { canal: canal.nome, tipo: canal.tipo, teste, horario: `${agora.dia} ${horarioDaRodada(agora)}` };
  const formato = formatoDo(canal);

  if (oferta) {
    oferta.categoria = categoriaDe(cfg, oferta.keyword);
    if (teste) return { ...base, enviadas: 0, mensagens: [montarMensagem(oferta, formato)] };
    try {
      await postar(canal, oferta);
      await registrarEnvio({ canalId: canal.id, itemId: oferta.item_id, status: 'enviado', origem });
      return { ...base, enviadas: 1, escolhidas: [{ item_id: oferta.item_id, nome: oferta.nome }] };
    } catch (erro) {
      await registrarEnvio({ canalId: canal.id, itemId: oferta.item_id, status: 'falha', erro: erro.message, origem });
      throw erro;
    }
  }

  const candidatas = await candidatasDoCanal(canal.id, todasKeywords(cfg));
  base.fila = candidatas.length;

  if (candidatas.length === 0) {
    return { ...base, enviadas: 0, motivo: 'Fila vazia para este canal. Nada a postar nesta rodada.' };
  }

  const historico = await ultimosDoCanal(canal.id);
  const ultimoEnvio = historico[0] ? new Date(historico[0].criado_em) : null;

  if (!teste && origem === 'agendador' && ultimoEnvio && Date.now() - ultimoEnvio.getTime() < JANELA_SEM_REPETIR_MIN * 60 * 1000) {
    return { ...base, enviadas: 0, motivo: `Ja houve envio as ${ultimoEnvio.toISOString()}, pulando esta rodada.` };
  }

  const categoriasRecentes = historico.map((e) => categoriaDe(cfg, e.ofertas?.keyword));
  const campanha = campanhaAtiva(cfg, agora);

  // Na campanha, a 1a rodada do horario da noite vira a lista "Top 5 presentes"
  const horaDoTop = campanha && agora.hora === campanha.topDoDiaHora && agora.minuto < 15 && origem === 'agendador';

  if (horaDoTop) {
    const presentes = candidatas
      .filter((o) => campanha.categorias.includes(categoriaDe(cfg, o.keyword)))
      .sort((a, b) => (b.nota || 0) - (a.nota || 0) || b.vendas - a.vendas)
      .slice(0, TOP_DO_DIA);

    if (presentes.length >= 3) {
      const texto = montarTopDoDia(presentes, campanha, formato);
      if (teste) return { ...base, enviadas: 0, top: presentes.map((o) => o.nome), mensagens: [texto] };

      await postarLista(canal, texto);
      for (const o of presentes) {
        await registrarEnvio({ canalId: canal.id, itemId: o.item_id, tipo: 'top', status: 'enviado', origem });
      }
      return { ...base, enviadas: presentes.length, top: presentes.map((o) => o.nome) };
    }

    log.push('Poucos presentes na fila para o top do dia, segue o disparo normal.');
  }

  const fila = escolher(cfg, candidatas, categoriasRecentes, canal.ofertas_por_rodada || 1, agora);

  // a categoria decide se o preco por unidade aparece (brinquedo nao tem)
  for (const o of fila) o.categoria = categoriaDe(cfg, o.keyword);

  const resumo = (o) => ({ item_id: o.item_id, categoria: o.categoria, nome: o.nome, preco: o.preco });

  if (teste) {
    return { ...base, enviadas: 0, escolhidas: fila.map(resumo), mensagens: fila.map((o) => montarMensagem(o, formato)), log };
  }

  let enviadas = 0;

  for (const [i, o] of fila.entries()) {
    try {
      await postar(canal, o);
      await registrarEnvio({ canalId: canal.id, itemId: o.item_id, status: 'enviado', origem });
      enviadas++;
      log.push(`Enviada: ${o.item_id} | ${o.categoria} | ${o.nome.slice(0, 50)}`);
    } catch (erro) {
      await registrarEnvio({ canalId: canal.id, itemId: o.item_id, status: 'falha', erro: erro.message, origem });
      log.push(`Falhou: ${o.item_id} | ${erro.message}`);
    }

    if (i < fila.length - 1) await pausa((cfg.disparo?.intervaloSegundos ?? 5) * 1000);
  }

  return { ...base, enviadas, de: fila.length, escolhidas: fila.map(resumo), log };
}

/** Script manual do GitHub (plano B): uma rodada em todos os canais ativos, ignorando a grade. */
export async function disparar(cfg, { teste = false, origem = 'github' } = {}) {
  const canais = await canaisAtivos();
  const resultados = [];
  for (const canal of canais) {
    try {
      resultados.push(await dispararNoCanal(cfg, canal, { teste, origem }));
    } catch (erro) {
      resultados.push({ canal: canal.nome, enviadas: 0, erro: erro.message });
    }
  }
  return { teste, resultados };
}

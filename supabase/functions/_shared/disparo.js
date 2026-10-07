import { canaisAtivos, candidatasDoCanal, ultimosDoCanal, registrarEnvio, marcarSaiu, pausas } from './db.js';
import { postarOferta, postarTexto, montarMensagem, montarTopDoDia } from './telegram.js';
import { postarOfertaWhatsApp, postarTextoWhatsApp } from './whatsapp.js';
import { agoraBrasilia, assinatura, campanhaAtiva, categoriaDe, escolher, filtrosDe, parecidos, todasKeywords } from './selecao.js';
import { motivoReprovacao } from './shopee.js';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP_DO_DIA = 5;
// o agendador bate a cada 5 min; se ele repetir (ou alguem chamar na mao), o canal nao posta 2x no mesmo horario
const JANELA_SEM_REPETIR_MIN = 4;
// produto parecido com um que saiu no canal nesse periodo nao sai de novo (outro vendedor, mesmo produto)
const DIAS_SEM_REPETIR_PRODUTO = 5;

/** "08:05" do horario atual, arredondado pra baixo de 5 em 5 min (o pg_cron pode atrasar uns segundos). */
export function horarioDaRodada(agora = agoraBrasilia()) {
  const minuto = Math.floor(agora.minuto / 5) * 5;
  return `${String(agora.hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

const formatoDo = (canal) => (canal.tipo === 'whatsapp' ? 'whatsapp' : 'html');

/** Posta e devolve o id da mensagem (Telegram: message_id; WhatsApp: key.id). */
async function postar(canal, oferta) {
  if (canal.tipo === 'whatsapp') {
    const r = await postarOfertaWhatsApp(canal, oferta);
    return r?.key?.id ?? null;
  }
  const r = await postarOferta(oferta, canal.destino);
  return r?.message_id ?? null;
}

function postarLista(canal, texto) {
  return canal.tipo === 'whatsapp' ? postarTextoWhatsApp(canal, texto) : postarTexto(texto, canal.destino);
}

async function saiu(canal, oferta, { origem, tipo = 'oferta', msgId = null }) {
  await registrarEnvio({ canal, itemId: oferta.item_id, tipo, ok: true, origem, msgId });
  await marcarSaiu(oferta.item_id, canal.tipo === 'telegram' ? msgId : null);
}

/**
 * Rodada do agendador: cada canal ativo cuja grade tem o horario de agora posta.
 * Respeita as pausas da tela (tudo, ou so o WhatsApp).
 */
export async function rodada(cfg, { origem = 'agendador' } = {}) {
  const agora = agoraBrasilia();
  const horario = horarioDaRodada(agora);
  const pausado = await pausas();

  if (pausado.tudo) return { horario: `${agora.dia} ${horario}`, motivo: 'Disparo pausado no cockpit.', resultados: [] };

  const canais = (await canaisAtivos()).filter((c) => !(pausado.whatsapp && c.tipo === 'whatsapp'));
  const daVez = canais.filter((c) => (c.horarios || []).includes(horario));

  const resultados = [];
  for (const canal of daVez) {
    try {
      resultados.push(await dispararNoCanal(cfg, canal, { origem }));
    } catch (erro) {
      // um canal quebrado (WhatsApp caiu, por exemplo) nao derruba os outros
      await registrarEnvio({ canal, ok: false, erro: erro.message, origem }).catch(() => {});
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
      const msgId = await postar(canal, oferta);
      await saiu(canal, oferta, { origem, msgId });
      return { ...base, enviadas: 1, escolhidas: [{ item_id: oferta.item_id, nome: oferta.nome }] };
    } catch (erro) {
      await registrarEnvio({ canal, itemId: oferta.item_id, ok: false, erro: erro.message, origem });
      throw erro;
    }
  }

  const todas = await candidatasDoCanal(canal.id, todasKeywords(cfg), cfg.disparo?.validadeEmDias ?? 3);
  // a fila pode ter oferta coletada antes de a regra mudar: passa de novo pelo filtro (nicho, pet, nota...)
  const doNicho = todas.filter((o) => o.prioridade > 0 || motivoReprovacao(o, filtrosDe(cfg, o.keyword)) === null);
  base.fila = doNicho.length;

  if (doNicho.length === 0) {
    return { ...base, enviadas: 0, motivo: 'Fila vazia para este canal. Nada a postar nesta rodada.' };
  }

  const historico = await ultimosDoCanal(canal.id, 200);
  const ultimoEnvio = historico[0] ? new Date(historico[0].enviado_em) : null;

  if (!teste && origem === 'agendador' && ultimoEnvio && Date.now() - ultimoEnvio.getTime() < JANELA_SEM_REPETIR_MIN * 60 * 1000) {
    return { ...base, enviadas: 0, motivo: `Ja houve envio as ${ultimoEnvio.toISOString()}, pulando esta rodada.` };
  }

  const categoriasRecentes = historico.slice(0, 15).map((e) => categoriaDe(cfg, e.keyword));

  // anti-repeticao: tira da fila o que e parecido com algo que saiu no canal nos ultimos dias
  const limite = Date.now() - DIAS_SEM_REPETIR_PRODUTO * 86400000;
  const recentes = historico.filter((e) => e.nome && new Date(e.enviado_em).getTime() > limite).map((e) => assinatura(e.nome));
  const candidatas = [];
  const vistos = [...recentes];
  for (const o of doNicho) {
    const a = assinatura(o.nome);
    // fixada passa sempre: foi escolha sua
    if (o.prioridade > 0 || !vistos.some((v) => parecidos(a, v))) {
      candidatas.push(o);
      vistos.push(a); // dois anuncios iguais na mesma fila: fica so o de melhor pontuacao (a fila vem ordenada)
    }
  }
  base.fila = candidatas.length;
  if (candidatas.length === 0) {
    return { ...base, enviadas: 0, motivo: 'So sobrou produto repetido na fila deste canal. Rode uma coleta.' };
  }
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
      for (const o of presentes) await saiu(canal, o, { origem, tipo: 'top' });
      return { ...base, enviadas: presentes.length, top: presentes.map((o) => o.nome) };
    }

    log.push('Poucos presentes na fila para o top do dia, segue o disparo normal.');
  }

  const quantidade = canal.ofertas_por_rodada || 1;
  // fixadas no cockpit (prioridade) passam na frente da escolha automatica
  const fixadas = candidatas.filter((o) => o.prioridade > 0).slice(0, quantidade);
  const resto = candidatas.filter((o) => !(o.prioridade > 0));
  const fila = [...fixadas, ...escolher(cfg, resto, categoriasRecentes, quantidade - fixadas.length, agora)];

  // a categoria decide se o preco por unidade aparece (brinquedo nao tem)
  for (const o of fila) o.categoria = categoriaDe(cfg, o.keyword);

  const resumo = (o) => ({ item_id: o.item_id, categoria: o.categoria, nome: o.nome, preco: o.preco, fixada: o.prioridade > 0 });

  if (teste) {
    return { ...base, enviadas: 0, escolhidas: fila.map(resumo), mensagens: fila.map((o) => montarMensagem(o, formato)), log };
  }

  let enviadas = 0;

  for (const [i, o] of fila.entries()) {
    try {
      const msgId = await postar(canal, o);
      await saiu(canal, o, { origem, msgId });
      enviadas++;
      log.push(`Enviada: ${o.item_id} | ${o.categoria} | ${o.nome.slice(0, 50)}`);
    } catch (erro) {
      await registrarEnvio({ canal, itemId: o.item_id, ok: false, erro: erro.message, origem });
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

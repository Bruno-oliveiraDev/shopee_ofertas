import { readFile } from 'node:fs/promises';
import { candidatasDaFila, ultimasEnviadas, salvarGancho, marcarComoEnviada, marcarComoFalha } from '../src/db.js';
import { postarOferta, postarTexto, montarTopDoDia } from '../src/telegram.js';
import { gerarGanchos } from '../src/copy.js';
import { FRASES, FRASES_CAMPANHA, sortearFrase } from '../src/frases.js';
import { agoraBrasilia, campanhaAtiva, categoriaDe, escolher } from '../src/selecao.js';

const cfg = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP_DO_DIA = 5;

const agora = agoraBrasilia();
const campanha = campanhaAtiva(cfg, agora);
const candidatas = await candidatasDaFila();

if (candidatas.length === 0) {
  console.log('Fila vazia. Nada a postar nesta rodada.');
  process.exit(0);
}

const historico = await ultimasEnviadas();
const categoriasRecentes = historico.map((o) => categoriaDe(cfg, o.keyword));
const frasesRecentes = historico.map((o) => o.gancho).filter(Boolean);

// Na campanha, a rodada das :05 do horario da noite vira a lista "Top 5 presentes"
const horaDoTop = campanha && agora.hora === campanha.topDoDiaHora && agora.minuto < 30;

if (horaDoTop) {
  const presentes = candidatas
    .filter((o) => campanha.categorias.includes(categoriaDe(cfg, o.keyword)))
    .sort((a, b) => (b.nota || 0) - (a.nota || 0) || b.vendas - a.vendas)
    .slice(0, TOP_DO_DIA);

  if (presentes.length >= 3) {
    await postarTexto(montarTopDoDia(presentes, campanha));
    for (const o of presentes) await marcarComoEnviada(o.item_id);
    console.log(`Top do dia enviado com ${presentes.length} presentes.`);
    process.exit(0);
  }

  console.log('Poucos presentes na fila para o top do dia, segue o disparo normal.');
}

const fila = escolher(cfg, candidatas, categoriasRecentes, cfg.disparo.ofertasPorRodada, agora);

// oferta que ficou sem gancho na coleta (IA fora do ar) ganha um agora, antes de postar
const semGancho = fila.filter((o) => !o.gancho);
if (semGancho.length > 0) {
  const ganchos = await gerarGanchos(semGancho);
  for (const oferta of semGancho) {
    oferta.gancho = ganchos.get(oferta.item_id) || null;
  }
}

for (const oferta of fila) {
  const categoria = categoriaDe(cfg, oferta.keyword);
  const daCampanha = campanha?.categorias.includes(categoria);

  // IA fora do ar: frase escrita a mao da categoria, sem repetir as ultimas
  if (!oferta.gancho) {
    const banco = daCampanha ? FRASES_CAMPANHA : FRASES[categoria] || FRASES.geral;
    oferta.gancho = sortearFrase(banco, frasesRecentes);
    frasesRecentes.unshift(oferta.gancho);
  }

  if (daCampanha) oferta.selo = campanha.selo;

  await salvarGancho(oferta.item_id, oferta.gancho).catch(() => {});
}

let enviadas = 0;

for (const oferta of fila) {
  try {
    await postarOferta(oferta);
    await marcarComoEnviada(oferta.item_id);
    enviadas++;
    console.log(`Enviada: ${oferta.item_id} | ${categoriaDe(cfg, oferta.keyword)} | ${oferta.nome.slice(0, 50)}`);
  } catch (erro) {
    await marcarComoFalha(oferta.item_id, erro.message);
    console.error(`Falhou: ${oferta.item_id} | ${erro.message}`);
  }

  await pausa(cfg.disparo.intervaloSegundos * 1000);
}

console.log(`\n${enviadas} de ${fila.length} ofertas postadas.`);

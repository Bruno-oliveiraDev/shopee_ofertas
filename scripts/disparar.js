import { readFile } from 'node:fs/promises';
import { candidatasDaFila, ultimasEnviadas, marcarComoEnviada, marcarComoFalha } from '../src/db.js';
import { postarOferta, postarTexto, montarTopDoDia } from '../src/telegram.js';
import { agoraBrasilia, campanhaAtiva, categoriaDe, escolher, todasKeywords } from '../src/selecao.js';

const cfg = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const TOP_DO_DIA = 5;

const agora = agoraBrasilia();
const campanha = campanhaAtiva(cfg, agora);
// oferta de busca que saiu da lista (ex.: lencol de adulto que veio em "jogo de lencol") nao vai pro grupo
const candidatas = await candidatasDaFila(todasKeywords(cfg));

if (candidatas.length === 0) {
  console.log('Fila vazia. Nada a postar nesta rodada.');
  process.exit(0);
}

const historico = await ultimasEnviadas();
const categoriasRecentes = historico.map((o) => categoriaDe(cfg, o.keyword));

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

// a categoria decide se o preco por unidade aparece (brinquedo nao tem)
for (const oferta of fila) oferta.categoria = categoriaDe(cfg, oferta.keyword);

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

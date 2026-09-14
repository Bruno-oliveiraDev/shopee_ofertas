import { readFile } from 'node:fs/promises';
import { proximasDaFila, marcarComoEnviada, marcarComoFalha } from '../src/db.js';
import { postarOferta } from '../src/telegram.js';

const cfg = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const fila = await proximasDaFila(cfg.disparo.ofertasPorRodada);

if (fila.length === 0) {
  console.log('Fila vazia. Nada a postar nesta rodada.');
  process.exit(0);
}

let enviadas = 0;

for (const oferta of fila) {
  try {
    await postarOferta(oferta);
    await marcarComoEnviada(oferta.item_id);
    enviadas++;
    console.log(`Enviada: ${oferta.item_id} | ${oferta.nome.slice(0, 50)}`);
  } catch (erro) {
    await marcarComoFalha(oferta.item_id, erro.message);
    console.error(`Falhou: ${oferta.item_id} | ${erro.message}`);
  }

  await pausa(cfg.disparo.intervaloSegundos * 1000);
}

console.log(`\n${enviadas} de ${fila.length} ofertas postadas.`);

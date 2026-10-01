import { readFile } from 'node:fs/promises';
import { buscarOfertas, normalizar, passaNoFiltro } from '../src/shopee.js';
import { salvarOfertas, salvarGancho, expirarAntigas } from '../src/db.js';
import { gerarGanchos } from '../src/copy.js';

const cfg = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

let candidatas = [];
let falhas = 0;

for (const keyword of cfg.keywords) {
  try {
    const produtos = await buscarOfertas(cfg, keyword);
    const aprovadas = produtos
      .map((p) => normalizar(p, keyword))
      .filter((linha) => passaNoFiltro(linha, cfg.filtros));

    console.log(`${keyword}: ${produtos.length} retornadas, ${aprovadas.length} aprovadas`);
    candidatas.push(...aprovadas);
  } catch (erro) {
    falhas++;
    console.error(`${keyword}: ${erro.message}`);
  }

  await pausa(1500); // respeita o rate limit da Shopee
}

if (falhas === cfg.keywords.length) {
  throw new Error('Todas as buscas falharam. Verifique credenciais e assinatura.');
}

// tira duplicata dentro da propria rodada antes de mandar pro banco
const unicas = [...new Map(candidatas.map((o) => [o.item_id, o])).values()];

const novas = await salvarOfertas(unicas);
await expirarAntigas(cfg.disparo.validadeEmDias);

// a IA escreve o gancho so das ofertas que entraram agora, o resto ja tem ou fica pro disparo
const ganchos = await gerarGanchos(novas);
for (const [itemId, gancho] of ganchos) {
  try {
    await salvarGancho(itemId, gancho);
  } catch (erro) {
    console.error(`Gancho nao salvo (${itemId}): ${erro.message}`);
  }
}

console.log(`\nCandidatas: ${unicas.length} | Novas no banco: ${novas.length}`);

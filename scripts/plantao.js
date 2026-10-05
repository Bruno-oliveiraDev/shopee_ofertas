// O agendador do GitHub atrasa ou pula execucoes: das 24 por dia, rodavam 1 a 3.
// Entao o robo fica de plantao algumas horas e ele mesmo segue o relogio,
// chamando o disparo em cada horario de config.disparo.horarios.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { agoraBrasilia } from '../src/selecao.js';

const cfg = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

// o job do GitHub morre em 6h; o plantao para antes e o proximo assume
const DURACAO_MIN = Number(process.env.PLANTAO_MINUTOS || 320);
// plantao que comecou atrasado ainda posta o horario que acabou de passar
const TOLERANCIA_MIN = 10;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const inicio = Date.now();
const fim = inicio + DURACAO_MIN * 60 * 1000;
const { dia } = agoraBrasilia();

// o Brasil nao tem mais horario de verao, entao Brasilia e sempre -03:00
const horarios = cfg.disparo.horarios
  .map((h) => ({ h, quando: new Date(`${dia}T${h}:00-03:00`).getTime() }))
  .filter(({ quando }) => quando >= inicio - TOLERANCIA_MIN * 60 * 1000 && quando < fim);

if (horarios.length === 0) {
  console.log('Nenhum horario de disparo neste plantao.');
  process.exit(0);
}

console.log(`Plantao cobre: ${horarios.map((x) => x.h).join(', ')}`);

for (const { h, quando } of horarios) {
  const espera = quando - Date.now();
  if (espera > 0) await pausa(espera);

  console.log(`\n=== ${h} ===`);
  // processo separado: o disparo encerra com process.exit e um erro numa rodada nao derruba as outras
  const rodada = spawnSync('node', ['scripts/disparar.js'], { stdio: 'inherit' });
  if (rodada.status !== 0) console.error(`Rodada das ${h} falhou (codigo ${rodada.status}), segue o plantao.`);
}

console.log('\nPlantao encerrado.');

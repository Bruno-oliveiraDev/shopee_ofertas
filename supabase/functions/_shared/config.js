import arquivo from './config.json' with { type: 'json' };
import { configDoBanco } from './db.js';

/**
 * Config do robo: a do cockpit (banco) por cima da do arquivo.
 * Se o banco falhar ou ainda nao tiver config, o robo segue com o config.json.
 */
export async function carregarConfig() {
  try {
    const doBanco = await configDoBanco();
    if (doBanco) {
      return {
        ...arquivo,
        ...doBanco,
        disparo: { ...arquivo.disparo, ...(doBanco.disparo || {}) },
      };
    }
  } catch (erro) {
    console.warn(`Config do banco indisponivel, usando config.json. ${erro.message}`);
  }
  return arquivo;
}

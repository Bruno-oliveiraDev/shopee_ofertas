import { servir } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { rodada, disparar } from '../_shared/disparo.js';

// Chamado pelo pg_cron a cada 5 min: posta nos canais ativos cuja grade tem o horario de agora.
// ?teste=1 mostra o que cada canal ativo postaria agora, sem postar nem registrar.
servir(async ({ teste }) => {
  const cfg = await carregarConfig();
  return teste === '1' ? disparar(cfg, { teste: true }) : rodada(cfg);
});

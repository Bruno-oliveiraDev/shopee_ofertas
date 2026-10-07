import cfg from '../_shared/config.json' with { type: 'json' };
import { servir } from '../_shared/http.js';
import { disparar } from '../_shared/disparo.js';

// ?teste=1 escolhe a oferta e devolve a mensagem sem postar nem marcar no banco
servir(({ teste }) => disparar(cfg, { teste: teste === '1' }));

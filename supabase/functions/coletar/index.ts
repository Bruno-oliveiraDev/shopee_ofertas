import cfg from '../_shared/config.json' with { type: 'json' };
import { servir } from '../_shared/http.js';
import { coletar } from '../_shared/coleta.js';

// ?parte=1&de=3: o agendador divide as buscas em 3 chamadas pra caber no tempo limite
servir(({ parte, de }) => coletar(cfg, { parte: Number(parte) || 1, de: Number(de) || 1 }));

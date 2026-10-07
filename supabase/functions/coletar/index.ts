import { servir } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { coletar } from '../_shared/coleta.js';

// ?parte=1&de=3: o agendador divide as buscas em 3 chamadas pra caber no tempo limite
servir(async ({ parte, de }) => coletar(await carregarConfig(), { parte: Number(parte) || 1, de: Number(de) || 1 }));

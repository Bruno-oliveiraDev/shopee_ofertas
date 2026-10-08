import { servir } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { coletar } from '../_shared/coleta.js';
import { sincronizarVendas } from '../_shared/vendas.js';

// ?parte=1&de=3: o agendador divide as buscas em 3 chamadas pra caber no tempo limite
// ?tarefa=vendas: puxa as vendas da Shopee (agendador de hora em hora)
servir(async ({ parte, de, tarefa }) =>
  tarefa === 'vendas' ? sincronizarVendas() : coletar(await carregarConfig(), { parte: Number(parte) || 1, de: Number(de) || 1 }));

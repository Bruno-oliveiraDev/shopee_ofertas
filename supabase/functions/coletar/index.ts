import { servir } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { coletar } from '../_shared/coleta.js';
import { sincronizarVendas } from '../_shared/vendas.js';
import { medirMembros } from '../_shared/membros.js';

// ?parte=1&de=3: o agendador divide as buscas em 3 chamadas pra caber no tempo limite
// ?tarefa=vendas: puxa as vendas da Shopee (agendador de hora em hora)
// ?tarefa=membros: conta os membros de cada grupo (agendador de hora em hora)
servir(async ({ parte, de, tarefa }) =>
  tarefa === 'vendas' ? sincronizarVendas()
  : tarefa === 'membros' ? medirMembros()
  : coletar(await carregarConfig(), { parte: Number(parte) || 1, de: Number(de) || 1 }));

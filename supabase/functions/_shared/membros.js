// Quantas pessoas tem em cada grupo, medido de hora em hora (agendador: coletar?tarefa=membros).
// A diferenca entre duas medicoes e quem entrou de verdade (menos quem saiu) no periodo.
import { env } from './env.js';
import { canaisAtivos, chamar } from './db.js';
import { evolution } from './whatsapp.js';

async function membrosTelegram(chatId) {
  const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/getChatMemberCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId || env('TELEGRAM_CHAT_ID') }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`Telegram (getChatMemberCount): ${d.description}`);
  return Number(d.result);
}

async function membrosWhatsApp(canal) {
  const g = await evolution(`/group/findGroupInfos/${encodeURIComponent(canal.instancia)}?groupJid=${encodeURIComponent(canal.destino)}`);
  const n = g?.size ?? g?.participants?.length;
  if (n == null) throw new Error('Evolution nao devolveu o tamanho do grupo');
  return Number(n);
}

export async function medirMembros() {
  const canais = await canaisAtivos();
  const linhas = [];
  const erros = [];
  for (const c of canais) {
    try {
      const membros = c.tipo === 'whatsapp' ? await membrosWhatsApp(c) : await membrosTelegram(c.destino);
      linhas.push({ canal_id: c.id, tipo: c.tipo, membros });
    } catch (erro) {
      erros.push(`${c.nome}: ${erro.message}`);
    }
  }
  if (linhas.length) await chamar('membros', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(linhas) });
  return { medidos: linhas, erros };
}

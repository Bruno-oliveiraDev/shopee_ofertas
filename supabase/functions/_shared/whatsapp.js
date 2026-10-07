// WhatsApp pela Evolution API (v2). Url e apikey ficam na tabela segredos (cadastradas pelo cockpit).
// Numero conectado por QR (chip), so para GRUPO. Disparo em massa para contatos e com a API oficial da Meta.
import { lerSegredos } from './db.js';
import { montarMensagem, montarTopDoDia } from './telegram.js';

async function conexao() {
  const s = await lerSegredos(['evolution_url', 'evolution_apikey']);
  if (!s.evolution_url || !s.evolution_apikey) {
    throw new Error('Evolution nao configurada: cadastre url e apikey em Conexoes no cockpit');
  }
  return { url: s.evolution_url.replace(/\/$/, ''), apikey: s.evolution_apikey };
}

export async function evolution(caminho, { method = 'GET', body } = {}) {
  const { url, apikey } = await conexao();
  const resposta = await fetch(`${url}${caminho}`, {
    method,
    headers: { apikey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await resposta.text();
  let dados;
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    dados = { texto };
  }

  if (!resposta.ok) {
    const motivo = dados?.response?.message || dados?.message || dados?.error || texto;
    throw new Error(`Evolution ${resposta.status} (${caminho}): ${JSON.stringify(motivo).slice(0, 300)}`);
  }
  return dados;
}

const nomeSeguro = (nome) => encodeURIComponent(String(nome || '').trim());

export async function listarInstancias() {
  const lista = await evolution('/instance/fetchInstances');
  return (Array.isArray(lista) ? lista : []).map((i) => ({
    nome: i.name ?? i.instance?.instanceName,
    estado: i.connectionStatus ?? i.instance?.status,
    numero: i.ownerJid ?? i.instance?.owner ?? null,
    perfil: i.profileName ?? i.instance?.profileName ?? null,
    foto: i.profilePicUrl ?? i.instance?.profilePictureUrl ?? null,
  }));
}

/** Cria a instancia e ja devolve o QR (base64) pra ler no celular. */
export async function criarInstancia(nome) {
  const dados = await evolution('/instance/create', {
    method: 'POST',
    body: { instanceName: String(nome).trim(), integration: 'WHATSAPP-BAILEYS', qrcode: true },
  });
  return { qr: dados?.qrcode?.base64 || null, codigo: dados?.qrcode?.pairingCode || null };
}

/** QR novo para uma instancia que ja existe (o QR expira em ~40s). */
export async function qrDaInstancia(nome) {
  const dados = await evolution(`/instance/connect/${nomeSeguro(nome)}`);
  return { qr: dados?.base64 || null, codigo: dados?.pairingCode || null, estado: dados?.instance?.state || null };
}

export async function estadoDaInstancia(nome) {
  const dados = await evolution(`/instance/connectionState/${nomeSeguro(nome)}`);
  return dados?.instance?.state || dados?.state || 'desconhecido';
}

export function desconectarInstancia(nome) {
  return evolution(`/instance/logout/${nomeSeguro(nome)}`, { method: 'DELETE' });
}

export function apagarInstancia(nome) {
  return evolution(`/instance/delete/${nomeSeguro(nome)}`, { method: 'DELETE' });
}

/** Grupos em que o numero esta, pra escolher o destino do canal. */
export async function listarGrupos(nome) {
  const lista = await evolution(`/group/fetchAllGroups/${nomeSeguro(nome)}?getParticipants=false`);
  return (Array.isArray(lista) ? lista : [])
    .map((g) => ({ id: g.id, nome: g.subject, membros: g.size ?? null, soAdmin: g.announce ?? null }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

export function postarTextoWhatsApp(canal, texto) {
  return evolution(`/message/sendText/${nomeSeguro(canal.instancia)}`, {
    method: 'POST',
    body: { number: canal.destino, text: texto, linkPreview: true },
  });
}

/** Foto + legenda; se a Evolution recusar a imagem, vai so o texto (com previa do link). */
export async function postarOfertaWhatsApp(canal, oferta) {
  if (!canal.instancia || !canal.destino) throw new Error('Canal de WhatsApp sem instancia ou grupo escolhido');
  if (!String(canal.instancia).toLowerCase().startsWith('achadinhos')) throw new Error('Numero fora do Achadinhos: o robo nao posta por ele');

  const legenda = montarMensagem(oferta, 'whatsapp');

  if (oferta.imagem) {
    try {
      return await evolution(`/message/sendMedia/${nomeSeguro(canal.instancia)}`, {
        method: 'POST',
        body: {
          number: canal.destino,
          mediatype: 'image',
          mimetype: 'image/jpeg',
          fileName: `${oferta.item_id}.jpg`,
          caption: legenda,
          media: oferta.imagem,
        },
      });
    } catch (erro) {
      console.warn(`Foto recusada no WhatsApp (${oferta.item_id}), enviando como texto. ${erro.message}`);
    }
  }

  return postarTextoWhatsApp(canal, legenda);
}

export const topDoDiaWhatsApp = (ofertas, campanha) => montarTopDoDia(ofertas, campanha, 'whatsapp');

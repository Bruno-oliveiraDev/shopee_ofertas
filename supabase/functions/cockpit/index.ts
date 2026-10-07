// Acoes do cockpit que precisam de segredo (Telegram, Evolution, Shopee) ou do robo.
// Leitura de tabelas (envios, fila, canais, config) o cockpit faz direto no banco, com RLS de admin.
import { servirCockpit } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { canal, ehAdmin, gravarSegredo, lerSegredos, ofertaPorId } from '../_shared/db.js';
import { dispararNoCanal } from '../_shared/disparo.js';
import { coletar } from '../_shared/coleta.js';
import { infoDoChat, postarTexto } from '../_shared/telegram.js';
import {
  apagarInstancia,
  criarInstancia,
  desconectarInstancia,
  estadoDaInstancia,
  listarGrupos,
  listarInstancias,
  postarTextoWhatsApp,
  qrDaInstancia,
} from '../_shared/whatsapp.js';

const obrigatorio = (valor, nome) => {
  if (!valor) throw new Error(`Falta ${nome}`);
  return valor;
};

servirCockpit(
  {
    // Disparo na hora (ou previa, com teste=true). item_id = postar esta oferta especifica.
    async disparar_canal({ canal_id, teste = false, item_id }) {
      const cfg = await carregarConfig();
      const c = await canal(obrigatorio(canal_id, 'canal_id'));
      const oferta = item_id ? await ofertaPorId(item_id) : null;
      return dispararNoCanal(cfg, c, { teste: Boolean(teste), origem: 'cockpit', oferta });
    },

    // A tela chama parte 1, 2 e 3 em sequencia (cada uma cabe no tempo limite da funcao)
    async coletar({ parte = 1, de = 3 }) {
      return coletar(await carregarConfig(), { parte: Number(parte), de: Number(de) });
    },

    async telegram_info({ canal_id }) {
      const c = await canal(obrigatorio(canal_id, 'canal_id'));
      return infoDoChat(c.destino);
    },

    async canal_teste({ canal_id, texto }) {
      const c = await canal(obrigatorio(canal_id, 'canal_id'));
      const mensagem = texto || '✅ Teste do cockpit: este canal esta conectado.';
      if (c.tipo === 'whatsapp') await postarTextoWhatsApp(c, mensagem);
      else await postarTexto(mensagem, c.destino);
      return { ok: true };
    },

    // ---------------------------------------------------------------- Evolution
    async evolution_status() {
      const s = await lerSegredos(['evolution_url', 'evolution_apikey']);
      if (!s.evolution_url || !s.evolution_apikey) return { configurada: false };
      try {
        return { configurada: true, url: s.evolution_url, instancias: await listarInstancias() };
      } catch (erro) {
        return { configurada: true, url: s.evolution_url, erro: erro.message, instancias: [] };
      }
    },

    async evolution_salvar({ url, apikey }) {
      await gravarSegredo('evolution_url', String(obrigatorio(url, 'url')).trim().replace(/\/$/, ''));
      if (apikey) await gravarSegredo('evolution_apikey', String(apikey).trim());
      return { ok: true, instancias: await listarInstancias() };
    },

    wa_criar: ({ nome }) => criarInstancia(obrigatorio(nome, 'nome')),
    wa_qr: ({ nome }) => qrDaInstancia(obrigatorio(nome, 'nome')),
    wa_estado: async ({ nome }) => ({ estado: await estadoDaInstancia(obrigatorio(nome, 'nome')) }),
    wa_grupos: ({ nome }) => listarGrupos(obrigatorio(nome, 'nome')),
    wa_desconectar: ({ nome }) => desconectarInstancia(obrigatorio(nome, 'nome')),
    wa_apagar: ({ nome }) => apagarInstancia(obrigatorio(nome, 'nome')),
  },
  ehAdmin
);

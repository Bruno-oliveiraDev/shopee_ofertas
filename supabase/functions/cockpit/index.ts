// Tudo o que a tela do cockpit faz passa por aqui, com a service_role (as tabelas nao ficam abertas pro navegador).
// Sem senha por enquanto (decisao do Bruno, 07/10).
import { servirCockpit } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { acaoNoBanco, canal, chamar, gravarSegredo, lerSegredos, ofertaPorId, pausas } from '../_shared/db.js';
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

// O servidor da Evolution e o da agencia (chave global). O cockpit, que esta sem senha, so enxerga
// e mexe em numeros cujo nome comeca com "achadinhos": os da agencia ficam fora de alcance.
const PREFIXO = 'achadinhos'
const doAchadinhos = (nome: unknown) => String(nome || '').toLowerCase().startsWith(PREFIXO)
function numeroDoAchadinhos(nome: unknown) {
  if (!doAchadinhos(nome)) throw new Error(`So numeros com nome comecando em "${PREFIXO}" podem ser usados pelo cockpit`)
  return String(nome)
}

const obrigatorio = (valor: unknown, nome: string) => {
  if (valor === undefined || valor === null || valor === '') throw new Error(`Falta ${nome}`);
  return valor;
};

const enc = encodeURIComponent;
const CAMPOS_OFERTA = 'item_id,nome,preco,preco_de,desconto,comissao,vendas,nota,loja,shop_id,imagem,link,keyword,categoria,score,prioridade,status,erro,visto_em,coletada_em,enviada_em';

/** Junta os dados da oferta em cada envio (envios nao tem chave estrangeira pra ofertas). */
async function comOferta(envios: { item_id: string }[]) {
  const ids = [...new Set(envios.map((e) => e.item_id).filter((i) => i && i !== '-'))]
  if (!ids.length) return envios.map((e) => ({ ...e, oferta: null }))
  const ofertas: { item_id: string }[] = []
  // em lotes, pra URL nao ficar grande demais
  for (let i = 0; i < ids.length; i += 150) {
    const lote = ids.slice(i, i + 150).map((x) => `"${x}"`).join(',')
    ofertas.push(...(await chamar(`ofertas?item_id=in.(${enc(lote)})&select=item_id,nome,preco,imagem,keyword,categoria,link,comissao`)))
  }
  const mapa = Object.fromEntries(ofertas.map((o) => [o.item_id, o]))
  return envios.map((e) => ({ ...e, oferta: mapa[e.item_id] ?? null }))
}

servirCockpit(
  {
    // ---------------------------------------------------------------- leituras
    async painel({ desde }: { desde: string }) {
      const [canais, config, p, saude, envios, membros] = await Promise.all([
        chamar('canais?order=criado_em'),
        carregarConfig(),
        pausas(),
        chamar('saude_fila?select=*'),
        chamar(`envios?enviado_em=gte.${enc(obrigatorio(desde, 'desde') as string)}&order=enviado_em.desc&limit=1000`),
        chamar('grupo_membros?order=medido_em.desc&limit=1').catch(() => []),
      ])
      return { canais, config, pausas: p, saude: saude[0] ?? null, envios: await comOferta(envios), membros: membros[0] ?? null }
    },

    async envios({ desde, canal_id, ok }: { desde: string; canal_id?: string; ok?: string }) {
      let q = `envios?enviado_em=gte.${enc(obrigatorio(desde, 'desde') as string)}&order=enviado_em.desc&limit=500`
      if (canal_id) q += `&canal_id=eq.${enc(canal_id)}`
      if (ok === 'sim') q += '&ok=is.true'
      if (ok === 'nao') q += '&ok=is.false'
      return comOferta(await chamar(q))
    },

    async fila({ status = 'pendente', keywords, busca, ordem = 'score' }: { status?: string; keywords?: string[]; busca?: string; ordem?: string }) {
      const ordens: Record<string, string> = { score: 'prioridade.desc,score.desc', comissao: 'comissao.desc', desconto: 'desconto.desc', vendas: 'vendas.desc', recentes: 'visto_em.desc' }
      let q = `ofertas?select=${CAMPOS_OFERTA}&status=eq.${enc(status)}&order=${ordens[ordem] ?? ordens.score}&limit=120`
      if (keywords?.length) q += `&keyword=in.(${enc(keywords.map((k) => `"${k.replace(/"/g, '')}"`).join(','))})`
      if (busca?.trim()) q += `&nome=ilike.${enc(`*${busca.trim()}*`)}`
      const [ofertas, porKeyword] = await Promise.all([chamar(q), chamar('cockpit_keywords?select=keyword,pendentes,enviadas_7d,retornadas_7d,aprovadas_7d,erros_7d,ultima_coleta')])
      return { ofertas, porKeyword }
    },

    reprovacoes: () => chamar('cockpit_reprovacoes?select=*&order=quantidade.desc'),
    bloqueios: () => chamar('bloqueios?order=criado_em.desc'),
    historico_acoes: () => chamar('cockpit_acoes?order=feito_em.desc&limit=60'),
    saude: () => chamar('rpc/cockpit_saude', { method: 'POST', body: '{}' }),

    // ---------------------------------------------------------------- acoes que ja existem no banco
    // fixar, desafixar, pular, voltar, bloquear_produto, bloquear_loja, desbloquear, pausar, retomar
    oferta_acao: ({ acao, alvo, valor }: { acao: string; alvo?: string; valor?: string }) =>
      acaoNoBanco(obrigatorio(acao, 'acao') as string, alvo ?? null, valor ?? null),

    // ---------------------------------------------------------------- canais e config
    async canal_salvar({ canal: c }: { canal: Record<string, unknown> }) {
      const { id, criado_em: _c, ...dados } = obrigatorio(c, 'canal') as Record<string, unknown>
      if (Array.isArray(dados.horarios)) dados.horarios = [...new Set(dados.horarios as string[])].sort()
      if (dados.instancia) numeroDoAchadinhos(dados.instancia)
      if (id) {
        await chamar(`canais?id=eq.${enc(id as string)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(dados) })
        return { ok: true }
      }
      return chamar('canais', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(dados) })
    },

    async canal_apagar({ id }: { id: string }) {
      // os envios ficam (canal_id vira vazio), pra estatistica nao sumir
      await chamar(`canais?id=eq.${enc(obrigatorio(id, 'id') as string)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      return { ok: true }
    },

    async config_salvar({ valor }: { valor: unknown }) {
      await chamar('ajustes?on_conflict=chave', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ chave: 'robo', valor: obrigatorio(valor, 'valor'), atualizado_em: new Date().toISOString() }),
      })
      return { ok: true }
    },

    // ---------------------------------------------------------------- robo na hora
    // Previa (teste=true) ou disparo agora. item_id = postar esta oferta especifica.
    async disparar_canal({ canal_id, teste = false, item_id }: { canal_id: string; teste?: boolean; item_id?: string }) {
      const cfg = await carregarConfig()
      const c = await canal(obrigatorio(canal_id, 'canal_id') as string)
      const oferta = item_id ? await ofertaPorId(item_id) : null
      return dispararNoCanal(cfg, c, { teste: Boolean(teste), origem: 'cockpit', oferta })
    },

    // A tela chama parte 1, 2 e 3 em sequencia (cada uma cabe no tempo limite da funcao)
    coletar: async ({ parte = 1, de = 3 }: { parte?: number; de?: number }) =>
      coletar(await carregarConfig(), { parte: Number(parte), de: Number(de) }),

    async telegram_info({ canal_id }: { canal_id: string }) {
      const c = await canal(obrigatorio(canal_id, 'canal_id') as string)
      return infoDoChat(c.destino)
    },

    // texto fixo: com o cockpit aberto, ninguem usa isto pra mandar mensagem livre no grupo
    async canal_teste({ canal_id }: { canal_id: string }) {
      const c = await canal(obrigatorio(canal_id, 'canal_id') as string)
      const mensagem = '✅ Teste do cockpit: este canal esta conectado.'
      if (c.tipo === 'whatsapp') await postarTextoWhatsApp(c, mensagem)
      else await postarTexto(mensagem, c.destino)
      return { ok: true }
    },

    // ---------------------------------------------------------------- Evolution (WhatsApp)
    async evolution_status() {
      const s = await lerSegredos(['evolution_url', 'evolution_apikey'])
      if (!s.evolution_url || !s.evolution_apikey) return { configurada: false }
      try {
        const todas = await listarInstancias()
        return { configurada: true, url: s.evolution_url, prefixo: PREFIXO, instancias: todas.filter((i: { nome: string }) => doAchadinhos(i.nome)) }
      } catch (erro) {
        return { configurada: true, url: s.evolution_url, erro: (erro as Error).message, instancias: [] }
      }
    },

    async evolution_salvar({ url, apikey }: { url: string; apikey?: string }) {
      await gravarSegredo('evolution_url', String(obrigatorio(url, 'url')).trim().replace(/\/$/, ''))
      if (apikey) await gravarSegredo('evolution_apikey', String(apikey).trim())
      const todas = await listarInstancias()
      return { ok: true, instancias: todas.filter((i: { nome: string }) => doAchadinhos(i.nome)) }
    },

    wa_criar: ({ nome }: { nome: string }) => criarInstancia(numeroDoAchadinhos(nome)),
    wa_qr: ({ nome }: { nome: string }) => qrDaInstancia(numeroDoAchadinhos(nome)),
    wa_estado: async ({ nome }: { nome: string }) => ({ estado: await estadoDaInstancia(numeroDoAchadinhos(nome)) }),
    wa_grupos: ({ nome }: { nome: string }) => listarGrupos(numeroDoAchadinhos(nome)),
    wa_desconectar: ({ nome }: { nome: string }) => desconectarInstancia(numeroDoAchadinhos(nome)),
    wa_apagar: ({ nome }: { nome: string }) => apagarInstancia(numeroDoAchadinhos(nome)),
  }
);

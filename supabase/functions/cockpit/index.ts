// Tudo o que a tela do cockpit faz passa por aqui, com a service_role (as tabelas nao ficam abertas pro navegador).
// Sem senha por enquanto (decisao do Bruno, 07/10).
import { servirCockpit } from '../_shared/http.js';
import { carregarConfig } from '../_shared/config.js';
import { acaoNoBanco, canal, chamar, gravarSegredo, lerSegredos, ofertaPorId, pausas } from '../_shared/db.js';
import { dispararNoCanal } from '../_shared/disparo.js';
import { coletar } from '../_shared/coleta.js';
import { sincronizarVendas } from '../_shared/vendas.js';
import { medirMembros } from '../_shared/membros.js';
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

    // ---------------------------------------------------------------- retorno (investido x comissao)
    // investimento e digitado na tela; as vendas vem da Shopee de hora em hora (ou no botao)
    async retorno() {
      const [investimentos, vendas] = await Promise.all([
        chamar('investimentos?order=dia'),
        chamar('vendas?select=conversion_id,compra_em,situacao,comissao,comissao_confirmada,valor_pedido,itens,canal,categoria,horario,pedidos&order=compra_em.desc&limit=2000'),
      ])
      return { investimentos, vendas }
    },

    vendas_atualizar: () => sincronizarVendas(),

    // ---------------------------------------------------------------- funis: LP (anuncio/site) e /bio (instagram/tiktok)
    // bio_clique e publica (a LP chama): continua aberta mesmo se o cockpit ganhar senha
    async bio_clique({ de, destino }: { de?: string; destino?: string }) {
      const rede = ['instagram', 'tiktok', 'anuncio', 'site'].includes(String(de)) ? String(de) : 'outro'
      if (!['visita', 'whatsapp', 'telegram'].includes(String(destino))) throw new Error('Destino invalido')
      await chamar('bio_cliques', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ de: rede, destino }) })
      return { ok: true }
    },

    /** Os 3 produtos do carrossel mais recente, pra pagina /bio mostrar "achados de hoje". */
    async bio_achados() {
      const [ultimo] = await chamar('carrosseis?select=dia,turno,slides&order=dia.desc,turno.desc&limit=1')
      return { achados: (ultimo?.slides || []).slice(1, -1).map((s: { feed: string }) => s.feed) }
    },

    /** Cliques por funil e dia + tamanho dos grupos + gasto em anuncio, pra pagina Funis. */
    async funis({ desde }: { desde: string }) {
      obrigatorio(desde, 'desde')
      const cliques: { em: string; de: string; destino: string }[] = []
      for (let i = 0; i < 100; i++) {
        const lote = await chamar(`bio_cliques?select=em,de,destino&em=gte.${enc(desde)}&order=id&offset=${i * 1000}&limit=1000`)
        cliques.push(...lote)
        if (lote.length < 1000) break
      }
      const [canais, investimentos] = await Promise.all([
        chamar('canais?select=id,nome,tipo,ativo&order=criado_em'),
        chamar(`investimentos?dia=gte.${enc(desde.slice(0, 10))}`),
      ])
      // por grupo: ultima medicao antes do periodo (base) e todas as do periodo
      const membros = await Promise.all(
        canais.map(async (c: { id: string }) => {
          const [antes, durante] = await Promise.all([
            chamar(`membros?select=medido_em,membros&canal_id=eq.${c.id}&medido_em=lt.${enc(desde)}&order=medido_em.desc&limit=1`),
            chamar(`membros?select=medido_em,membros&canal_id=eq.${c.id}&medido_em=gte.${enc(desde)}&order=medido_em&limit=2000`),
          ])
          return { canal_id: c.id, base: antes[0] ?? null, medicoes: durante }
        })
      )
      return { cliques, canais, membros, investimentos }
    },

    membros_medir: () => medirMembros(),

    async bio_resumo({ dias = 30 }: { dias?: number }) {
      const desde = new Date(Date.now() - Number(dias) * 86400e3).toISOString()
      const linhas: { de: string; destino: string }[] = []
      // pagina de 1000 em 1000 (teto do PostgREST)
      for (let i = 0; i < 50; i++) {
        const lote = await chamar(`bio_cliques?select=de,destino&em=gte.${enc(desde)}&order=id&offset=${i * 1000}&limit=1000`)
        linhas.push(...lote)
        if (lote.length < 1000) break
      }
      const resumo: Record<string, Record<string, number>> = {}
      for (const l of linhas) {
        resumo[l.de] ??= { visita: 0, whatsapp: 0, telegram: 0 }
        resumo[l.de][l.destino] = (resumo[l.de][l.destino] || 0) + 1
      }
      return { dias: Number(dias), resumo }
    },

    // ---------------------------------------------------------------- carrosseis (12h e 20h, gerados no GitHub Actions)
    carrosseis: () => chamar('carrosseis?order=dia.desc,turno.desc&limit=20'),

    async carrossel_postado({ id, postado = true }: { id: number; postado?: boolean }) {
      await chamar(`carrosseis?id=eq.${enc(String(obrigatorio(id, 'id')))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ postado_em: postado ? new Date().toISOString() : null }),
      })
      return { ok: true }
    },

    // ---------------------------------------------------------------- videos (gerados todo dia no GitHub Actions)
    videos: () => chamar('videos?order=dia.desc,id.desc&limit=60'),

    async video_postado({ id, postado = true }: { id: number; postado?: boolean }) {
      await chamar(`videos?id=eq.${enc(String(obrigatorio(id, 'id')))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ postado_em: postado ? new Date().toISOString() : null }),
      })
      return { ok: true }
    },

    // mesmo valor em todos os dias de "de" ate "ate" (um dia so: de = ate). valor 0 apaga.
    async investimento_salvar({ de, ate, valor, nota }: { de: string; ate?: string; valor: number; nota?: string }) {
      const ini = new Date(`${obrigatorio(de, 'de')}T12:00:00Z`)
      const fim = new Date(`${ate || de}T12:00:00Z`)
      if (isNaN(ini.getTime()) || isNaN(fim.getTime()) || fim < ini) throw new Error('Datas invalidas')
      const dias: string[] = []
      for (const d = new Date(ini); d <= fim && dias.length <= 400; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10))
      const v = Number(valor)
      if (!(v >= 0)) throw new Error('Valor invalido')
      if (v === 0) {
        await chamar(`investimentos?dia=in.(${dias.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      } else {
        await chamar('investimentos?on_conflict=dia', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(dias.map((dia) => ({ dia, valor: v, nota: nota || null, atualizado_em: new Date().toISOString() }))),
        })
      }
      return { ok: true, dias: dias.length }
    },

    // ---------------------------------------------------------------- acoes que ja existem no banco
    // fixar, desafixar, pular, voltar, bloquear_produto, bloquear_loja, desbloquear, pausar, retomar
    // "operacao" (e nao "acao"): o campo "acao" do corpo ja e o nome desta rota
    oferta_acao: ({ operacao, alvo, valor }: { operacao: string; alvo?: string; valor?: string }) =>
      acaoNoBanco(obrigatorio(operacao, 'operacao') as string, alvo ?? null, valor ?? null),

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

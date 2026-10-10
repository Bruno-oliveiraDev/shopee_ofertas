// Carrossel de DICAS (zero venda): conselho de mae pra mae sobre foto neutra (paisagem, familia, luz natural).
// Objetivo: prender pela identificacao e levar pro perfil por curiosidade, sem cara de anuncio.
// Sem produto, sem preco, sem link. O fecho so convida a salvar, mandar pra uma amiga e seguir o perfil.
//
// Cada tema: gancho (capa), 4 dicas {t: titulo curto, x: 1-2 frases}, legenda (texto do post).
// Saude: so o que e consenso das recomendacoes oficiais (SBP) e sempre "converse com o pediatra".

export const TEMAS = [
  {
    id: 'primeiro-mes',
    gancho: '4 coisas que eu queria ter ouvido no primeiro mês',
    dicas: [
      { t: 'Você não precisa saber tudo', x: 'Ninguém nasce sabendo. Você e o bebê estão aprendendo juntos, um dia de cada vez.' },
      { t: 'Aceite ajuda (de verdade)', x: 'Quando alguém oferecer, diga sim: uma comida pronta, uma louça lavada, uma hora de sono.' },
      { t: 'Não compare o seu bebê', x: 'Cada bebê tem o próprio ritmo. A rede social mostra o melhor minuto do dia dos outros.' },
      { t: 'A mãe também está nascendo', x: 'Cansaço, dúvida e choro fazem parte. Se a tristeza não passar em umas duas semanas, fale com um profissional.' },
    ],
    legenda: 'O primeiro mês é lindo e é difícil. As duas coisas são verdade ao mesmo tempo.',
  },
  {
    id: 'sono-seguro',
    gancho: 'Sono seguro do bebê: o que os pediatras recomendam',
    dicas: [
      { t: 'Sempre de barriga pra cima', x: 'Pra dormir, o bebê deve ser colocado de barriga pra cima, em todas as sonecas.' },
      { t: 'Berço vazio é berço seguro', x: 'Colchão firme e lençol bem ajustado. Sem travesseiro, protetor, almofada ou bichinhos.' },
      { t: 'Perto de você', x: 'O ideal é o berço no quarto dos pais nos primeiros meses, mas cada um na sua cama.' },
      { t: 'Ambiente sem fumaça', x: 'Nada de cigarro perto do bebê, nem dentro de casa. E roupa leve: bebê não precisa de muitas camadas pra dormir.' },
    ],
    legenda: 'Recomendações da Sociedade Brasileira de Pediatria. Qualquer dúvida, converse com o pediatra do seu bebê.',
  },
  {
    id: 'banho',
    gancho: 'Banho do bebê sem estresse (pra vocês dois)',
    dicas: [
      { t: 'Separe tudo antes', x: 'Toalha, fralda, roupinha e sabonete à mão antes de tirar a roupa do bebê.' },
      { t: 'Água morna, nunca quente', x: 'Teste no seu antebraço ou com termômetro: em torno de 36 a 37 °C.' },
      { t: 'Nem um segundo sozinho', x: 'Esqueceu algo? Leve o bebê enrolado na toalha com você. Acidente na água acontece em segundos.' },
      { t: 'Banho também é carinho', x: 'Fale, cante, olhe nos olhos. Para muitos bebês, é o momento mais calmo do dia.' },
    ],
    legenda: 'O banho não precisa ser corrido. Com tudo separado, vira um dos melhores momentos do dia.',
  },
  {
    id: 'visitas',
    gancho: 'Como lidar com as visitas depois do parto',
    dicas: [
      { t: 'Combine antes', x: 'Avise que as visitas serão curtas e marcadas. Quem ama vai entender.' },
      { t: 'Mãos lavadas, sempre', x: 'Pode pedir sem culpa: lavar as mãos antes de pegar o bebê. E sem beijo no rostinho.' },
      { t: 'Doente fica pra depois', x: 'Gripe, tosse ou febre? A visita pode esperar. A saúde do bebê vem primeiro.' },
      { t: 'Visita boa ajuda', x: 'A melhor visita traz comida, lava uma louça ou segura o bebê enquanto você toma banho.' },
    ],
    legenda: 'Colocar limite não é falta de educação. É cuidado com você e com o bebê.',
  },
  {
    id: 'autocuidado',
    gancho: 'Autocuidado de mãe em 5 minutos por dia',
    dicas: [
      { t: 'Água por perto', x: 'Deixe uma garrafa onde você mais fica com o bebê. Hidratar já é cuidar de você.' },
      { t: 'Comer de verdade', x: 'Deixe lanches fáceis prontos: fruta, castanha, iogurte. Mãe com fome fica sem paciência.' },
      { t: 'Um pouco de sol', x: 'Cinco minutos na janela ou no quintal mudam o humor do dia.' },
      { t: 'Peça uma pausa', x: 'Um banho sem pressa enquanto alguém fica com o bebê não é luxo, é necessidade.' },
    ],
    legenda: 'Você não consegue cuidar de ninguém se esquecer de você.',
  },
  {
    id: 'enxoval-esperto',
    gancho: 'O que ninguém te conta sobre o enxoval',
    dicas: [
      { t: 'O RN dura pouco', x: 'Muitos bebês perdem o tamanho RN em poucas semanas. Vale ter mais peças P e M.' },
      { t: 'Lave antes de usar', x: 'Toda roupinha nova deve ser lavada com sabão neutro antes do primeiro uso.' },
      { t: 'Prefira o simples', x: 'Peças de algodão, fáceis de vestir e de abrir na troca de fralda ganham de qualquer roupa enfeitada.' },
      { t: 'Compre aos poucos', x: 'Você vai descobrir do que o seu bebê precisa de verdade nas primeiras semanas.' },
    ],
    legenda: 'Enxoval não precisa ser enorme. Precisa ser útil.',
  },
  {
    id: 'rotina',
    gancho: '4 truques que salvam a rotina com bebê',
    dicas: [
      { t: 'Prepare na noite anterior', x: 'Bolsa arrumada e roupinhas separadas: a manhã começa mais leve.' },
      { t: 'Kit de troca espalhado', x: 'Um pouco de fralda e lenço em cada canto da casa evita correria.' },
      { t: 'Reveze as madrugadas', x: 'Se tiver com quem dividir, combine turnos. Dormir um bloco inteiro faz diferença.' },
      { t: 'Ritual antes de dormir', x: 'Banho, luz baixa, a mesma música. A repetição ajuda o bebê a entender que é hora de descansar.' },
    ],
    legenda: 'Não existe rotina perfeita. Existe a que funciona na sua casa.',
  },
  {
    id: 'frases',
    gancho: 'Frases que toda mãe precisa ouvir hoje',
    dicas: [
      { t: '“Você está fazendo o seu melhor”', x: 'E o seu melhor de hoje é suficiente.' },
      { t: '“Pedir ajuda não é fraqueza”', x: 'É sabedoria. Ninguém cria um filho sozinho.' },
      { t: '“Tudo bem não amar todas as fases”', x: 'Dá pra amar o filho e achar a fase difícil. As duas coisas cabem juntas.' },
      { t: '“Isso também vai passar”', x: 'As noites sem dormir, as cólicas, o cansaço. Um dia vira lembrança.' },
    ],
    legenda: 'Manda pra uma mãe que precisa ler isso hoje.',
  },
  {
    id: 'passeio',
    gancho: 'Primeiro passeio com o bebê: checklist rápido',
    dicas: [
      { t: 'Escolha o horário', x: 'Evite o sol forte do meio do dia. Começo da manhã ou fim da tarde costumam ser melhores.' },
      { t: 'Roupa em camadas', x: 'Fácil de tirar ou pôr conforme o tempo muda.' },
      { t: 'Bolsa do básico', x: 'Fraldas extras, lenços, uma muda de roupa e um saquinho pra roupa suja.' },
      { t: 'Água pra você', x: 'Quem cuida também precisa de água e de um lanche.' },
    ],
    legenda: 'Sair de casa com bebê dá trabalho no começo, depois vira costume. Comece com passeios curtos.',
  },
  {
    id: 'parceiro',
    gancho: 'Como o pai pode ajudar de verdade',
    dicas: [
      { t: 'Não é ajuda, é dividir', x: 'O bebê é dos dois. Trocar fralda, dar banho e fazer dormir é tarefa de quem também é responsável.' },
      { t: 'Assuma a casa', x: 'Comida, louça e roupa: tirar isso da mãe libera tempo pro descanso dela.' },
      { t: 'Cuide da madrugada', x: 'Buscar o bebê no berço, trocar a fralda e devolver dormindo já é muito.' },
      { t: 'Escute sem resolver', x: 'Às vezes ela só precisa desabafar. Ouvir com atenção também é cuidado.' },
    ],
    legenda: 'Marca aqui quem precisa ver isso 😉',
  },
  {
    id: 'quarto',
    gancho: 'Quarto do bebê prático (sem gastar muito)',
    dicas: [
      { t: 'Trocador na altura certa', x: 'Na altura da sua cintura, pra não forçar as costas dezenas de vezes por dia.' },
      { t: 'Organize por tamanho', x: 'Cestos ou divisórias separando RN, P e M: você acha tudo de madrugada.' },
      { t: 'Luz baixa à noite', x: 'Uma luz fraca ajuda a trocar e amamentar sem acordar o bebê de vez.' },
      { t: 'Menos é mais', x: 'Bebê precisa de um lugar seguro pra dormir, roupa limpa e colo. O resto é bônus.' },
    ],
    legenda: 'Quarto bonito é ótimo. Quarto prático é o que salva a madrugada.',
  },
  {
    id: 'choro',
    gancho: 'O choro do bebê: o que pode estar tentando dizer',
    dicas: [
      { t: 'Fome', x: 'Muitas vezes vem com o bebê levando a mão à boca ou virando o rosto procurando o peito.' },
      { t: 'Fralda ou desconforto', x: 'Fralda cheia, roupa apertada, calor ou frio. Vale checar o básico primeiro.' },
      { t: 'Sono', x: 'Bebê cansado demais também chora. Esfregar os olhos e bocejar são sinais.' },
      { t: 'Colo', x: 'Às vezes ele só quer você. Colo não estraga bebê. E se o choro parecer diferente ou vier com febre, procure o pediatra.' },
    ],
    legenda: 'Com o tempo você aprende a diferença entre um choro e outro. Tenha paciência com você.',
  },
];

/** Tema do dia: reveza pelo dia do ano (um diferente por dia, ciclo de 12 dias). */
export function temaDoDia(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  const doAno = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
  return TEMAS[doAno % TEMAS.length];
}

const HASHTAGS = '#maternidade #maedeprimeiraviagem #dicasdemae #bebe #maternidadereal';

export function legendaDicas(tema) {
  return [
    `${tema.gancho} 👇`,
    '',
    ...tema.dicas.map((d, i) => `${i + 1}. ${d.t}: ${d.x}`),
    '',
    tema.legenda,
    '',
    '💛 Salva pra lembrar e manda pra uma mãe que precisa ver isso.',
    'Segue o perfil: toda semana tem dica de mãe pra mãe.',
    '',
    HASHTAGS,
  ].join('\n');
}

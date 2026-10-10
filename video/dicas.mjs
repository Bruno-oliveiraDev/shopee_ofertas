// Carrossel de DICAS (zero venda): conselho de mae pra mae sobre foto neutra (paisagem, familia, luz natural).
// Objetivo: prender pela identificacao e levar pro perfil por curiosidade, sem cara de anuncio.
// Sem produto, sem preco, sem link. O fecho so convida a salvar, mandar pra uma amiga e seguir o perfil.
//
// Cada tema: gancho (capa), 4 dicas {t: titulo curto, x: 1-2 frases}, legenda (texto do post).
// Saude: so o que e consenso das recomendacoes oficiais (SBP) e sempre "converse com o pediatra".

export const TEMAS = [
  // ---------- 12 temas atuais, reescritos ----------
  {
    id: 'primeiro-mes',
    gancho: 'Primeiro mês com bebê: 4 coisas que alguém precisava ter te dito',
    dicas: [
      { t: 'Ninguém nasce sabendo', x: 'Você e o bebê estão aprendendo juntos. Errar, ajustar e tentar de novo faz parte.' },
      { t: 'Aceite ajuda (de verdade)', x: 'Se alguém oferecer, diga sim: uma comida pronta, uma louça lavada, uma hora de sono.' },
      { t: 'Não compare o seu bebê', x: 'Cada bebê tem o próprio ritmo. A rede social mostra o melhor minuto do dia dos outros.' },
      { t: 'Tristeza que não passa? Fale', x: 'Choro e cansaço nos primeiros dias são comuns. Se durar mais de 2 semanas, procure ajuda.' },
    ],
    legenda: 'O primeiro mês é lindo e é difícil. As duas coisas são verdade ao mesmo tempo.',
  },
  {
    id: 'sono-seguro',
    gancho: 'O berço mais seguro é o mais sem graça',
    dicas: [
      { t: 'Sempre de barriga pra cima', x: 'Em toda soneca, de dia e de noite. É a recomendação da Sociedade Brasileira de Pediatria.' },
      { t: 'Berço vazio', x: 'Colchão firme e lençol bem ajustado. Sem travesseiro, protetor, naninha ou bichinho.' },
      { t: 'No seu quarto, na cama dele', x: 'Nos primeiros meses, o ideal é o berço no quarto dos pais. Mas cada um na sua cama.' },
      { t: 'Sem fumaça, sem calor demais', x: 'Nada de cigarro perto do bebê. E roupa leve: ele não precisa de muitas camadas pra dormir.' },
    ],
    legenda: 'Recomendações da Sociedade Brasileira de Pediatria. Qualquer dúvida, converse com o pediatra do seu bebê.',
  },
  {
    id: 'banho',
    gancho: 'O banho do bebê tem 1 regra que não pode quebrar',
    dicas: [
      { t: 'Nem um segundo sozinho', x: 'Esqueceu algo? Leve o bebê enrolado na toalha. Afogamento é rápido e não faz barulho.' },
      { t: 'Separe tudo antes', x: 'Toalha, fralda, roupinha e sabonete à mão antes de tirar a roupa do bebê.' },
      { t: 'Água morna, nunca quente', x: 'Teste no seu antebraço ou com termômetro: em torno de 36 a 37 °C.' },
      { t: 'Banho também é carinho', x: 'Fale, cante, olhe nos olhos. Para muitos bebês, é o momento mais calmo do dia.' },
    ],
    legenda: 'Com tudo separado antes, o banho deixa de ser correria e vira um dos melhores momentos do dia.',
  },
  {
    id: 'visitas',
    gancho: 'Manda pra família antes do bebê nascer: as 4 regras da visita',
    dicas: [
      { t: 'Visita é combinada', x: 'Avise antes que as visitas serão curtas e marcadas. Quem ama vai entender.' },
      { t: 'Mãos lavadas, sempre', x: 'Pode pedir sem culpa: lavar as mãos antes de pegar o bebê. E nada de beijo no rostinho.' },
      { t: 'Doente fica pra depois', x: 'Gripe, tosse ou febre? A visita pode esperar. A saúde do bebê vem primeiro.' },
      { t: 'Visita boa ajuda', x: 'A melhor visita traz comida, lava uma louça ou segura o bebê enquanto a mãe toma banho.' },
    ],
    legenda: 'Colocar limite não é falta de educação. É cuidado com a mãe e com o bebê.',
  },
  {
    id: 'autocuidado',
    gancho: 'Você bebeu água hoje? 4 cuidados que cabem no cochilo do bebê',
    dicas: [
      { t: 'Garrafa sempre por perto', x: 'Deixe água onde você mais fica com o bebê. Se amamenta, a sede aparece na hora da mamada.' },
      { t: 'Comida que não dá trabalho', x: 'Deixe lanches fáceis à vista: fruta, iogurte, pão com ovo. Mãe com fome fica sem paciência.' },
      { t: 'Cinco minutos de luz do dia', x: 'Na janela, na varanda ou no quintal. Ver o céu muda o humor do dia.' },
      { t: 'Um banho sem pressa', x: 'Peça pra alguém ficar com o bebê. Não é luxo, é necessidade.' },
    ],
    legenda: 'Você não consegue cuidar de ninguém se esquecer de você.',
  },
  {
    id: 'enxoval-esperto',
    gancho: 'Não compre muita roupa RN. E mais 3 verdades do enxoval',
    dicas: [
      { t: 'O RN dura pouco', x: 'Muitos bebês perdem o tamanho RN em poucas semanas. Vale ter mais peças P e M.' },
      { t: 'Lave antes de usar', x: 'Toda roupinha nova deve ser lavada com sabão neutro antes do primeiro uso.' },
      { t: 'Prefira o simples', x: 'Algodão, fácil de vestir e de abrir na troca de fralda. Ganha de qualquer roupa enfeitada.' },
      { t: 'Compre aos poucos', x: 'Nas primeiras semanas você descobre do que o seu bebê precisa de verdade.' },
    ],
    legenda: 'Enxoval não precisa ser enorme. Precisa ser útil.',
  },
  {
    id: 'rotina',
    gancho: 'Fralda em cada canto da casa e mais 3 truques de rotina',
    dicas: [
      { t: 'Kit de troca em cada canto', x: 'Umas fraldas e um pacote de lenço no quarto, na sala e na bolsa. Acaba a correria.' },
      { t: 'A manhã começa na véspera', x: 'Bolsa arrumada e roupinha separada à noite. O dia seguinte começa mais leve.' },
      { t: 'Revezem a madrugada', x: 'Se tiver com quem dividir, combinem turnos. Dormir um bloco inteiro faz muita diferença.' },
      { t: 'O mesmo ritual pra dormir', x: 'Banho, luz baixa, a mesma música. A repetição ajuda o bebê a entender que é hora de descansar.' },
    ],
    legenda: 'Não existe rotina perfeita. Existe a que funciona na sua casa.',
  },
  {
    id: 'frases',
    gancho: 'Se o seu dia foi difícil, lê isso antes de dormir',
    dicas: [
      { t: '“Você está fazendo o seu melhor”', x: 'E o seu melhor de hoje é suficiente.' },
      { t: '“Pedir ajuda não é fraqueza”', x: 'É sabedoria. Ninguém cria um filho sozinha.' },
      { t: '“Pode não amar todas as fases”', x: 'Dá pra amar o filho e achar a fase difícil. As duas coisas cabem juntas.' },
      { t: '“Isso também vai passar”', x: 'As noites sem dormir, as cólicas, o cansaço. Um dia vira lembrança.' },
    ],
    legenda: 'Tem dia que a gente só precisa ler que está tudo bem não dar conta de tudo.',
  },
  {
    id: 'passeio',
    gancho: 'Primeiro passeio com o bebê? Printa isso antes de sair',
    dicas: [
      { t: 'Fuja do sol forte', x: 'Prefira o começo da manhã ou o fim da tarde. Antes dos 6 meses, sombra e roupa leve.' },
      { t: 'Roupa em camadas', x: 'Fácil de tirar ou pôr conforme o tempo muda. Bebê costuma usar uma camada a mais que você.' },
      { t: 'Bolsa do básico', x: 'Fraldas extras, lenços, uma muda de roupa e um saquinho pra roupa suja.' },
      { t: 'Água e lanche pra você', x: 'Quem cuida também precisa comer e beber. Comece com passeios curtos.' },
    ],
    legenda: 'Sair de casa com bebê dá trabalho no começo. Depois vira costume.',
  },
  {
    id: 'parceiro',
    gancho: 'Pai não ajuda. Pai divide. (4 coisas que são dele também)',
    dicas: [
      { t: 'Cuidar do bebê é dos dois', x: 'Trocar fralda, dar banho e fazer dormir é tarefa de quem também é pai.' },
      { t: 'Assumir a casa', x: 'Comida, louça e roupa: tirar isso da mãe libera tempo pro descanso dela.' },
      { t: 'Pegar a madrugada', x: 'Buscar o bebê no berço, trocar a fralda e devolver dormindo já é muito.' },
      { t: 'Escutar sem resolver', x: 'Às vezes ela só precisa desabafar. Ouvir com atenção também é cuidado.' },
    ],
    legenda: 'Ninguém “ajuda” a cuidar do próprio filho. Divide.',
  },
  {
    id: 'quarto',
    gancho: 'O quarto que salva a madrugada não é o do Pinterest',
    dicas: [
      { t: 'Trocador na altura certa', x: 'Na altura da sua cintura, pra não forçar as costas dezenas de vezes por dia.' },
      { t: 'Organize por tamanho', x: 'Cestos separando RN, P e M. De madrugada, você acha tudo sem acender a luz forte.' },
      { t: 'Luz baixa à noite', x: 'Uma luz fraca ajuda a trocar e amamentar sem acordar o bebê de vez.' },
      { t: 'Berço vazio e firme', x: 'O enfeite fica na parede. Dentro do berço, só colchão firme e lençol ajustado.' },
    ],
    legenda: 'Quarto bonito é ótimo. Quarto prático é o que salva a madrugada.',
  },
  {
    id: 'choro',
    gancho: 'Bebê chorando e você já tentou de tudo? Confere nessa ordem',
    dicas: [
      { t: '1º: fome', x: 'Mão na boca, cabeça virando pra procurar o peito, boquinha abrindo. Às vezes vem antes do choro.' },
      { t: '2º: fralda, calor ou frio', x: 'Fralda cheia, roupa apertada, etiqueta incomodando. Vale checar o básico.' },
      { t: '3º: sono demais', x: 'Bebê cansado demais também chora. Esfregar os olhos e bocejar são sinais.' },
      { t: '4º: às vezes é só colo', x: 'Colo não estraga bebê. Se o choro vier com febre ou moleza, procure o pediatra.' },
    ],
    legenda: 'Com o tempo você aprende a diferença entre um choro e outro. Tenha paciência com você.',
  },

  // ---------- 12 temas novos ----------
  {
    id: 'cadeirinha',
    gancho: 'A lei deixa virar a cadeirinha cedo. Pediatras pedem mais tempo',
    dicas: [
      { t: 'De costas protege mais', x: 'Virado pra trás, cabeça e pescoço ficam mais protegidos numa freada ou batida.' },
      { t: 'Vire pelo manual, não pela data', x: 'Mantenha de costas até o limite de peso e altura do fabricante. Pediatras sugerem ao menos 2 anos.' },
      { t: 'Sempre no banco de trás', x: 'Cadeirinha bem presa no banco de trás. Criança no colo, nunca, nem em trajeto curto.' },
      { t: 'Cinto justo, sem casaco', x: 'Tiras rentes ao corpo e sem casaco grosso por baixo. Se der pra beliscar a tira, está folgada.' },
    ],
    legenda: 'A lei (Resolução Contran 819/2021) é o mínimo. A Sociedade Brasileira de Pediatria recomenda o bebê de costas por mais tempo. Leia o manual da sua cadeirinha e converse com o pediatra.',
  },
  {
    id: 'andador',
    gancho: 'O item de bebê que os pediatras pedem pra não usar',
    dicas: [
      { t: 'É o andador', x: 'A Sociedade Brasileira de Pediatria desaconselha o andador, em qualquer idade.' },
      { t: 'O perigo é a queda', x: 'A maior parte dos acidentes com andador é queda, muitas vezes de escada. Pode ser grave.' },
      { t: 'Não ensina a andar', x: 'O bebê aprende no chão, no tempo dele: rolando, engatinhando e se apoiando nos móveis.' },
      { t: 'Chão livre, com você perto', x: 'Um tapete, brinquedos seguros e alguém olhando. É disso que ele precisa pra se mexer.' },
    ],
    legenda: 'Muita gente ganha andador de presente sem saber. Na dúvida sobre o desenvolvimento do seu bebê, converse com o pediatra.',
  },
  {
    id: 'prato-do-bebe',
    gancho: '4 coisas fora do prato do bebê (nem com a vó insistindo)',
    dicas: [
      { t: 'Mel antes de 1 ano', x: 'Nem um pouquinho, nem na chupeta. Pode causar botulismo, uma doença grave em bebês.' },
      { t: 'Açúcar antes dos 2 anos', x: 'O Ministério da Saúde orienta zero açúcar até os 2: nem no suco, nem no leite, nem no mingau.' },
      { t: 'Café e chá preto, mate, verde', x: 'Têm cafeína e não são pra bebê. Antes de oferecer qualquer chá, pergunte ao pediatra.' },
      { t: 'Ultraprocessados', x: 'Biscoito recheado, salgadinho, refrigerante e suco de caixinha ficam fora até os 2 anos.' },
    ],
    legenda: 'Base: Guia Alimentar para Crianças Brasileiras Menores de 2 Anos (Ministério da Saúde). Qualquer dúvida sobre a introdução alimentar, converse com o pediatra.',
  },
  {
    id: 'engasgo',
    gancho: 'Uva inteira não é comida de criança pequena. Corta assim',
    dicas: [
      { t: 'No comprimento, em 4', x: 'Uva e tomatinho cortados em 4 no sentido do comprimento. Redondo e inteiro é o que mais trava.' },
      { t: 'Comer é sentado', x: 'Nada de comer andando, correndo, deitado ou no carro.' },
      { t: 'Sempre com adulto olhando', x: 'Engasgo pode não fazer barulho nenhum. Fique perto durante toda a refeição.' },
      { t: 'Aprenda a manobra', x: 'Faça um curso de primeiros socorros pra bebês. Manobra se aprende com profissional, não em post.' },
    ],
    legenda: 'Segundo a Sociedade Brasileira de Pediatria, mais da metade das mortes por engasgo no Brasil acontecem em crianças menores de 4 anos. Prevenir começa no corte.',
  },
  {
    id: 'telas',
    gancho: 'Zero tela antes dos 2 anos. E quando você precisa de 10 minutos?',
    dicas: [
      { t: 'O que a SBP recomenda', x: 'Antes dos 2 anos, nenhuma tela, nem TV ligada de fundo. Chamada de vídeo com a família, com você junto.' },
      { t: 'Cesto de tesouros', x: 'Colher de pau, pote com tampa, pano colorido. Coisas grandes e seguras, com você no cômodo.' },
      { t: 'Deixa ele ver você', x: 'No cadeirão ou no chão por perto enquanto você cozinha. Contar o que está fazendo já estimula.' },
      { t: 'Sem culpa', x: 'É uma meta, não uma prova. Comece trocando um momento de tela por dia.' },
    ],
    legenda: 'Recomendação da Sociedade Brasileira de Pediatria (atualização de 2024). Cada casa tem a sua realidade: o que dá pra fazer hoje já conta.',
  },
  {
    id: 'mala-maternidade',
    gancho: 'Mala da maternidade: printa esse checklist',
    dicas: [
      { t: 'Documentos', x: 'RG, cartão do pré-natal com os exames, cartão do SUS ou do convênio.' },
      { t: 'Pro bebê', x: 'Bodies, macacões, meias, touca, manta e fraldas RN. E a roupinha de saída.' },
      { t: 'Pra você', x: 'Camisola que abre na frente, sutiã de amamentação, absorvente pós-parto, chinelo e higiene.' },
      { t: 'Pro acompanhante', x: 'Muda de roupa, carregador de celular, lanche e garrafinha de água.' },
    ],
    legenda: 'Cada maternidade pede uma coisa: confirme a lista da sua antes de fechar a mala. Deixe pronta umas semanas antes da data.',
  },
  {
    id: 'frases-ouvidas',
    gancho: '“Esse leite é fraco” e mais 3 frases que toda mãe ouve',
    dicas: [
      { t: '“Esse leite é fraco”', x: 'Não existe leite materno fraco. Ele muda conforme o bebê precisa. Dúvida no peso? Pediatra.' },
      { t: '“Colo vicia”', x: 'Colo não estraga bebê. Ele está se acostumando com um mundo novo, e você é o lugar seguro dele.' },
      { t: '“Dá um chazinho”', x: 'Até os 6 meses, quem mama no peito só precisa do leite materno: nem água, nem chá.' },
      { t: '“Já devia dormir a noite toda”', x: 'Cada bebê tem o seu ritmo. Acordar à noite nos primeiros meses é esperado.' },
    ],
    legenda: 'Dá pra responder com carinho e sem briga. E na dúvida, a palavra final é do pediatra, não do palpite.',
  },
  {
    id: 'carga-mental',
    gancho: 'Ninguém vê esse trabalho. Manda pro pai do seu bebê',
    dicas: [
      { t: 'Lembrar de tudo', x: 'Da vacina, da consulta, do remédio na hora certa e do aniversário da prima.' },
      { t: 'Perceber antes de acabar', x: 'Que a fralda está no fim, que a roupa ficou pequena, que o lencinho acabou.' },
      { t: 'Planejar o dia seguinte', x: 'O que ele come amanhã, a bolsa da creche, a roupa do passeio, a lista do mercado.' },
      { t: 'Dividir é assumir', x: 'Pegar uma tarefa do começo ao fim, sem esperar ela pedir ou lembrar. Isso é dividir.' },
    ],
    legenda: 'Esse trabalho não aparece em foto, mas cansa. Dividir também é dividir o pensar.',
  },
  {
    id: 'puerperio',
    gancho: 'Quando o cansaço do pós-parto não é só cansaço',
    dicas: [
      { t: 'Os primeiros dias', x: 'Choro fácil e emoção à flor da pele logo depois do parto são comuns e costumam passar.' },
      { t: 'Quando prestar atenção', x: 'Se a tristeza durar mais de 2 semanas ou piorar, não é frescura. Procure o posto ou o seu médico.' },
      { t: 'Sinais de alerta', x: 'Desânimo o dia todo, culpa forte, não sentir vínculo ou pensar em se machucar: peça ajuda.' },
      { t: 'Precisa falar agora?', x: 'O CVV atende 24 horas, de graça, pelo telefone 188. Você não precisa passar por isso sozinha.' },
    ],
    legenda: 'Pedir ajuda no pós-parto é cuidado com você e com o bebê. Converse com quem te acompanha no pré-natal ou no posto de saúde.',
  },
  {
    id: 'caderneta',
    gancho: 'A Caderneta da Criança tem páginas que quase ninguém usa',
    dicas: [
      { t: 'Peso e altura', x: 'Os gráficos mostram como o bebê está crescendo. Peça pra marcarem em toda consulta.' },
      { t: 'Marcos do desenvolvimento', x: 'Sorrir, sentar, falar: tem o que é esperado em cada idade. Dá pra acompanhar e anotar dúvidas.' },
      { t: 'Vacinas', x: 'O calendário fica registrado ali. Confira as próximas datas e leve a caderneta em toda vacina.' },
      { t: 'Leve sempre', x: 'Na consulta, na vacina, no pronto-socorro. É o documento de saúde do seu filho.' },
    ],
    legenda: 'A Caderneta da Criança é do Ministério da Saúde e é entregue na maternidade. Perdeu a sua? Pergunte no posto de saúde.',
  },
  {
    id: 'brincar-0-6',
    gancho: 'Bebê de 0 a 6 meses não precisa de brinquedo caro. Precisa disso',
    dicas: [
      { t: 'A sua voz', x: 'Converse, cante, conte o que você está fazendo. Ele aprende a falar ouvindo você.' },
      { t: 'Barriguinha pra baixo', x: 'Acordado e com você olhando, alguns minutos por dia. Ajuda a fortalecer pescoço e costas.' },
      { t: 'O seu rosto', x: 'Bebê adora olhar rosto de perto. Faça careta, sorria e espere ele responder.' },
      { t: 'Coisas pra pegar', x: 'Objetos grandes e seguros, que não caibam inteiros na boca. Pegar e soltar já é brincar.' },
    ],
    legenda: 'Pra dormir, sempre de barriga pra cima. Barriguinha pra baixo é só acordado e com alguém olhando.',
  },
  {
    id: 'febre-anota',
    gancho: 'Bebê com febre: anota isso antes de ligar pro pediatra',
    dicas: [
      { t: 'Temperatura e horário', x: 'Quanto deu no termômetro e a que horas você mediu. Anote cada medida.' },
      { t: 'Remédio que já deu', x: 'Nome, dose e horário. E nunca dê remédio sem orientação do pediatra.' },
      { t: 'Como ele está', x: 'Mamando? Fazendo xixi? Manchas na pele, moleza ou respiração difícil: procure atendimento.' },
      { t: 'Menos de 3 meses? Vá logo', x: 'Febre em bebê com menos de 3 meses: procure atendimento na hora, sem esperar.' },
    ],
    legenda: 'Essa lista não substitui o pediatra: ela ajuda você a explicar tudo com calma na hora da ligação ou da consulta.',
  },
];

// Saude que ainda precisa de revisao humana antes de ir pro ar (fonte primaria da SBP, tema sensivel): fora do rodizio.
const REVISAR = new Set(['cadeirinha', 'engasgo', 'puerperio', 'febre-anota']);
export const ATIVOS = TEMAS.filter((t) => !REVISAR.has(t.id));

/** Tema do dia: reveza pelo dia do ano (um diferente por dia, ciclo de ATIVOS.length dias). */
export function temaDoDia(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  const doAno = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400e3);
  return ATIVOS[doAno % ATIVOS.length];
}

const HASHTAGS = '#maternidade #maedeprimeiraviagem #dicasdemae #bebe #maternidadereal';

/** Legenda: a 1a linha repete o gancho da capa (que pode ser outro dos GANCHOS do tema). */
export function legendaDicas(tema, gancho = tema.gancho) {
  return [
    `${gancho.replace(/\*/g, '')} 👇`,
    '',
    ...tema.dicas.map((d, i) => `${i + 1}. ${d.t}: ${d.x}`),
    '',
    tema.legenda,
    '',
    '💛 Salva pra reler e manda pra quem precisa ver isso hoje.',
    'Grupo de achados de bebê: link na bio.',
    '',
    HASHTAGS,
  ].join('\n');
}

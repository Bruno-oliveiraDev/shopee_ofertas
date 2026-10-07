// Gera um video vertical (1080x1920, ~12-15 s) de uma oferta, so com a foto do produto:
// fundo desfocado + foto com zoom lento + textos por cena + narracao (Piper) + selo de desconto.
// Mesmo codigo roda no computador (Windows) e no GitHub Actions (Linux).
//
// Uso: node video/gerar-video.mjs oferta.json pasta-de-saida
// Variaveis: PIPER_BIN (piper executavel), PIPER_VOICE (.onnx), FONTE_FORTE e FONTE_MEDIA (.ttf)
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { roteiro, textoDoPost } from './roteiro.mjs';

const W = 1080;
const H = 1920;
const FPS = 30;
const FOLGA = 0.35; // respiro entre uma fala e outra (s)

function rodar(cmd, args, { entrada, cwd } = {}) {
  return new Promise((ok, falhou) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let erro = '';
    let saida = '';
    p.stdout.on('data', (d) => (saida += d));
    p.stderr.on('data', (d) => (erro += d));
    p.on('error', falhou);
    p.on('close', (codigo) => (codigo === 0 ? ok(saida) : falhou(new Error(`${path.basename(cmd)} saiu com ${codigo}: ${erro.slice(-800)}`))));
    if (entrada !== undefined) {
      p.stdin.write(entrada);
      p.stdin.end();
    }
  });
}

async function duracao(arquivo) {
  const s = await rodar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo]);
  return Number(s.trim());
}

/** Narracao de cada cena com o Piper; devolve a duracao de cada fala. */
async function narrar(cenas, pasta) {
  const bin = process.env.PIPER_BIN || 'piper';
  const voz = process.env.PIPER_VOICE;
  if (!voz) throw new Error('Defina PIPER_VOICE (arquivo .onnx da voz)');

  for (const [i, cena] of cenas.entries()) {
    const wav = path.join(pasta, `fala-${i}.wav`);
    // length_scale < 1 deixa a fala um pouco mais rapida, no ritmo de video curto
    // roda de dentro da pasta do Piper: e la que ele acha os dados de pronuncia (espeak-ng-data)
    await rodar(bin, ['--model', voz, '--output_file', path.resolve(wav), '--length_scale', '0.92', '--sentence_silence', '0.05'], { entrada: cena.fala, cwd: path.dirname(bin) === '.' ? undefined : path.dirname(bin) });
    cena.dur = (await duracao(wav)) + FOLGA;
  }

  // junta as falas com o respiro no fim de cada uma
  const entradas = cenas.flatMap((_, i) => ['-i', path.join(pasta, `fala-${i}.wav`)]);
  const filtro =
    cenas.map((c, i) => `[${i}:a]aresample=44100,apad=pad_dur=${FOLGA}[a${i}]`).join(';') +
    ';' + cenas.map((_, i) => `[a${i}]`).join('') + `concat=n=${cenas.length}:v=0:a=1[a]`;
  await rodar('ffmpeg', ['-y', ...entradas, '-filter_complex', filtro, '-map', '[a]', path.join(pasta, 'narracao.wav')]);

  let t = 0;
  for (const c of cenas) {
    c.ini = t;
    t += c.dur;
    c.fim = t;
  }
  return t;
}

/** Quebra o texto em linhas de ate N caracteres (o drawtext do FFmpeg nao quebra sozinho). */
function quebrar(texto, max) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    if ((atual + ' ' + palavra).trim().length > max && atual) {
      linhas.push(atual);
      atual = palavra;
    } else atual = (atual + ' ' + palavra).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarVideo(oferta, pasta) {
  await mkdir(pasta, { recursive: true });

  // fontes e imagem ficam dentro da pasta: o FFmpeg le por nome curto (foge do "C:" no filtro)
  await copyFile(process.env.FONTE_FORTE, path.join(pasta, 'forte.ttf'));
  await copyFile(process.env.FONTE_MEDIA, path.join(pasta, 'media.ttf'));
  const foto = await fetch(oferta.imagem);
  if (!foto.ok) throw new Error(`Foto da oferta nao baixou (${foto.status})`);
  await writeFile(path.join(pasta, 'foto.jpg'), Buffer.from(await foto.arrayBuffer()));

  const cenas = roteiro(oferta);
  const total = await narrar(cenas, pasta);
  const quadros = Math.ceil(total * FPS);

  // cada texto vai num arquivo (drawtext textfile=) pra acento, cifrao e virgula nao precisarem de escape
  const textos = [];
  const texto = async (conteudo, opcoes) => {
    const nome = `t${textos.length}.txt`;
    await writeFile(path.join(pasta, nome), conteudo, 'utf8');
    // expansion=none: sem isso o "%" de "-79%" vira comando do FFmpeg e o texto some
    textos.push(`drawtext=textfile=${nome}:expansion=none:${opcoes}`);
  };
  const entre = (c) => `enable='between(t,${c.ini.toFixed(2)},${c.fim.toFixed(2)})'`;

  for (const c of cenas) {
    if (c.titulo) {
      // titulo grande no topo, em faixa branca
      // no maximo 2 linhas: a 3a invadiria a foto
      const linhas = quebrar(c.titulo, 19).slice(0, 2);
      for (const [i, l] of linhas.entries()) {
        await texto(l, `fontfile=forte.ttf:fontsize=80:fontcolor=0x1C1830:box=1:boxcolor=white@0.96:boxborderw=22:x=(w-text_w)/2:y=${170 + i * 122}:${entre(c)}`);
      }
    }
    if (c.preco) {
      // cena do preco: "de" riscado + "por" enorme na parte de baixo
      await texto(`de ${c.preco.de}`, `fontfile=media.ttf:fontsize=58:fontcolor=white:box=1:boxcolor=0x1C1830@0.75:boxborderw=14:x=(w-text_w)/2:y=1500:${entre(c)}`);
      textos.push(`drawbox=x=${W / 2 - 190}:y=1536:w=380:h=7:color=0xFF4D4D:t=fill:${entre(c)}`);
      await texto(`por ${c.preco.por}`, `fontfile=forte.ttf:fontsize=118:fontcolor=white:box=1:boxcolor=0x0E9F5B:boxborderw=26:x=(w-text_w)/2:y=1630:${entre(c)}`);
    }
    if (c.rodape) {
      await texto(c.rodape, `fontfile=forte.ttf:fontsize=64:fontcolor=white:box=1:boxcolor=0x0E9F5B:boxborderw=20:x=(w-text_w)/2:y=1560:${entre(c)}`);
    }
  }

  // selo de desconto sempre visivel, no canto da foto
  if (oferta.desconto > 0) {
    await texto(`-${oferta.desconto}%`, `fontfile=forte.ttf:fontsize=92:fontcolor=white:box=1:boxcolor=0xEE4D2D:boxborderw=20:x=w-text_w-90:y=600`);
  }
  // marca discreta embaixo
  await texto('Achadinhos Kids', `fontfile=media.ttf:fontsize=38:fontcolor=white@0.85:x=(w-text_w)/2:y=h-110`);

  const filtro = [
    // fundo: a propria foto, ampliada, desfocada e escurecida
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=28:4,eq=brightness=-0.18:saturation=1.15,setsar=1[fundo]`,
    // foto do produto quadrada, com zoom lento (efeito Ken Burns)
    `[0:v]scale=1600:1600:force_original_aspect_ratio=increase,crop=1600:1600,zoompan=z='1+0.0009*in':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=940x940:fps=${FPS},setsar=1[foto]`,
    `[fundo][foto]overlay=(W-w)/2:520:shortest=1[base]`,
    `[base]${textos.join(',')},format=yuv420p[v]`,
  ].join(';');

  await rodar(
    'ffmpeg',
    [
      '-y', '-loop', '1', '-framerate', String(FPS), '-i', 'foto.jpg', '-i', 'narracao.wav',
      '-filter_complex', filtro, '-map', '[v]', '-map', '1:a',
      '-frames:v', String(quadros), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'video.mp4',
    ],
    { cwd: pasta }
  );

  const post = textoDoPost(oferta);
  await writeFile(path.join(pasta, 'post.txt'), post, 'utf8');
  return { video: path.join(pasta, 'video.mp4'), post, duracao: total, cenas: cenas.map((c) => c.fala) };
}

// uso pela linha de comando
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const oferta = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const r = await gerarVideo(oferta, path.resolve(process.argv[3] || 'saida-video'));
  console.log(JSON.stringify(r, null, 2));
}

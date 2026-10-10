// Story animado da historinha do carrossel: as 5 telas (1080x1920) viram um video de ~15 s.
// Cada tela entra com zoom lento e passa pra proxima deslizando pro lado (como quem arrasta um story).
// Com PIPER_VOICE, narra a historia (gancho, as 3 cenas e o fecho); sem, sai mudo com tempo fixo por tela.
//
// Uso direto (teste): node video/story-animado.mjs pasta-com-01..05-story.jpg
// Variaveis opcionais: PIPER_BIN (executavel do Piper), PIPER_VOICE (.onnx)
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const W = 1080;
const H = 1920;
const FPS = 30;
const TRANSICAO = 0.4; // segundos do deslize entre uma tela e outra
const MUDO = [3.4, 3, 3, 3, 3.8]; // tempo de cada tela quando nao ha narracao
const FOLGA = 0.6; // respiro depois de cada fala

function rodar(cmd, args, { entrada, cwd } = {}) {
  return new Promise((ok, falhou) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let erro = '';
    let saida = '';
    p.stdout.on('data', (d) => (saida += d));
    p.stderr.on('data', (d) => (erro += d));
    p.on('error', falhou);
    p.on('close', (c) => (c === 0 ? ok(saida) : falhou(new Error(`${path.basename(cmd)} saiu com ${c}: ${erro.slice(-600)}`))));
    if (entrada !== undefined) {
      p.stdin.write(entrada);
      p.stdin.end();
    }
  });
}

const duracao = async (arquivo) =>
  Number((await rodar('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo])).trim());

/** Texto falado de cada tela: gancho, as 3 cenas (sem reticencias e numeracao) e o fecho com o convite. */
export function falas(historia, frases) {
  const limpa = (t) => t.replace(/^\d+\.\s*/, '').replace(/…/g, '').trim();
  return [historia.fala.gancho, ...frases.map(limpa), `${historia.fala.fecho} O link do grupo tá na bio.`];
}

/** Narra cada fala com o Piper; devolve o arquivo de cada uma (ou null se nao tiver Piper). */
async function narrar(textos, pasta) {
  const voz = process.env.PIPER_VOICE;
  if (!voz) return null;
  const bin = process.env.PIPER_BIN || 'piper';
  const wavs = [];
  for (const [i, texto] of textos.entries()) {
    const wav = path.resolve(pasta, `story-fala-${i}.wav`);
    // o Piper acha os dados de pronuncia (espeak-ng-data) rodando de dentro da pasta dele
    await rodar(bin, ['--model', voz, '--output_file', wav, '--length_scale', '0.95', '--sentence_silence', '0.1'], {
      entrada: texto,
      cwd: path.dirname(bin) === '.' ? undefined : path.dirname(bin),
    });
    wavs.push(wav);
  }
  return wavs;
}

export async function storyAnimado({ historia, frases, quadros, pasta }) {
  const wavs = await narrar(falas(historia, frases), pasta);
  // tempo de cada tela: a fala + respiro (nunca menos que o tempo do modo mudo menos 0,6 s)
  const dur = wavs
    ? await Promise.all(wavs.map(async (w, i) => Math.max(MUDO[i] - 0.6, (await duracao(w)) + FOLGA + TRANSICAO)))
    : [...MUDO];

  // cada tela: imagem parada -> zoom lento de 1,00 a ~1,05 durante o tempo dela
  const entradas = quadros.flatMap((q) => ['-i', q]);
  const filtros = quadros.map((_, i) => {
    const n = Math.round(dur[i] * FPS);
    return `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.05*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1[t${i}]`;
  });
  // deslize pro lado entre as telas
  let anterior = 't0';
  let fim = dur[0];
  for (let i = 1; i < quadros.length; i++) {
    const saida = i === quadros.length - 1 ? 'v' : `x${i}`;
    filtros.push(`[${anterior}][t${i}]xfade=transition=slideleft:duration=${TRANSICAO}:offset=${(fim - TRANSICAO).toFixed(3)}[${saida}]`);
    fim += dur[i] - TRANSICAO;
    anterior = saida;
  }
  filtros.push('[v]format=yuv420p[vf]');

  const args = ['-y', ...entradas];
  const mapa = ['-map', '[vf]'];
  if (wavs) {
    // cada fala comeca quando a tela dela termina de entrar e ocupa o tempo da tela
    const base = quadros.length;
    wavs.forEach((w) => args.push('-i', w));
    const partes = wavs.map((_, i) => {
      const espaco = i === wavs.length - 1 ? dur[i] : dur[i] - TRANSICAO;
      return `[${base + i}:a]aresample=44100,apad,atrim=0:${espaco.toFixed(3)}[a${i}]`;
    });
    filtros.push(...partes, `${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${wavs.length}:v=0:a=1[af]`);
    mapa.push('-map', '[af]', '-c:a', 'aac', '-b:a', '128k');
  }
  const saida = path.join(pasta, 'story-animado.mp4');
  await rodar('ffmpeg', [...args, '-filter_complex', filtros.join(';'), ...mapa, '-t', fim.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-r', String(FPS), '-movflags', '+faststart', saida]);
  return saida;
}

// teste pela linha de comando: usa a historia do dia e frases de exemplo
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const pasta = path.resolve(process.argv[2]);
  const { historiaDoDia, passos } = await import('./historia.mjs');
  const historia = historiaDoDia(process.argv[3] || new Date().toISOString().slice(0, 10), process.argv[4] || '12h');
  const frases = passos(historia, [{ categoria: 'roupa' }, { categoria: 'enxoval' }, { categoria: 'alimentacao' }]);
  const quadros = (await readdir(pasta)).filter((f) => /^0\d-story\.jpg$/.test(f)).sort().map((f) => path.join(pasta, f));
  console.log(await storyAnimado({ historia, frases, quadros, pasta }));
}

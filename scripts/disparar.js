// Disparo manual (GitHub Actions ou local). No dia a dia quem roda e o pg_cron do Supabase.
// TESTE=1 escolhe a oferta e mostra a mensagem sem postar.
import { readFile } from 'node:fs/promises';
import { disparar } from '../supabase/functions/_shared/disparo.js';

const cfg = JSON.parse(await readFile(new URL('../supabase/functions/_shared/config.json', import.meta.url)));

const resultado = await disparar(cfg, { teste: process.env.TESTE === '1' });
console.log(JSON.stringify(resultado, null, 2));

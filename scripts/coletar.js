// Coleta manual (GitHub Actions ou local). No dia a dia quem roda e o pg_cron do Supabase.
import { readFile } from 'node:fs/promises';
import { coletar } from '../supabase/functions/_shared/coleta.js';

const cfg = JSON.parse(await readFile(new URL('../supabase/functions/_shared/config.json', import.meta.url)));

const resultado = await coletar(cfg);
for (const linha of resultado.log) console.log(linha);

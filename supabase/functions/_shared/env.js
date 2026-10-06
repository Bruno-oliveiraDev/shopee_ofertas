// O mesmo codigo roda na Edge Function do Supabase (Deno) e nos scripts do GitHub (Node).
export const env = (nome) => globalThis.Deno?.env?.get(nome) ?? globalThis.process?.env?.[nome];

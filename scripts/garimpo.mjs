// Garimpo (so leitura): busca na API de afiliados da Shopee uma lista de termos e grava garimpo.json.
// NAO grava nada no Supabase. Uso: SHOPEE_APP_ID=.. SHOPEE_APP_SECRET=.. node scripts/garimpo.mjs termos.txt
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const termos = (await readFile(process.argv[2] || 'scripts/garimpo-termos.txt', 'utf8'))
  .split('\n').map((t) => t.trim()).filter((t) => t && !t.startsWith('#'));
const CAMPOS = 'itemId shopId productName offerLink imageUrl priceMin priceDiscountRate sales ratingStar commissionRate shopName shopType';

async function buscar(termo, sortType) {
  const query = `{productOfferV2(keyword:"${termo.replace(/["\]/g, '')}",listType:0,sortType:${sortType},page:1,limit:30){nodes{${CAMPOS}}}}`;
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash('sha256').update(process.env.SHOPEE_APP_ID + ts + payload + process.env.SHOPEE_APP_SECRET).digest('hex');
  const r = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${process.env.SHOPEE_APP_ID}, Timestamp=${ts}, Signature=${sig}` },
    body: payload,
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data.productOfferV2.nodes;
}

const vistos = new Map();
for (const termo of termos) {
  for (const sortType of [2, 5]) { // 2 = mais vendidos, 5 = maior comissao
    try {
      for (const p of await buscar(termo, sortType)) {
        const preco = parseFloat(p.priceMin || '0');
        const desconto = Number(p.priceDiscountRate || 0);
        if (!vistos.has(p.itemId)) vistos.set(p.itemId, {
          termo, item_id: String(p.itemId), nome: p.productName, preco,
          preco_de: desconto > 0 && desconto < 100 ? +(preco / (1 - desconto / 100)).toFixed(2) : null,
          desconto, vendas: Number(p.sales || 0), nota: p.ratingStar ? +parseFloat(p.ratingStar).toFixed(1) : null,
          comissao: parseFloat(p.commissionRate || '0'), loja: p.shopName, tipo_loja: p.shopType, imagem: p.imageUrl, link: p.offerLink,
        });
      }
    } catch (e) { console.log('falhou', termo, e.message); }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(termo, vistos.size);
}
await writeFile('garimpo.json', JSON.stringify([...vistos.values()], null, 1));
console.log('total', vistos.size);

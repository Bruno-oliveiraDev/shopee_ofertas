// ACHADOS · motor comum dos slides (capa, produto, fecho). Sem dependência, roda no Chromium do Playwright.
// O HTML já vem preenchido (marcadores trocados). Este script:
//   1) desenha o que é "à mão" com ruído SEMEADO pelo id do post (pauta, caixinha, círculo, fita, giro, seta);
//   2) aplica o formato (feed 1080x1350 | story 1080x1920);
//   3) encaixa: encolhe texto até o piso de cada bloco, depois a foto até o mínimo, nunca amplia foto > 1,15x;
//   4) roda o QA e publica window.__QA = {erros, avisos}; window.__PRONTO = true no fim.
(function () {
  const B = document.body;
  const story = B.dataset.formato === 'story';
  const tipo = B.dataset.tipo;
  const W = 1080, H = story ? 1920 : 1350;
  const TINTA = '#1F3F95', TX = '#24201C';
  const MAX_AMPLIA = 1.15;

  // ---------- aleatório semeado ----------
  let seed = [...(B.dataset.semente + ':' + tipo + ':' + (B.dataset.atual || ''))].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rr = (a, b) => a + rnd() * (b - a);

  // ---------- papel: pauta levemente torta + manchas + fibra ----------
  (function papel() {
    const passo = 64, linhas = [];
    for (let y = 150 + rr(0, 20); y < H; y += passo) {
      const op = rr(.30, .42).toFixed(2);
      linhas.push(`<path d="M0 ${y.toFixed(1)} C 360 ${(y + rr(-1.2, 1.2)).toFixed(1)}, 720 ${(y + rr(-1.2, 1.2)).toFixed(1)}, ${W} ${(y + rr(-1, 1)).toFixed(1)}" stroke="rgb(70,110,185)" stroke-opacity="${op}" stroke-width="2.1" fill="none"/>`);
    }
    const mx = 70 + rr(-2, 2);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>
      <filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.004' numOctaves='3' seed='${Math.floor(rr(1, 99))}'/><feColorMatrix values='0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .30  0 0 0 .10 0'/></filter>
      <filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='${Math.floor(rr(1, 99))}'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .12 0'/></filter>
      <rect width='100%' height='100%' fill='#F7F2E7'/><rect width='100%' height='100%' filter='url(#f)'/>
      ${linhas.join('')}
      <path d='M${mx} 0 L ${mx + rr(-2, 2)} ${H}' stroke='rgb(205,95,95)' stroke-opacity='.55' stroke-width='2.4'/>
      <rect width='100%' height='100%' filter='url(#g)'/></svg>`;
    document.getElementById('papel').style.background = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  })();

  // ---------- formato story: só troca tamanhos (a estrutura é a mesma) ----------
  const set = (sel, css) => document.querySelectorAll(sel).forEach((el) => Object.assign(el.style, css));
  const fit = (sel, v) => document.querySelectorAll(sel).forEach((el) => { el.dataset.fit = v; });
  if (story) {
    if (tipo === 'capa') {
      set('#fcapa', { width: '880px', height: '660px' }); document.getElementById('fcapa').dataset.encolhe = '660,460';
      set('#quadro', { marginBottom: '170px' });
      set('#pcapa', { width: '430px', fontSize: '74px', right: '-40px', bottom: '-150px' });
      fit('#titulo .mao', '120,76');
    }
    if (tipo === 'produto') { set('#area', { gap: '46px' }); fit('.mao[data-fit]', '100,64'); fit('.corpo[data-fit]', '50,42'); }
    if (tipo === 'fecho') {
      set('#ffecho', { width: '640px', height: '480px' }); document.getElementById('ffecho').dataset.encolhe = '480,340';
      fit('.mao[data-fit]', '96,64'); set('.area', { gap: '40px' });
    }
  }

  // ---------- traços à mão ----------
  const caixa = (marcada) => {
    const j = () => +rr(-2.5, 2.5).toFixed(1);
    return `<svg viewBox="0 0 60 60" style="width:.8em;height:.8em;flex:none;overflow:visible">
      <path d="M${8 + j()} ${9 + j()} C 22 ${7 + j()}, 40 ${8 + j()}, ${52 + j()} ${8.5 + j()} C ${53 + j()} 22, ${52.5 + j()} 38, ${52 + j()} ${51 + j()} C 38 ${52.5 + j()}, 22 ${52 + j()}, ${8.5 + j()} ${51.5 + j()} C ${7.5 + j()} 38, ${8 + j()} 22, ${8 + j()} ${11 + j()}"
        fill="none" stroke="${TX}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
      ${marcada ? `<path d="M${14 + j()} ${30 + j()} C 19 35, 23 41, ${27 + j()} 46 C 35 31, 46 14, ${62 + j()} ${-2 + j()}" fill="none" stroke="${TINTA}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
  };
  const circulo = `<svg style="position:absolute;left:-14px;top:-6px;width:calc(100% + 28px);height:calc(100% + 12px);overflow:visible" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M6 22 C 4 6, 60 2, 94 10 C 104 22, 80 38, 40 37 C 10 36, 2 26, 14 12" fill="none" stroke="${TINTA}" vector-effect="non-scaling-stroke" style="stroke-width:3.5px" stroke-linecap="round"/></svg>`;

  // post-it: some item vazio (fallback de 2 produtos), marca os já vistos e circula o da vez
  const atual = +B.dataset.atual || 0;
  document.querySelectorAll('.postit').forEach((p) => {
    [...p.querySelectorAll('.it')].filter((it) => !it.textContent.trim() || it.textContent.includes('{{')).forEach((it) => it.remove());
    p.querySelectorAll('.it').forEach((it, k) => {
      it.querySelector('.cx').outerHTML = caixa(tipo === 'produto' && k < atual);
      if (tipo === 'produto' && k === atual - 1) it.querySelector('.tx').insertAdjacentHTML('beforeend', circulo);
    });
  });
  document.querySelectorAll('i.cx').forEach((c) => { const fs = c.style.fontSize; c.outerHTML = `<span style="display:inline-flex;font-size:${fs || 'inherit'}">${caixa(!!c.dataset.marcada)}</span>`; });
  document.querySelectorAll('[data-gira]').forEach((el) => { const [a, b] = el.dataset.gira.split(',').map(Number); el.style.transform = `rotate(${rr(a, b).toFixed(1)}deg)`; });
  document.querySelectorAll('.corpo').forEach((el) => { el.innerHTML = el.innerHTML.replace(/\*(.+?)\*/g, '<b>$1</b>'); });

  // ---------- foto do produto: polaroid | recorte | vendedor ----------
  const alvo = document.getElementById('alvo'), img = document.getElementById('fimg'), zona = document.getElementById('zona');
  let natW = 0, natH = 0;
  function prepFoto() {
    if (!alvo || !img) return;
    const modo = alvo.dataset.modo || 'polaroid';
    natW = img.naturalWidth; natH = img.naturalHeight;
    const corte = (alvo.dataset.corte || '').split(',').map(Number);
    if (corte.length === 4 && corte.every((v) => !isNaN(v)) && corte[2] > corte[0]) {
      img.style.objectViewBox = `inset(${corte[1]}px ${natW - corte[2]}px ${natH - corte[3]}px ${corte[0]}px)`;
      natW = corte[2] - corte[0]; natH = corte[3] - corte[1];
    }
    const lado = B.dataset.lado === 'dir';
    zona.style.minHeight = '0'; zona.style.flexDirection = lado ? 'row-reverse' : 'row';
    document.getElementById('anota').style.textAlign = lado ? 'left' : 'right';
    if (modo === 'recorte') {
      alvo.className = 'recorte'; zona.style.justifyContent = 'center'; zona.style.gap = '90px'; alvo.style.transform = `rotate(${rr(-6, 6).toFixed(1)}deg)`;
    } else {
      const pol = document.createElement('div'); pol.className = 'polar';
      if (modo === 'vendedor') pol.style.paddingBottom = '56px';
      img.replaceWith(pol); pol.appendChild(img);
      if (modo === 'vendedor') pol.insertAdjacentHTML('beforeend', '<div class="legenda">foto do vendedor</div>');
      alvo.style.position = 'relative'; alvo.style.transform = `rotate(${rr(-3.2, 3.2).toFixed(1)}deg)`;
      alvo.insertAdjacentHTML('beforeend', `<div class="fita" style="width:160px;top:-22px;${lado ? 'left:30px' : 'right:30px'};transform:rotate(${rr(-9, 9).toFixed(1)}deg)"></div>`);
    }
  }
  const dimensiona = () => {
    if (!img || !natW) return;
    const asp = natW / natH, pol = img.closest('.polar');
    const padW = pol ? 36 : 0, padH = pol ? (alvo.dataset.modo === 'vendedor' ? 74 : 40) : 0;
    const zh = zona.clientHeight - padH - 44; // folga pro giro de ±3°
    const zw = zona.clientWidth - (story ? 280 : 320) - padW;
    const w = Math.min(story ? 640 : 580, zw, zh * asp, natW * MAX_AMPLIA);
    img.style.width = Math.round(w) + 'px'; img.style.height = Math.round(w / asp) + 'px';
  };

  // ---------- encaixe + QA ----------
  function layout() {
    const erros = [], avisos = [];
    const area = document.querySelector('.area');
    dimensiona();
    const fits = [...document.querySelectorAll('[data-fit]')].map((el) => { const [mx, mn] = el.dataset.fit.split(',').map(Number); el.style.fontSize = mx + 'px'; return { el, mx, mn, cur: mx }; });
    const enc = [...document.querySelectorAll('[data-encolhe]')].map((el) => { const [mx, mn] = el.dataset.encolhe.split(',').map(Number); return { el, mx, mn, cur: mx }; });
    const fundoArea = () => area.getBoundingClientRect().bottom;
    const ultimo = () => [...area.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
    const estoura = () => ultimo() > fundoArea() + 1 || fits.some((f) => f.el.scrollWidth > f.el.clientWidth + 1);
    const zonaCurta = () => zona && zona.clientHeight < (story ? 420 : 340);
    for (let k = 0; k < 80 && (estoura() || zonaCurta()); k++) {
      let mexeu = false;
      fits.forEach((f) => { if (f.cur > f.mn) { f.cur = Math.max(f.mn, f.cur - 2); f.el.style.fontSize = f.cur + 'px'; mexeu = true; } });
      if (!mexeu) enc.forEach((e) => { if (e.cur > e.mn) { e.cur = Math.max(e.mn, e.cur - 10); e.el.style.height = e.cur + 'px'; mexeu = true; } });
      dimensiona();
      if (!mexeu) break;
    }
    dimensiona();
    if (estoura()) erros.push('texto não coube nem no tamanho mínimo');
    fits.forEach((f) => { if (f.el.scrollWidth > f.el.clientWidth + 1) erros.push('palavra maior que a largura: ' + f.el.textContent.trim().slice(0, 30)); });
    document.querySelectorAll('.corpo').forEach((el) => { if (parseFloat(getComputedStyle(el).fontSize) < 42) erros.push('corpo < 42px'); });
    const sobra = [...document.body.innerHTML.matchAll(/\{\{[A-Z_0-9]+\}\}/g)].map((m) => m[0]);
    if (sobra.length) erros.push('marcador sem dado: ' + [...new Set(sobra)].join(' '));

    // foto do produto: nem pequena, nem esticada
    if (img && natW) {
      const r = img.getBoundingClientRect(), w = parseFloat(img.style.width);
      if (Math.max(r.width, r.height) < 380) erros.push(`foto pequena demais (${Math.round(r.width)}x${Math.round(r.height)}): trocar produto ou foto`);
      if (w / natW > MAX_AMPLIA + .001) erros.push('foto ampliada além de 1,15x');
      if (natW < 400 && natH < 400) avisos.push('foto de origem < 400px');
    }
    // fotos de capa/fecho: nunca ampliar a CC0 além do tamanho real
    document.querySelectorAll('#fcapa,#ffecho').forEach((f) => {
      const esc = Math.max(f.clientWidth / f.naturalWidth, f.clientHeight / f.naturalHeight);
      if (esc > MAX_AMPLIA + .001) erros.push(`${f.id} ampliada ${esc.toFixed(2)}x`);
    });

    // seta à mão: da anotação até a foto (ou até o ponto do produto no recorte)
    const a = document.getElementById('anota'), sv = document.getElementById('setas');
    if (a && alvo && sv) {
      const ra = a.getBoundingClientRect(), rb = alvo.getBoundingClientRect();
      const dir = rb.left > ra.left;
      const x1 = ra.left + ra.width * (dir ? .75 : .25), y1 = ra.top - 14;
      let x2 = dir ? rb.left - 16 : rb.right + 16, y2 = rb.top + rb.height * .3;
      const mira = (alvo.dataset.mira || '').split(',').map(Number);
      if (alvo.dataset.modo === 'recorte' && mira.length === 2 && mira.every((v) => !isNaN(v))) {
        const ri = img.getBoundingClientRect(); x2 = ri.left + ri.width * mira[0] + (dir ? -18 : 18); y2 = ri.top + ri.height * mira[1];
      }
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist > 50 && dist < 560 && (dir ? x2 > x1 - 40 : x2 < x1 + 40)) {
        const cx = x1 + rr(-10, 10), cy = Math.min(y1, y2) - rr(0, 20);
        const ang = Math.atan2(y2 - cy, x2 - cx), L = 26;
        sv.innerHTML = `<path d="M${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2} M${x2 - L * Math.cos(ang - .5)} ${y2 - L * Math.sin(ang - .5)} L ${x2} ${y2} L ${x2 - L * Math.cos(ang + .5)} ${y2 - L * Math.sin(ang + .5)}" fill="none" stroke="${TINTA}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
      } else avisos.push('seta omitida (distância ' + Math.round(dist) + ')');
    }

    // zonas proibidas do story, laterais e sobreposição entre blocos-chave
    const ks = [...document.querySelectorAll('[data-k]')].map((el) => ({ k: el.dataset.k, r: el.getBoundingClientRect() }));
    const zTop = story ? 250 : 0, zBot = story ? H - 340 : H;
    ks.forEach(({ k, r }) => {
      if (r.top < zTop - 1 || r.bottom > zBot + 1) erros.push(`${k} invade faixa proibida (${Math.round(r.top)}–${Math.round(r.bottom)})`);
      if (r.left < -1 || r.right > W + 1) erros.push(`${k} sai pela lateral`);
    });
    for (let x = 0; x < ks.length; x++) for (let y = x + 1; y < ks.length; y++) {
      const A = ks[x].r, C = ks[y].r;
      const ix = Math.min(A.right, C.right) - Math.max(A.left, C.left), iy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
      const par = [ks[x].k, ks[y].k].sort().join('+');
      if (ix > 4 && iy > 4 && par !== 'foto+postit') erros.push('sobreposição: ' + par);
    }
    window.__QA = { tipo, formato: story ? 'story' : 'feed', erros, avisos };
    window.__PRONTO = true;
  }

  const imgs = [...document.images].map((im) => im.complete ? Promise.resolve() : new Promise((ok) => { im.onload = im.onerror = ok; }));
  Promise.all([document.fonts.ready, ...imgs]).then(() => {
    prepFoto();
    layout();
  });
})();

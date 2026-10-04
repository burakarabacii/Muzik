(() => {
'use strict';

/* ==========================================================
   AYARLAR  (bilgiler hazır olunca burayı doldurmak yeterli)
   ========================================================== */
const CONTACT = {
  whatsapp: '',   // ülke koduyla, artı ve boşluk olmadan. Örn: '905xxxxxxxxx'
  phone:    '',   // görünen telefon numarası. Örn: '0 5xx xxx xx xx'
  instagram:'',   // kullanıcı adı, @ olmadan
  email:    ''
};
const MAP = {
  embedSrc: '',   // Google Haritalar > Paylaş > Haritayı yerleştir'deki iframe src adresi
  link: 'https://www.google.com/maps/search/?api=1&query=Arifiye+Sakarya', // tam konum gelince güncellenecek
  address: ''     // örn: 'Mahalle, Cadde No: 1, Arifiye'
};
/* Oynatıcıdaki parçalar. Kendi kayıtların olunca src alanına dosya yolunu yaz
   (örn: 'audio/parca1.mp3') ve synth alanını sil. Şimdilik yerine örnek sesler çalar. */
const TRACKS = [
  { title:'Sabah Teması',     meta:'Gitar',  src:'', synth:'guitar' },
  { title:'Akşam Notturnosu', meta:'Piyano', src:'', synth:'piano'  },
  { title:'Uzun Yol',         meta:'Keman',  src:'', synth:'violin' }
];

/* ---------- yardımcılar ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = s => { s = Math.max(0, Math.floor(s||0)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };

/* ==========================================================
   ORTAK SES ÇEKİRDEĞİ
   ========================================================== */
const AudioCore = (() => {
  let ctx, sfx, pGain, analyser;
  function ensure(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      sfx = ctx.createGain(); sfx.gain.value = .5; sfx.connect(ctx.destination);
      pGain = ctx.createGain(); pGain.gain.value = .8;
      analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .8;
      pGain.connect(analyser); analyser.connect(ctx.destination);
    }
    if(ctx.state === 'suspended') ctx.resume().catch(()=>{});
    return ctx;
  }
  return { ensure, get ctx(){return ctx}, get sfx(){return sfx}, get player(){return pGain}, get analyser(){return analyser} };
})();

/* ==========================================================
   ÜST ÇUBUK, MENÜ, SCROLL
   ========================================================== */
const header = $('.site-header'), menuBtn = $('.menu-btn'), menu = $('#mobile-menu'), prog = $('.progress');
function setMenu(open){
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  document.documentElement.classList.toggle('no-scroll', open);
  if(open) $('a', menu).focus();
}
menuBtn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
$$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', e => { if(e.key === 'Escape' && menu.classList.contains('open')){ setMenu(false); menuBtn.focus(); } });
addEventListener('resize', () => { if(innerWidth >= 960 && menu.classList.contains('open')) setMenu(false); });

const heroCanvas = $('#strings'), heroEl = $('#hero');
let ticking = false;
function onScroll(){
  if(ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    header.classList.toggle('scrolled', y > 24);
    prog.style.setProperty('--sp', max > 0 ? (y/max).toFixed(4) : 0);
    if(!reduce && y < heroEl.offsetHeight){
      heroCanvas.style.transform = `translateY(${(y*.22).toFixed(1)}px)`;
      heroCanvas.style.opacity = String(1 - clamp(y/(heroEl.offsetHeight*.8),0,1)*.75);
    }
    updateTimeline();
  });
}
addEventListener('scroll', onScroll, { passive:true });
addEventListener('resize', onScroll);

/* aktif menü bağlantısı */
const navLinks = $$('.nav a');
const navIO = new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return;
  navLinks.forEach(a => a.removeAttribute('aria-current'));
  const a = navLinks.find(l => l.getAttribute('href') === '#' + e.target.id);
  if(a) a.setAttribute('aria-current','true');
}), { rootMargin:'-45% 0px -50% 0px' });
[...new Set([...navLinks.map(a => a.getAttribute('href')), '#hero', '#hizmetler', '#iletisim'])].map(h => $(h)).filter(Boolean).forEach(s => navIO.observe(s));

/* ==========================================================
   GÖRÜNME ANİMASYONLARI
   ========================================================== */
$$('[data-stagger]').forEach(p => [...p.children].forEach((c,i) => { c.classList.add('reveal'); c.style.setProperty('--i', i); }));
const revIO = new IntersectionObserver(es => es.forEach(e => {
  if(e.isIntersecting){ e.target.classList.add('in'); revIO.unobserve(e.target); }
}), { threshold:.12, rootMargin:'0px 0px -6% 0px' });
$$('.reveal').forEach(el => reduce ? el.classList.add('in') : revIO.observe(el));

/* kaydırmaya bağlı süreç çizgisi */
const tl = $('.tl'), steps = $$('.tl-step');
function updateTimeline(){
  if(!tl) return;
  const r = tl.getBoundingClientRect(), vh = innerHeight;
  tl.style.setProperty('--p', clamp((vh*.72 - r.top) / r.height, 0, 1).toFixed(3));
  steps.forEach(s => s.classList.toggle('on', s.getBoundingClientRect().top < vh*.72));
}

/* ==========================================================
   DERS SEKMELERİ + ÇİZGİ SANATI
   ========================================================== */
const rect = (x,y,w,h) => `M${x} ${y}h${w}v${h}h${-w}z`;
const circ = (cx,cy,r) => `M${cx-r} ${cy}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`;
const ART = {
  keman: [
    circ(100,26,10), rect(94,36,12,20), rect(96,56,8,74),
    'M100 120C78 120 62 132 62 152C62 166 74 170 76 178C78 186 62 190 58 208C54 232 78 244 100 244C122 244 146 232 142 208C138 190 122 186 124 178C126 170 138 166 138 152C138 132 122 120 100 120Z',
    'M86 166C80 176 90 182 84 194','M114 166C120 176 110 182 116 194',
    'M90 200H110','M96 214H104L102 240H98Z',
    'M97.3 56V236','M99.1 56V236','M100.9 56V236','M102.7 56V236'
  ],
  gitar: [
    rect(91,6,18,32), circ(86,14,2.2), circ(86,23,2.2), circ(86,32,2.2), circ(114,14,2.2), circ(114,23,2.2), circ(114,32,2.2),
    rect(95,38,10,84),
    'M95 52H105','M95 66H105','M95 79H105','M95 91H105','M95 102H105','M95 112H105',
    'M100 118C82 118 70 126 70 142C70 156 80 160 80 170C80 178 58 184 58 210C58 236 80 250 100 250C120 250 142 236 142 210C142 184 120 178 120 170C120 160 130 156 130 142C130 126 118 118 100 118Z',
    circ(100,176,13), circ(100,176,17), rect(86,216,28,6),
    'M96 38V219','M97.6 38V219','M99.2 38V219','M100.8 38V219','M102.4 38V219','M104 38V219'
  ],
  piyano: [
    rect(10,48,180,22),
    ...[0,1,2,3,4,5,6].map(i => rect(16+24*i,70,24,130)),
    rect(10,200,180,12),
    ...[0,1,3,4,5].map(i => ({ d: rect(16+24*(i+1)-7,70,14,78), solid:true }))
  ],
  klarnet: [
    'M97 30C97 20 98 12 100 6C102 12 103 20 103 30Z',
    rect(94,30,12,14), rect(95,44,10,72), rect(95,116,10,84),
    'M95 200C95 212 84 220 81 240H119C116 220 105 212 105 200',
    circ(100,56,2.6), circ(100,68,2.6), circ(100,80,2.6), circ(100,92,2.6), circ(100,104,2.6),
    circ(100,128,2.8), circ(100,140,2.8), circ(100,152,2.8), circ(100,164,2.8), circ(100,176,2.8), circ(100,188,2.8),
    'M105 62H117','M105 98H115','M95 86H84','M95 132H85','M105 146H116','M95 170H84'
  ]
};
$$('[data-art]').forEach(p => {
  const paths = ART[p.dataset.art].map((it,i) => {
    const d = typeof it === 'string' ? it : it.d, cls = typeof it === 'string' ? 'ln' : 'ln solid';
    return `<path class="${cls}" pathLength="1" style="animation-delay:${Math.min(i*.05,.9).toFixed(2)}s" d="${d}"/>`;
  }).join('');
  $('.art', p).innerHTML = `<svg viewBox="0 0 200 260" role="img" aria-label="${p.querySelector('h3').textContent} çizimi">${paths}</svg>`;
});

const tabs = $$('[role=tab]'), panels = $$('[role=tabpanel]');
function playPanel(p){ p.classList.remove('play'); void p.offsetWidth; p.classList.add('play'); }
function selectTab(t, focus){
  tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
  panels.forEach(p => { const on = p.id === t.getAttribute('aria-controls'); p.hidden = !on; if(on) playPanel(p); });
  if(focus) t.focus();
}
tabs.forEach((t,i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const k = e.key; let n = null;
    if(k === 'ArrowRight' || k === 'ArrowDown') n = tabs[(i+1) % tabs.length];
    if(k === 'ArrowLeft'  || k === 'ArrowUp')   n = tabs[(i-1+tabs.length) % tabs.length];
    if(k === 'Home') n = tabs[0]; if(k === 'End') n = tabs[tabs.length-1];
    if(n){ e.preventDefault(); selectTab(n, true); }
  });
});
const panelIO = new IntersectionObserver(es => es.forEach(e => {
  if(e.isIntersecting){ const p = panels.find(x => !x.hidden); if(p) playPanel(p); panelIO.disconnect(); }
}), { threshold:.3 });
panelIO.observe($('.panels'));

/* organizasyon bölümü: imleci izleyen sahne ışığı */
const stage = $('.stage');
stage.addEventListener('pointermove', e => {
  if(e.pointerType !== 'mouse') return;
  const r = stage.getBoundingClientRect();
  stage.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  stage.style.setProperty('--my', (e.clientY - r.top) + 'px');
});

/* ==========================================================
   HERO: ETKİLEŞİMLİ TELLER
   ========================================================== */
(function heroStrings(){
  const cv = heroCanvas, g = cv.getContext('2d');
  const S = [
    { n:'Mi',  f:329.63, w:1.1, fv:5.4, dec:1.5 },
    { n:'Si',  f:246.94, w:1.4, fv:4.8, dec:1.4 },
    { n:'Sol', f:196.00, w:1.8, fv:4.2, dec:1.3 },
    { n:'Re',  f:146.83, w:2.2, fv:3.7, dec:1.2 },
    { n:'La',  f:110.00, w:2.7, fv:3.3, dec:1.1 },
    { n:'Mi',  f:82.41,  w:3.2, fv:3.0, dec:1.0 }
  ];
  S.forEach(s => Object.assign(s, { y:0, amp:0, t0:0, p:.5, hover:false, cool:0 }));
  const SEG = 64;
  let W=0, H=0, padL=34, padR=60, raf=0, hint=1, hinted=false;

  function layout(){
    W = heroEl.clientWidth; H = heroEl.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W*dpr; cv.height = H*dpr; g.setTransform(dpr,0,0,dpr,0,0);
    const hh = header.offsetHeight, inner = $('.hero-inner');
    const top = hh + 28; let bottom = inner.offsetTop - 34;
    if(bottom - top < 130) bottom = top + 130;
    S.forEach((s,i) => s.y = top + (bottom-top) * i / (S.length-1));
    padR = W < 560 ? 44 : 64;
    kick();
  }
  function kick(){ if(!raf) raf = requestAnimationFrame(frame); }

  function frame(now){
    raf = 0; g.clearRect(0,0,W,H);
    const x0 = padL, x1 = W - padR, L = x1 - x0; let live = false;
    g.lineCap = 'round';
    S.forEach(s => {
      const t = (now - s.t0)/1000, env = s.amp * Math.exp(-t*s.dec), on = env > .35;
      if(on) live = true;
      if(on && env > 2.5){
        g.strokeStyle = 'rgba(224,190,110,.16)'; g.lineWidth = s.w;
        [-1,1].forEach(sg => {
          g.beginPath();
          for(let k=0;k<=SEG;k++){ const u=k/SEG, tri = u<s.p ? u/s.p : (1-u)/(1-s.p);
            const y = s.y + sg*env*tri; k ? g.lineTo(x0+u*L,y) : g.moveTo(x0+u*L,y); }
          g.stroke();
        });
      }
      g.beginPath();
      const norm = Math.sin(Math.PI*s.p);
      for(let k=0;k<=SEG;k++){
        const u = k/SEG; let d = 0;
        if(on){ let sum = 0;
          for(let n=1;n<=3;n++) sum += Math.sin(n*Math.PI*s.p)/(n*n) * Math.sin(n*Math.PI*u) * Math.cos(6.2832*s.fv*n*t);
          d = env * sum / norm; }
        k ? g.lineTo(x0+u*L, s.y+d) : g.moveTo(x0+u*L, s.y+d);
      }
      g.strokeStyle = on ? 'rgba(232,201,126,.96)' : `rgba(201,162,75,${s.hover ? .95 : .6})`;
      g.lineWidth = s.w + (on ? .3 : 0) + (s.hover ? .4 : 0);
      g.stroke();
      /* akort burgusu ve nota adı */
      g.lineWidth = 1; g.strokeStyle = 'rgba(201,162,75,.55)';
      g.beginPath(); g.arc(16, s.y, 4, 0, 6.2832); g.stroke();
      g.fillStyle = 'rgba(168,152,138,.9)'; g.font = '500 13px "Hanken Grotesk",system-ui,sans-serif';
      g.textBaseline = 'middle'; g.fillText(s.n, x1 + 14, s.y);
    });
    if(hint > 0){
      g.fillStyle = `rgba(168,152,138,${(hint*.9).toFixed(2)})`;
      g.font = '500 13px "Hanken Grotesk",system-ui,sans-serif'; g.textBaseline = 'alphabetic';
      g.fillText('Tellere dokun', padL, S[S.length-1].y + 30);
      if(hinted){ hint -= .03; live = true; }
    }
    if(live) raf = requestAnimationFrame(frame);
  }

  /* Karplus-Strong tel sesi */
  const cache = {};
  function ksBuffer(ac, f){
    const sr = ac.sampleRate, N = Math.max(2, Math.round(sr/f)), len = Math.floor(sr*2.8);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
    for(let i=0;i<N;i++) ring[i] = Math.random()*2 - 1;
    for(let i=0;i<N;i++) ring[i] = (ring[i] + ring[(i+1)%N]) * .5;
    let p = 0;
    for(let i=0;i<len;i++){
      const a = ring[p], b = ring[(p+1)%N];
      ring[p] = (a+b) * .5 * .9975; d[i] = a; p = (p+1) % N;
      if(i > len - 4000) d[i] *= (len - i)/4000;
    }
    return buf;
  }
  function pluckSound(i, vel){
    const ac = AudioCore.ensure(); if(!ac) return;
    const buf = cache[i] || (cache[i] = ksBuffer(ac, S[i].f));
    const src = ac.createBufferSource(), gn = ac.createGain();
    src.buffer = buf; gn.gain.value = .35 + .5*clamp(vel,0,1);
    src.connect(gn); gn.connect(AudioCore.sfx); src.start();
  }
  function pluck(i, x, amp, sound){
    const s = S[i], now = performance.now();
    if(now - s.cool < 90) return;
    s.cool = now; s.p = clamp((x-padL)/(W-padL-padR), .12, .88); s.amp = amp; s.t0 = now;
    if(sound) pluckSound(i, amp/26);
    hinted = true; kick();
  }

  const pos = e => { const r = cv.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
  const nearest = y => S.reduce((b,s,i) => { const d = Math.abs(s.y - y); return d < b.d ? { i, d } : b; }, { i:0, d:1e9 });
  let last = null;
  cv.addEventListener('pointerdown', e => {
    const p = pos(e), n = nearest(p.y);
    if(n.d < (e.pointerType === 'mouse' ? 24 : 32)) pluck(n.i, p.x, 15 + Math.random()*8, true);
    last = p;
  });
  cv.addEventListener('pointermove', e => {
    if(e.pointerType === 'touch') return;
    const p = pos(e); let changed = false;
    S.forEach((s,i) => {
      const h = Math.abs(p.y - s.y) < 14 && p.x > padL && p.x < W - padR;
      if(h !== s.hover){ s.hover = h; changed = true; }
      if(last && (last.y - s.y) * (p.y - s.y) < 0 && p.x > padL && p.x < W - padR){
        pluck(i, p.x, clamp(Math.abs(p.y - last.y) * .5 + 6, 6, 24), !!(e.buttons & 1));
      }
    });
    last = p; if(changed) kick();
  });
  cv.addEventListener('pointerleave', () => { last = null; S.forEach(s => s.hover = false); kick(); });

  new ResizeObserver(layout).observe(heroEl);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(layout);
  layout();
  if(!reduce) setTimeout(() => S.forEach((s,i) => setTimeout(() => pluck(i, W*(.28 + .07*i), 11, false), i*140)), 900);
})();

/* ==========================================================
   ÖZEL SES OYNATICI
   ========================================================== */
const SR = 22050;
const mtof = m => 440 * Math.pow(2, (m-69)/12);

/* --- örnek parçaların notaları --- */
function pieceGuitar(){
  const beat = 60/84, bar = beat*4, notes = [];
  const ch = [[45,52,57,60,64],[41,48,53,57,60],[48,52,55,60,64],[43,50,55,59,62]], pat = [0,2,3,4,2,3,4,3];
  for(let b=0;b<8;b++) for(let i=0;i<8;i++)
    notes.push({ t:b*bar + i*beat/2, d:2.4, m:ch[b%4][pat[i]], v:i===0 ? 1 : (i%2 ? .55 : .7) });
  [[4,0,76,2],[4,2.5,72,1.5],[5,0,77,2],[5,2.5,74,1.5],[6,0,76,2],[6,2,79,2],[7,0,74,3]]
    .forEach(([b,bt,m,d]) => notes.push({ t:b*bar + bt*beat, d:d*beat + 1.2, m, v:.95 }));
  return { dur: 8*bar + 2.4, notes, voice:'pluck' };
}
function piecePiano(){
  const beat = 60/72, bar = beat*4, notes = [];
  const bass = [50,47,43,45], mid = [[57,62,66],[54,59,62],[55,59,62],[57,61,64]];
  const idx = [0,1,2,3,0,1,2,0];
  const mel = [
    [[0,2,78],[2,1,76],[3,1,74]], [[0,2,74],[2,1,71],[3,1,74]], [[0,2,79],[2,1,74],[3,1,71]], [[0,3,76],[3,1,73]],
    [[0,1,81],[1,1,78],[2,2,74]],  [[0,2,78],[2,2,74]],         [[0,2,79],[2,1,83],[3,1,79]], [[0,4,78]]
  ];
  idx.forEach((c,b) => {
    const t0 = b*bar;
    if(b === 7){ notes.push({ t:t0, d:3.5, m:50, v:.9 }, { t:t0, d:3.5, m:57, v:.55 }, { t:t0, d:3.5, m:66, v:.5 }); }
    else{
      notes.push({ t:t0, d:3.6, m:bass[c], v:.9 });
      mid[c].forEach((m,i) => notes.push({ t:t0 + (i+1)*beat, d:2.6, m, v:.45 }));
    }
    mel[b].forEach(([bt,d,m]) => notes.push({ t:t0 + bt*beat, d:d*beat + 1.4, m, v:.85 }));
  });
  return { dur: 8*bar + 3, notes, voice:'piano' };
}
function pieceViolin(){
  const bar = 4, notes = [];
  const pad = { Dm:[50,57,65], Bb:[46,53,62], F:[53,57,60], C:[48,55,64] };
  const prog = ['Dm','Bb','F','C','Dm','Bb','C','Dm'];
  const mel = [
    [[0,2,69],[2,1,74],[3,1,77]], [[0,2,77],[2,1,74],[3,1,70]], [[0,2,72],[2,1,69],[3,1,72]], [[0,3,76],[3,1,74]],
    [[0,2,77],[2,1,76],[3,1,74]], [[0,2,74],[2,2,77]],          [[0,2,76],[2,2,72]],          [[0,4,74]]
  ];
  prog.forEach((c,b) => {
    pad[c].forEach(m => notes.push({ t:b*bar, d:bar + .5, m, v:.7, pad:true }));
    mel[b].forEach(([bt,d,m]) => notes.push({ t:b*bar + bt, d:d + (bt + d >= 4 ? .3 : .05), m, v:1 }));
  });
  return { dur: 8*bar + 1.5, notes, voice:'bowed' };
}
const PIECES = { guitar:pieceGuitar(), piano:piecePiano(), violin:pieceViolin() };

/* --- basit sentezleyiciler --- */
function partial(out, start, len, f, amp, tau){
  const w = 2*Math.PI*f/SR, c = 2*Math.cos(w), dec = Math.exp(-1/(tau*SR));
  let p0 = 0, p1 = Math.sin(w), env = amp;
  const atk = Math.floor(.004*SR), end = Math.min(out.length - start, len);
  for(let n=0;n<end;n++){
    out[start+n] += p0 * env * (n < atk ? n/atk : 1);
    const p2 = c*p1 - p0; p0 = p1; p1 = p2; env *= dec;
  }
}
function pluckNote(out, n, piano){
  const start = Math.floor(n.t*SR), f = mtof(n.m);
  const base = clamp(2.6 - (n.m-40)*.03, .7, 2.6) * (piano ? 1.5 : 1);
  const len = Math.floor(Math.min(n.d, base*4) * SR);
  const A = piano ? [1,.6,.32,.18,.09] : [1,.55,.3,.14];
  for(let k=1;k<=A.length;k++){
    const fk = f*k*(piano ? Math.sqrt(1 + .0002*k*k) : 1);
    if(fk > SR*.45) break;
    partial(out, start, len, fk, n.v*.5*A[k-1], base/(1 + (piano ? .8 : 1.3)*(k-1)));
  }
}
function bowedNote(out, n){
  const start = Math.floor(n.t*SR), len = Math.floor(n.d*SR), f = mtof(n.m);
  const A = n.pad ? [1,.35,.12] : [1,.62,.45,.3,.2,.14,.09];
  const atk = (n.pad ? 1.0 : .14)*SR, rel = (n.pad ? 1.2 : .3)*SR, vd = .35*SR, gain = n.pad ? .11 : .16;
  let ph = 0;
  for(let i=0;i<len && start+i<out.length;i++){
    const vib = (!n.pad && i > vd) ? .005*Math.sin(2*Math.PI*5.3*i/SR)*Math.min(1,(i-vd)/(.4*SR)) : 0;
    ph += 2*Math.PI*f*(1+vib)/SR;
    let s = 0; for(let k=0;k<A.length;k++) s += A[k]*Math.sin((k+1)*ph);
    out[start+i] += s * Math.min(1,i/atk) * Math.min(1,(len-i)/rel) * n.v * gain;
  }
}
function space(out){
  const d1 = Math.floor(.09*SR), d2 = Math.floor(.17*SR), d3 = Math.floor(.31*SR);
  for(let i=out.length-1;i>=d3;i--) out[i] += out[i-d1]*.22 + out[i-d2]*.13 + out[i-d3]*.08;
}
function buildBuffer(ac, piece){
  const len = Math.ceil(piece.dur*SR), out = new Float32Array(len);
  piece.notes.forEach(n => piece.voice === 'bowed' ? bowedNote(out,n) : pluckNote(out,n,piece.voice==='piano'));
  space(out);
  let peak = 0; for(let i=0;i<len;i++){ const a = Math.abs(out[i]); if(a > peak) peak = a; }
  const k = peak > 0 ? .85/peak : 1, fo = Math.floor(.25*SR);
  for(let i=0;i<len;i++){ out[i] *= k; if(i > len-fo) out[i] *= (len-i)/fo; }
  for(let i=0;i<200;i++) out[i] *= i/200;
  const buf = ac.createBuffer(1, len, SR); buf.getChannelData(0).set(out);
  return buf;
}

/* --- oynatıcı mantığı --- */
const Player = (() => {
  const el = {
    root:$('#player'), title:$('#pl-title'), meta:$('#pl-meta'), play:$('#pl-play'), prev:$('#pl-prev'), next:$('#pl-next'),
    seek:$('#pl-seek'), cur:$('#pl-cur'), dur:$('#pl-dur'), vol:$('#pl-vol'), mute:$('#pl-mute'),
    list:$('#pl-list'), cv:$('#pl-viz'), status:$('#pl-status')
  };
  let idx = 0, playing = false, offset = 0, startedAt = 0, node = null, busy = false, dragging = false;
  let vol = .8, muted = false, raf = 0, vw = 0, vh = 0, routed = false;
  const cache = new Map(), smooth = new Float32Array(40);
  let fileEl = null, fileNode = null;

  const track = () => TRACKS[idx];
  const piece = i => PIECES[TRACKS[i].synth];
  const durOf = i => TRACKS[i].synth ? piece(i).dur : (fileEl && i === idx && isFinite(fileEl.duration) ? fileEl.duration : 0);
  const setIcon = (btn, id) => btn.querySelector('use').setAttribute('href', '#' + id);

  /* liste */
  el.list.innerHTML = TRACKS.map((t,i) => `
    <li><button class="track" type="button" data-i="${i}" aria-current="false">
      <span class="tk-ix"><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="tk-num">${i+1}</span></span>
      <span><span class="tk-title">${t.title}</span><span class="tk-meta">${t.meta}</span></span>
      <span class="tk-dur">${t.synth ? fmt(PIECES[t.synth].dur) : '–'}</span>
    </button></li>`).join('');
  $$('.track', el.list).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if(i === idx){ toggle(); } else { select(i, true); }
  }));

  function applyVolume(){
    const v = muted ? 0 : vol;
    if(AudioCore.player) AudioCore.player.gain.value = v;
    if(fileEl && !routed) fileEl.volume = v;
  }
  function renderUI(){
    const t = track();
    el.title.textContent = t.title; el.meta.textContent = busy ? 'Hazırlanıyor…' : t.meta;
    $$('.track', el.list).forEach((b,i) => b.setAttribute('aria-current', String(i === idx)));
    el.root.classList.toggle('playing', playing);
    setIcon(el.play, playing ? 'i-pause' : 'i-play');
    el.play.setAttribute('aria-label', playing ? 'Duraklat' : 'Çal');
    el.dur.textContent = fmt(durOf(idx));
    setIcon(el.mute, muted || vol === 0 ? 'i-mute' : 'i-vol');
    el.mute.setAttribute('aria-pressed', String(muted));
    el.mute.setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat');
    updateTime(true);
    if('mediaSession' in navigator){
      try{ navigator.mediaSession.metadata = new MediaMetadata({ title:t.title, artist:'Melih Deniz', album:t.meta }); }catch(_){}
    }
  }
  function time(){
    if(track().synth) return playing && AudioCore.ctx ? offset + (AudioCore.ctx.currentTime - startedAt) : offset;
    return fileEl ? fileEl.currentTime : 0;
  }
  function updateTime(force){
    if(dragging && !force) return;
    const d = durOf(idx), t = clamp(time(), 0, d || 1e9);
    el.cur.textContent = fmt(t);
    const p = d ? t/d : 0;
    if(!dragging){ el.seek.value = Math.round(p*1000); }
    el.seek.style.setProperty('--v', (p*100).toFixed(1) + '%');
    el.seek.setAttribute('aria-valuetext', fmt(t) + ' / ' + fmt(d));
  }

  function stopNode(){
    if(node){ node.onended = null; try{ node.stop(); }catch(_){} node.disconnect(); node = null; }
  }
  function ensureFile(){
    if(fileEl) return;
    fileEl = new Audio(); fileEl.preload = 'metadata';
    fileEl.addEventListener('ended', () => { if(playing) next(true); });
    fileEl.addEventListener('loadedmetadata', () => { el.dur.textContent = fmt(fileEl.duration); const b = $$('.track .tk-dur', el.list)[idx]; if(b) b.textContent = fmt(fileEl.duration); });
  }
  async function start(from){
    if(busy) return;
    const ac = AudioCore.ensure(), t = track();
    if(t.synth){
      if(!ac){ el.status.textContent = 'Bu tarayıcı ses çalmayı desteklemiyor.'; return; }
      if(fileEl) fileEl.pause();
      if(!cache.has(idx)){
        busy = true; renderUI();
        await new Promise(r => setTimeout(r, 40));
        cache.set(idx, buildBuffer(ac, piece(idx)));
        busy = false;
      }
      stopNode();
      const b = cache.get(idx), n = ac.createBufferSource();
      n.buffer = b; n.connect(AudioCore.player);
      n.onended = () => { if(node === n){ node = null; if(playing) next(true); } };
      offset = clamp(from, 0, b.duration - .05); n.start(0, offset);
      startedAt = ac.currentTime; node = n;
    }else{
      stopNode(); ensureFile();
      if(!fileEl.src.endsWith(t.src)) fileEl.src = t.src;
      try{
        const same = new URL(t.src, location.href).origin === location.origin;
        if(ac && same && !fileNode){ fileNode = ac.createMediaElementSource(fileEl); fileNode.connect(AudioCore.player); routed = true; }
      }catch(_){}
      applyVolume();
      try{ fileEl.currentTime = from; await fileEl.play(); }catch(_){ el.status.textContent = 'Parça çalınamadı. Dosya yolunu kontrol et.'; return; }
    }
    applyVolume();
    playing = true; renderUI(); loop();
    el.status.textContent = t.title + ' çalıyor';
  }
  function pause(){
    if(!playing) return;
    offset = time(); playing = false;
    stopNode(); if(fileEl) fileEl.pause();
    renderUI(); el.status.textContent = 'Duraklatıldı';
  }
  function toggle(){ playing ? pause() : start(offset); }
  function select(i, auto){
    const was = playing;
    playing = false; stopNode(); if(fileEl) fileEl.pause();
    idx = (i + TRACKS.length) % TRACKS.length; offset = 0;
    if(fileEl && !track().synth) fileEl.currentTime = 0;
    renderUI();
    if(auto || was) start(0);
  }
  function next(auto){ select(idx+1, auto !== false); }
  function prev(){
    if(time() > 3){ const w = playing; if(w){ start(0); } else { offset = 0; if(fileEl) fileEl.currentTime = 0; updateTime(true); } }
    else select(idx-1, playing);
  }
  function seekTo(p){
    const d = durOf(idx); if(!d) return;
    const t = p*d;
    if(track().synth){ offset = t; if(playing) start(t); }
    else if(fileEl){ fileEl.currentTime = t; }
    updateTime(true);
  }

  /* görselleştirici */
  function sizeViz(){
    const dpr = Math.min(devicePixelRatio||1,2);
    vw = el.cv.clientWidth; vh = el.cv.clientHeight;
    el.cv.width = vw*dpr; el.cv.height = vh*dpr; el.cv.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    drawViz(0);
  }
  function drawViz(ts){
    const g = el.cv.getContext('2d'); g.clearRect(0,0,vw,vh);
    const an = AudioCore.analyser, bins = 40, gap = 4, bw = Math.max(2,(vw - gap*(bins-1))/bins);
    const data = new Uint8Array(an ? an.frequencyBinCount : 0);
    if(an && playing && (track().synth || routed)) an.getByteFrequencyData(data);
    let alive = false;
    for(let i=0;i<bins;i++){
      let v = 0;
      if(playing){
        if(data.length && (track().synth || routed)) v = Math.pow(data[1 + Math.floor(Math.pow(i/bins,2)*110)]/255, 1.5);
        else v = .3 + .25*Math.sin(ts/260 + i*.7);
      }
      smooth[i] = Math.max(v, smooth[i]*.9);
      if(smooth[i] > .012) alive = true;
      const bh = 4 + smooth[i]*(vh*.4), x = i*(bw+gap), y = vh - 22 - bh;
      g.fillStyle = `rgba(${201 - Math.round(21*i/bins)},${162 - Math.round(79*i/bins)},${75 - Math.round(33*i/bins)},${(.35 + smooth[i]*.65).toFixed(2)})`;
      g.beginPath();
      if(g.roundRect) g.roundRect(x, y, bw, bh, Math.min(bw/2,3)); else g.rect(x, y, bw, bh);
      g.fill();
    }
    return alive;
  }
  function loop(){
    if(raf) return;
    const step = ts => {
      raf = 0; updateTime();
      const alive = drawViz(ts);
      if(playing || alive) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* olaylar */
  el.play.addEventListener('click', toggle);
  el.next.addEventListener('click', () => next(true));
  el.prev.addEventListener('click', prev);
  el.seek.addEventListener('input', () => {
    dragging = true;
    const p = el.seek.value/1000, d = durOf(idx);
    el.seek.style.setProperty('--v', (p*100).toFixed(1) + '%');
    el.cur.textContent = fmt(p*d);
  });
  el.seek.addEventListener('change', () => { seekTo(el.seek.value/1000); dragging = false; });
  el.vol.addEventListener('input', () => {
    vol = el.vol.value/100; muted = false;
    el.vol.style.setProperty('--v', el.vol.value + '%'); applyVolume(); renderUI();
  });
  el.mute.addEventListener('click', () => { muted = !muted; applyVolume(); renderUI(); });
  el.vol.style.setProperty('--v', '80%');
  if('mediaSession' in navigator){
    const h = (a,f) => { try{ navigator.mediaSession.setActionHandler(a,f); }catch(_){} };
    h('play', () => start(offset)); h('pause', pause); h('nexttrack', () => next(true)); h('previoustrack', prev);
  }
  new ResizeObserver(sizeViz).observe(el.cv);
  renderUI(); sizeViz();
})();

/* ==========================================================
   HARİTA VE İLETİŞİM
   ========================================================== */
(function contact(){
  const mapBox = $('#map'), link = $('#map-link'), direct = $('#direct');
  link.href = MAP.link || '#';
  if(MAP.embedSrc){
    const f = document.createElement('iframe');
    f.src = MAP.embedSrc; f.title = 'Konum haritası'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    $('#map-art').replaceWith(f);
  }
  if(MAP.address) $('#map-note').textContent = MAP.address;
  const rows = [];
  if(CONTACT.phone) rows.push(`<a href="tel:${CONTACT.phone.replace(/[^\d+]/g,'')}">${CONTACT.phone}</a>`);
  if(CONTACT.email) rows.push(`<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`);
  if(CONTACT.instagram) rows.push(`<a href="https://instagram.com/${CONTACT.instagram}" target="_blank" rel="noopener">Instagram: @${CONTACT.instagram}</a>`);
  direct.innerHTML = rows.join('');

  const form = $('#contact-form'), topic = $('#f-topic'), instField = $('#inst-field'), inst = $('#f-inst'), status = $('#form-status');
  const syncInst = () => { instField.hidden = topic.value !== 'Enstrüman dersi'; if(instField.hidden) inst.value = ''; };
  topic.addEventListener('change', syncInst);

  /* sayfadaki "… için yaz" düğmeleri formu ön doldurur */
  $$('[data-topic]').forEach(b => b.addEventListener('click', () => {
    topic.value = b.dataset.topic; syncInst();
    if(b.dataset.inst) inst.value = b.dataset.inst;
    status.textContent = 'Konu seçildi: ' + b.dataset.topic + (b.dataset.inst ? ' (' + b.dataset.inst + ')' : '') + '. Adını yazıp gönderebilirsin.';
    $('#iletisim').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => $('#f-name').focus({ preventScroll:true }), reduce ? 0 : 700);
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    if(!form.reportValidity()) return;
    const name = $('#f-name').value.trim(), msg = $('#f-msg').value.trim();
    const text = [`Merhaba, ben ${name}.`, `Konu: ${topic.value}${inst.value ? ' (' + inst.value + ')' : ''}.`, msg].filter(Boolean).join('\n');
    if(!CONTACT.whatsapp){
      status.textContent = 'WhatsApp numarası henüz eklenmedi. Numara eklendiğinde mesaj buradan gönderilecek.';
      return;
    }
    const a = document.createElement('a');
    a.href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(text);
    a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    status.textContent = 'WhatsApp açılıyor. Mesajın hazır.';
  });
})();

onScroll();
})();
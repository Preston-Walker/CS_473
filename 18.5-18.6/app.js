/* Interactive demos for the 18.5.5–18.6 walkthrough. Depends on ml.js (window.ML). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pct = (v, d) => (100 * v).toFixed(d == null ? 0 : d) + '%';

  /* ---------------- drawing helpers ---------------- */
  let C = {};
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    const g = (n) => s.getPropertyValue(n).trim();
    C = { bg: g('--bg'), card: g('--card'), ink: g('--ink'), muted: g('--muted'), line: g('--line'), soft: g('--soft'), green: g('--green'), amber: g('--amber'), grey: g('--grey') };
    C.rgb = {};
    for (const k of ['card', 'green', 'amber', 'ink', 'grey']) C.rgb[k] = hexRgb(C[k]);
  }
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  readTheme();
  const rgba = (k, a) => `rgba(${C.rgb[k].join(',')},${a})`;
  function fit(canvas) {
    if (!canvas.dataset.h) canvas.dataset.h = canvas.getAttribute('height');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, canvas.clientWidth), h = +canvas.dataset.h;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function niceTicks(a, b, n) {
    const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag, step = (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function axes(ctx, rect, xr, yr, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = C.muted; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    const xt = opt.xticks || niceTicks(xr[0], xr[1], opt.nx || 6), yt = opt.yticks || niceTicks(yr[0], yr[1], 5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt) {
      const x = rect.x + (v - xr[0]) / (xr[1] - xr[0]) * rect.w;
      if (opt.grid) { ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke(); }
      ctx.fillText((opt.xfmt || String)(v), x, rect.y + rect.h + 5);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt) {
      const y = rect.y + rect.h - (v - yr[0]) / (yr[1] - yr[0]) * rect.h;
      if (opt.grid) { ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke(); }
      ctx.fillText((opt.yfmt || String)(v), rect.x - 6, y);
    }
    if (opt.xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opt.xlabel, rect.x + rect.w, rect.y + rect.h + 32); }
    if (opt.ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(opt.ylabel, rect.x, rect.y - 4); }
    ctx.restore();
  }
  function scaler(rect, xr, yr) {
    return {
      x: (v) => rect.x + (v - xr[0]) / (xr[1] - xr[0]) * rect.w,
      y: (v) => rect.y + rect.h - (v - yr[0]) / (yr[1] - yr[0]) * rect.h,
    };
  }
  function line(ctx, pts, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, fill, stroke, sw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
  }
  function clip(ctx, rect) { ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); }
  function segButtons(sel, attr, onPick) {
    const btns = [...document.querySelectorAll(sel + ' button')];
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset[attr]);
    }));
  }

  /* ---------------- 01 · Gradient boosting on house prices ---------------- */
  const G = (function () {
    const tr = ML.makeHouses(150, 3, true), te = ML.makeHouses(1000, 33, false);
    const M = 200, GX = [], XR = [0.5, 3.7], YR = [0, 1100], Q = 1.55;
    for (let k = 0; k <= 160; k++) GX.push(0.55 + 3.1 * k / 160);
    const cache = {};
    function build(loss) {
      const mdl = ML.gradientBoost1D(tr.x, tr.y, loss, { M, depth: 2, nu: 0.1, minLeaf: 5 });
      const grid = [Float64Array.from(GX, () => mdl.f0)];
      const ft = new Float64Array(te.x.length).fill(mdl.f0), mae = [], at = [mdl.f0];
      const score = () => { let s = 0; for (let i = 0; i < ft.length; i++) s += Math.abs(ft[i] - te.y[i]); return s / ft.length; };
      mae.push(score());
      mdl.trees.forEach((t, m) => {
        grid.push(Float64Array.from(grid[m], (v, k) => v + mdl.nu * ML.tree1DPredict(t, GX[k])));
        for (let i = 0; i < ft.length; i++) ft[i] += mdl.nu * ML.tree1DPredict(t, te.x[i]);
        mae.push(score());
        at.push(at[m] + mdl.nu * ML.tree1DPredict(t, Q));
      });
      return { grid, mae, at, pseudo: mdl.pseudo };
    }
    const st = { loss: 'squared', m: 40 };
    const get = () => cache[st.loss] || (cache[st.loss] = build(st.loss));
    const money = (v) => '$' + Math.round(v).toLocaleString() + 'k';
    const NOTES = {
      squared: 'Squared loss: each typo pulls in proportion to its $650k error, so the model bends upward to meet them. That bump is wrong for every real 1,500 sq ft house.',
      absolute: 'Absolute loss: each pseudo-residual is only +1 or −1, and each leaf takes the median. Five typos among dozens of normal listings barely move a median.',
      huber: 'Huber loss: acts like squared loss for small errors (so it uses their size) and like absolute loss for big ones (so a typo\'s pull is capped at δ = $60k).',
    };

    const cf = $('g-fit'), cr = $('g-res');
    function draw() {
      const d = get(), m = st.m;
      // fit
      let { ctx, w, h } = fit(cf);
      let rect = { x: 52, y: 14, w: w - 62, h: h - 50 };
      axes(ctx, rect, XR, YR, { grid: true, xfmt: (v) => (v * 1000).toLocaleString(), yfmt: (v) => '$' + v + 'k', xlabel: 'size (sq ft)' });
      let sc = scaler(rect, XR, YR);
      clip(ctx, rect);
      tr.x.forEach((x, i) => { if (!tr.typo[i]) dot(ctx, sc.x(x), sc.y(tr.y[i]), 2.6, rgba('grey', 0.55)); });
      tr.x.forEach((x, i) => { if (tr.typo[i]) dot(ctx, sc.x(x), sc.y(tr.y[i]), 5, C.amber, C.card, 1.5); });
      line(ctx, GX.map((x) => [sc.x(x), sc.y(ML.houseTruth(x))]), C.muted, 1.6, [5, 4]);
      line(ctx, GX.map((x, k) => [sc.x(x), sc.y(d.grid[m][k])]), C.green, 2.8);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = C.muted; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(sc.x(Q), rect.y); ctx.lineTo(sc.x(Q), rect.y + rect.h); ctx.stroke(); ctx.restore();
      dot(ctx, sc.x(Q), sc.y(d.at[m]), 4.5, C.green, C.card, 2);

      // pseudo-residuals for the next tree
      ({ ctx, w, h } = fit(cr));
      const pr = d.pseudo[m];
      let mx = 0; for (const v of pr) mx = Math.max(mx, Math.abs(v));
      mx = mx * 1.12 || 1;
      rect = { x: 52, y: 10, w: w - 62, h: h - 34 };
      const yr = [-mx, mx];
      const yt = st.loss === 'absolute' ? [-1, 0, 1] : niceTicks(-mx, mx, 4);
      axes(ctx, rect, XR, yr, { grid: true, yticks: yt, xfmt: (v) => (v * 1000).toLocaleString(), yfmt: (v) => (st.loss === 'absolute' ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) : (v < 0 ? '−$' : '$') + Math.abs(v) + 'k') });
      sc = scaler(rect, XR, yr);
      clip(ctx, rect);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rect.x, sc.y(0)); ctx.lineTo(rect.x + rect.w, sc.y(0)); ctx.stroke();
      tr.x.forEach((x, i) => {
        const jit = st.loss === 'absolute' ? ((i * 37) % 11 - 5) * 0.012 * mx : 0;
        if (!tr.typo[i]) dot(ctx, sc.x(x), sc.y(pr[i] + jit), 2.4, rgba('grey', 0.6));
      });
      tr.x.forEach((x, i) => {
        if (!tr.typo[i]) return;
        ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sc.x(x), sc.y(0)); ctx.lineTo(sc.x(x), sc.y(pr[i])); ctx.stroke();
        dot(ctx, sc.x(x), sc.y(pr[i]), 4.5, C.amber, C.card, 1.5);
      });
      ctx.restore();

      // stats
      $('g-m-out').textContent = m;
      $('g-pred').textContent = money(d.at[m]);
      $('g-true').textContent = money(ML.houseTruth(Q));
      $('g-mae').textContent = money(d.mae[m]);
      let pull = 0, nt = 0;
      tr.typo.forEach((t, i) => { if (t) { pull += pr[i]; nt++; } });
      pull /= nt;
      $('g-pull').textContent = st.loss === 'absolute' ? '+1 (just the sign)' : money(pull) + (st.loss === 'huber' ? ' (capped)' : '');
      $('g-note').textContent = NOTES[st.loss];
    }
    segButtons('[aria-label="Loss function"]', 'loss', (v) => { st.loss = v; draw(); });
    $('g-m').addEventListener('input', (e) => { st.m = +e.target.value; draw(); });
    return { draw };
  })();

  /* ---------------- 02 · XGBoost split calculator ---------------- */
  const X = (function () {
    const CASES = {
      clear: { L: [40, 4], R: [40, 30] },  // [emails, spam]
      tiny: { L: [2, 0], R: [2, 2] },
      useless: { L: [30, 11], R: [30, 12] },
    };
    const st = { c: 'clear', lambda: 1, gamma: 0.5 };
    const W = 3; // half-width of the weight bar, in log-odds
    function emails(el, n, k) {
      let s = '';
      for (let i = 0; i < n; i++) s += i < k ? '<i class="s"></i>' : '<i class="h"></i>';
      el.innerHTML = s;
    }
    const sig = (z) => 1 / (1 + Math.exp(-z));
    const f2 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
    function leafHTML(n, k, lambda) {
      const G = 0.5 * n - k, H = 0.25 * n, w = -G / (H + lambda), w0 = H > 0 ? -G / H : 0;
      const pos = (v) => 50 + 50 * Math.max(-1, Math.min(1, v / W));
      const bar = (v) => { const a = pos(0), b = pos(v); return `left:${Math.min(a, b)}%;width:${Math.abs(b - a)}%`; };
      return {
        G, H, w,
        html: `<span>emails</span><b>${n} (${k} spam)</b>
          <span>G = ∑ g<sub>i</sub></span><b>${f2(G)}</b>
          <span>H = ∑ h<sub>i</sub></span><b>${H.toFixed(2)}</b>
          <span>leaf value w*</span><b>${f2(w)}</b>
          <span>→ p(spam)</span><b>${pct(sig(w))}</b>
          <div class="wbar" title="dashed: w* with λ = 0"><div class="mid"></div>
            <div class="w0" style="${bar(w0)}"></div>
            <div class="w" style="${bar(w)};background:${w >= 0 ? C.amber : C.green}"></div></div>`,
      };
    }
    function draw() {
      const c = CASES[st.c], lam = st.lambda;
      emails($('x-left'), c.L[0], c.L[1]);
      emails($('x-right'), c.R[0], c.R[1]);
      const L = leafHTML(c.L[0], c.L[1], lam), R = leafHTML(c.R[0], c.R[1], lam);
      $('x-left-s').innerHTML = L.html;
      $('x-right-s').innerHTML = R.html;
      const G = L.G + R.G, H = L.H + R.H;
      $('x-parent').innerHTML = `${c.L[0] + c.R[0]} emails, all at p = 0.5 · g<sub>i</sub> = 0.5 − y<sub>i</sub>, h<sub>i</sub> = 0.25 · G = ${f2(G)}, H = ${H.toFixed(2)}`;
      const raw = 0.5 * (L.G * L.G / (L.H + lam) + R.G * R.G / (R.H + lam) - G * G / (H + lam));
      const net = raw - st.gamma;
      const scale = Math.max(raw, st.gamma, 1) * 1.15;
      $('x-gain').textContent = raw.toFixed(2);
      $('x-gain-bar').style.width = (100 * raw / scale) + '%';
      $('x-gamma-mark').style.left = (100 * st.gamma / scale) + '%';
      const v = $('x-verdict');
      v.className = 'verdict ' + (net > 0 ? 'keep' : 'prune');
      v.textContent = net > 0
        ? `gain − γ = ${raw.toFixed(2)} − ${st.gamma.toFixed(1)} = ${net.toFixed(2)} > 0 → make the split.`
        : `gain − γ = ${raw.toFixed(2)} − ${st.gamma.toFixed(1)} = ${f2(net)} ≤ 0 → don't split; keep one leaf.`;
      $('x-lambda-out').textContent = lam.toFixed(1);
      $('x-gamma-out').textContent = st.gamma.toFixed(1);
    }
    segButtons('[aria-label="Scenario"]', 'case', (v) => { st.c = v; draw(); });
    $('x-lambda').addEventListener('input', (e) => { st.lambda = +e.target.value; draw(); });
    $('x-gamma').addEventListener('input', (e) => { st.gamma = +e.target.value; draw(); });
    return { draw };
  })();

  /* ---------------- shared spam model ---------------- */
  const PARAMS = { M: 200, depth: 3, nu: 0.1, lambda: 1, gamma: 0, minLeaf: 5, colsample: 0.6, seed: 3 };
  const SP = {
    base: (() => { const tr = ML.makeSpam(1200, 5, false), te = ML.makeSpam(2000, 55, false); return { tr, te, model: ML.trainSpamGBM(tr, te, PARAMS) }; })(),
    copy: null,
  };
  function spamCopy() {
    if (!SP.copy) { const tr = ML.makeSpam(1200, 5, true), te = ML.makeSpam(2000, 55, true); SP.copy = { tr, te, model: ML.trainSpamGBM(tr, te, PARAMS) }; }
    return SP.copy;
  }
  const FEATS = ML.SPAM_FEATURES, NOISE = FEATS.findIndex((f) => f.key === 'noise');

  /* ---------------- 03 · Feature importance ---------------- */
  const I = (function () {
    const st = { m: 200, copy: false };
    const box = $('i-bars'), rows = [];
    [...FEATS, ML.COPY_FEATURE].forEach((f, k) => {
      const b = document.createElement('button');
      b.className = 'bar' + (k === NOISE ? ' noise' : '') + (k === FEATS.length ? ' twin' : '');
      b.setAttribute('role', 'listitem');
      b.innerHTML = `<span>${f.label}</span><span class="track"><span class="fill"></span></span><b>0</b>`;
      b.title = f.long;
      b.addEventListener('click', () => { P.select(k >= FEATS.length ? 0 : k); $('pdp').scrollIntoView(); });
      box.appendChild(b); rows.push(b);
    });
    function draw() {
      const S = st.copy ? spamCopy() : SP.base, mdl = S.model, imp = mdl.cumImp[st.m];
      const mx = Math.max(...imp) || 1, D = imp.length;
      const score = Array.from(imp, (v) => 100 * v / mx);
      const order = score.map((_, k) => k).sort((a, b) => score[b] - score[a]);
      rows.forEach((r, k) => {
        if (k >= D) { r.style.display = 'none'; return; }
        r.style.display = '';
        r.style.order = order.indexOf(k);
        r.querySelector('.fill').style.width = score[k] + '%';
        r.querySelector('b').textContent = Math.round(score[k]);
      });
      $('i-m-out').textContent = st.m;
      $('i-acc').textContent = pct(mdl.testAcc[st.m], 1);
      const top = order[0];
      $('i-top').textContent = (top < FEATS.length ? FEATS[top] : ML.COPY_FEATURE).label;
      $('i-noise').textContent = Math.round(score[NOISE]);
      $('i-note').innerHTML = st.copy
        ? `With the twin added, accuracy is essentially unchanged, but the original “!” scores <b>${Math.round(score[0])}</b> and its twin <b>${Math.round(score[D - 1])}</b>. Together they are worth about <b>${Math.round(score[0] + score[D - 1])}</b>. The model didn't change its mind about “!”; it just spread the credit across two columns. (Each tree here may only use a random 60% of the features, as XGBoost's <code>colsample_bytree</code> does, so both copies get picked.)`
        : st.m < 10
          ? 'With only a few trees the ranking is jumpy: a single tree has just a handful of splits. Slide M up and it settles.'
          : 'Words that mark spam (“!”, “$”, “remove”) and words that mark work email (“hp”, “george”) both rank high. The noise digit is near zero, as it should be.';
    }
    $('i-m').addEventListener('input', (e) => { st.m = +e.target.value; draw(); });
    $('i-copy').addEventListener('change', (e) => { st.copy = e.target.checked; draw(); });
    return { draw };
  })();

  /* ---------------- 04 · Partial dependence ---------------- */
  const NG = 40;
  const grids = FEATS.map((f, k) => {
    const v = SP.base.tr.X.map((x) => x[k]).sort((a, b) => a - b);
    const hi = k === NOISE ? 9 : v[Math.floor(0.97 * (v.length - 1))];
    return Array.from({ length: NG }, (_, j) => hi * j / (NG - 1));
  });
  const fmtVal = (k, v) => (k === NOISE ? String(Math.round(v)) : v.toFixed(2) + '%');

  const P = (function () {
    const rows = SP.base.tr.X.slice(0, 300), M = PARAMS.M, cache = {};
    const st = { k: 0, j: 10, ice: true };
    const get = (k) => cache[k] || (cache[k] = ML.partialDependence(SP.base.model, M, rows, k, grids[k]));
    const chips = $('p-feats');
    FEATS.forEach((f, k) => {
      const b = document.createElement('button');
      b.textContent = f.label; b.title = f.long;
      b.addEventListener('click', () => select(k));
      chips.appendChild(b);
    });
    function select(k) {
      st.k = k;
      [...chips.children].forEach((b, i) => b.classList.toggle('on', i === k));
      draw();
    }
    const cv = $('p-plot');
    function draw() {
      const k = st.k, g = grids[k], d = get(k), j = st.j, v = g[j];
      const { ctx, w, h } = fit(cv);
      const rect = { x: 44, y: 14, w: w - 54, h: h - 52 };
      const xr = [g[0], g[NG - 1]], yr = [0, 1];
      axes(ctx, rect, xr, yr, { grid: true, yfmt: (t) => Math.round(t * 100) + '%', xfmt: (t) => (k === NOISE ? t : t + '%'), xlabel: FEATS[k].long, ylabel: 'p(spam)' });
      const sc = scaler(rect, xr, yr);
      clip(ctx, rect);
      if (st.ice) for (let r = 0; r < 40; r++) line(ctx, g.map((x, i) => [sc.x(x), sc.y(d.ice[r][i])]), rgba('grey', 0.35), 1.1);
      line(ctx, g.map((x, i) => [sc.x(x), sc.y(d.pd[i])]), C.amber, 3.2);
      // the "set everyone to v" column
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sc.x(v), rect.y); ctx.lineTo(sc.x(v), rect.y + rect.h); ctx.stroke(); ctx.setLineDash([]);
      d.ice.forEach((c, r) => dot(ctx, sc.x(v) + ((r * 53) % 13 - 6) * 0.9, sc.y(c[j]), 1.8, rgba('ink', 0.35)));
      dot(ctx, sc.x(v), sc.y(d.pd[j]), 6.5, C.amber, C.card, 2.5);
      ctx.restore();
      // rug of real values
      ctx.strokeStyle = rgba('ink', 0.35); ctx.lineWidth = 1;
      for (const x of rows) {
        const t = x[k];
        if (t > xr[1]) continue;
        const px = sc.x(t) + (k === NOISE ? ((x[0] * 997) % 1 - 0.5) * 6 : 0);
        ctx.beginPath(); ctx.moveTo(px, rect.y + rect.h - 6); ctx.lineTo(px, rect.y + rect.h); ctx.stroke();
      }
      $('p-fname').textContent = FEATS[k].label;
      $('p-v-out').textContent = fmtVal(k, v);
      $('p-avg').textContent = pct(d.pd[j]);
      const dlt = d.pd[NG - 1] - d.pd[0];
      $('p-range').textContent = (dlt >= 0 ? '+' : '−') + Math.abs(100 * dlt).toFixed(0) + ' points';
      $('p-readout').innerHTML = `Set ${k === NOISE ? 'the message-ID digit' : FEATS[k].long} to <b>${fmtVal(k, v)}</b> in all 300 emails, leave everything else alone, and average: the model says <b>${pct(d.pd[j])}</b> spam.`;
    }
    $('p-v').addEventListener('input', (e) => { st.j = +e.target.value; draw(); });
    $('p-ice').addEventListener('change', (e) => { st.ice = e.target.checked; draw(); });
    st.k = 0; chips.children[0].classList.add('on');
    return { draw, select };
  })();

  /* ---------------- 04b · Two-feature partial dependence ---------------- */
  const P2 = (function () {
    const rows = SP.base.tr.X.slice(0, 200), N2 = 22, cache = {};
    const st = { a: 0, b: 5 };
    const sa = $('p2-a'), sb = $('p2-b');
    for (const s of [sa, sb]) FEATS.forEach((f, k) => { const o = document.createElement('option'); o.value = k; o.textContent = f.label; s.appendChild(o); });
    sa.value = st.a; sb.value = st.b;
    // square-root spacing: these frequencies are mostly 0 or small, so give the low end more room
    const g2 = (k) => Array.from({ length: N2 }, (_, i) => grids[k][NG - 1] * Math.pow((i + 0.5) / N2, 2));
    function sqrtTicks(k) {
      const hi = grids[k][NG - 1];
      const vals = k === NOISE ? [0, 1, 3, 5, 9] : [0, ...niceTicks(0, hi, 3).filter((v) => v > 0), +(hi / 16).toPrecision(1)];
      return [...new Set(vals)].filter((v) => v <= hi).sort((a, b) => a - b).map((v) => ({ u: Math.sqrt(v / hi), v }));
    }
    function get() {
      const key = st.a + ',' + st.b;
      return cache[key] || (cache[key] = ML.partialDependence2D(SP.base.model, PARAMS.M, rows, st.a, st.b, g2(st.a), g2(st.b)));
    }
    function color(p) {
      // diverging around the data's base rate: green (ham) → card → amber (spam)
      const t = Math.max(-1, Math.min(1, (p - 0.35) / 0.4)), c = t >= 0 ? C.rgb.amber : C.rgb.green, b = C.rgb.card, a = Math.abs(t) * 0.9;
      return [0, 1, 2].map((i) => b[i] + (c[i] - b[i]) * a);
    }
    const cv = $('p2-map');
    function draw() {
      const grid = get();
      const { ctx, w, h } = fit(cv);
      const rect = { x: 44, y: 14, w: w - 54, h: h - 52 };
      const xr = [0, 1], yr = [0, 1], ta = sqrtTicks(st.a), tb = sqrtTicks(st.b);
      const off = document.createElement('canvas'); off.width = N2; off.height = N2;
      const octx = off.getContext('2d'), img = octx.createImageData(N2, N2);
      for (let j = 0; j < N2; j++) for (let i = 0; i < N2; i++) {
        const c = color(grid[j * N2 + i]), q = ((N2 - 1 - j) * N2 + i) * 4;
        img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
      const lab2 = (ticks, k) => (u) => { const t = ticks.find((q) => q.u === u); return k === NOISE ? String(t.v) : t.v + '%'; };
      axes(ctx, rect, xr, yr, { xticks: ta.map((t) => t.u), yticks: tb.map((t) => t.u), xfmt: lab2(ta, st.a), yfmt: lab2(tb, st.b), xlabel: FEATS[st.a].long + ' (√ scale)', ylabel: '↑ ' + FEATS[st.b].long + ' (√ scale)' });
      // value labels in the four corners for a quick read
      ctx.font = '600 12px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = C.ink;
      const lab = (i, j, al, bl) => { ctx.textAlign = al; ctx.textBaseline = bl; ctx.fillText(pct(grid[j * N2 + i]), rect.x + (al === 'left' ? 6 : rect.w - 6), rect.y + (bl === 'top' ? 6 : rect.h - 6)); };
      lab(0, 0, 'left', 'bottom'); lab(N2 - 1, 0, 'right', 'bottom'); lab(0, N2 - 1, 'left', 'top'); lab(N2 - 1, N2 - 1, 'right', 'top');
    }
    function pick() {
      let a = +sa.value, b = +sb.value;
      if (a === b) { b = (a + 5) % FEATS.length; sb.value = b; }
      st.a = a; st.b = b; draw();
    }
    sa.addEventListener('change', pick); sb.addEventListener('change', pick);
    return { draw };
  })();

  /* ---------------- wiring ---------------- */
  function drawAll() { readTheme(); G.draw(); X.draw(); I.draw(); P.draw(); P2.draw(); }
  drawAll();
  let lastW = window.innerWidth, rt = null;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(drawAll, 120);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll);

  const links = [...document.querySelectorAll('.lesson-nav a')];
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.lesson').forEach((s) => io.observe(s));
})();

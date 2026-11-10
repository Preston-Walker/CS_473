/* Interactive demos for the 18.4–18.5 walkthrough. Depends on ml.js (window.ML). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fmtPct = (v) => (100 * v).toFixed(1) + '%';

  /* ---------------- drawing helpers ---------------- */
  let C = {};
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    const g = (n) => s.getPropertyValue(n).trim();
    C = { bg: g('--bg'), card: g('--card'), ink: g('--ink'), muted: g('--muted'), line: g('--line'), soft: g('--soft'), green: g('--green'), amber: g('--amber'), grey: g('--grey') };
    C.rgb = {};
    for (const k of ['card', 'green', 'amber', 'ink']) C.rgb[k] = hexRgb(C[k]);
  }
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function fit(canvas) {
    if (!canvas.dataset.h) canvas.dataset.h = canvas.getAttribute('height');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, canvas.clientWidth), h = +canvas.dataset.h;
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  // probability (of the "hi" class) → rgb, fading to card colour where uncertain
  function probRgb(p, hi, lo) {
    const t = Math.min(1, Math.abs(p - 0.5) * 2);
    const a = 0.12 + 0.62 * Math.pow(t, 0.8);
    const c = p >= 0.5 ? C.rgb[hi] : C.rgb[lo], b = C.rgb.card;
    return [b[0] + (c[0] - b[0]) * a, b[1] + (c[1] - b[1]) * a, b[2] + (c[2] - b[2]) * a];
  }
  // Paint a GW×GH grid of probabilities into a plotting rectangle.
  function paintGrid(ctx, grid, GW, GH, rect, hi, lo) {
    const off = document.createElement('canvas');
    off.width = GW; off.height = GH;
    const octx = off.getContext('2d'), img = octx.createImageData(GW, GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const p = grid[j * GW + i], c = probRgb(p, hi, lo), k = ((GH - 1 - j) * GW + i) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
  }
  function axes(ctx, rect, xr, yr, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = C.muted; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    const xt = opt.xticks || niceTicks(xr[0], xr[1], 6), yt = opt.yticks || niceTicks(yr[0], yr[1], 5);
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
    if (opt.xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opt.xlabel, rect.x + rect.w, rect.y + rect.h + 30); }
    if (opt.ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = C.muted; ctx.fillText(opt.ylabel, rect.x, rect.y - 4); }
    ctx.restore();
  }
  function niceTicks(a, b, n) {
    const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag, step = (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
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
  function frame(ctx, rect) { ctx.save(); ctx.strokeStyle = C.line; ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1); ctx.restore(); }
  function clearBg(ctx, w, h) { ctx.clearRect(0, 0, w, h); }

  /* ---------------- 01 · Forest lab (2-D loans) ---------------- */
  const F = (function () {
    const tr = ML.makeLoans(220, 11), te = ML.makeLoans(2000, 99);
    const XR = [520, 840], YR = [2, 58], GW = 96, GH = 60, M = 100;
    const cells = [];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) cells.push([XR[0] + (i + 0.5) / GW * (XR[1] - XR[0]), YR[0] + (j + 0.5) / GH * (YR[1] - YR[0])]);
    const methods = {};
    function build(key) {
      const trees = ML.growForest(tr.X, tr.y, M, key === 'bag' ? 2 : 1, 7);
      const grids = trees.map((t) => Float32Array.from(cells, (c) => ML.treePredict(t, c)));
      const tests = trees.map((t) => Float32Array.from(te.X, (x) => ML.treePredict(t, x)));
      let single = 0;
      for (const p of tests) { let c = 0; p.forEach((v, i) => (c += (v > 0.5 ? 1 : 0) === te.y[i])); single += c / te.y.length; }
      return { trees, grids, tests, single: single / M, roots: trees.filter((t) => !t.leaf && t.f === 0).length / M };
    }
    const st = { method: 'bag', m: 1 };
    function get() { return methods[st.method] || (methods[st.method] = build(st.method)); }

    const thumbs = $('f-thumbs');
    for (let k = 0; k < 4; k++) {
      const fig = document.createElement('figure');
      fig.innerHTML = '<canvas height="104"></canvas><figcaption></figcaption>';
      thumbs.appendChild(fig);
    }
    function drawPoints(ctx, sc, r) {
      tr.X.forEach((x, i) => dot(ctx, sc.x(x[0]), sc.y(x[1]), r, tr.y[i] ? C.green : C.amber, C.card, r > 2 ? 1 : 0.6));
    }
    function draw() {
      const d = get(), m = st.m;
      const avg = new Float32Array(GW * GH);
      for (let k = 0; k < m; k++) { const g = d.grids[k]; for (let c = 0; c < avg.length; c++) avg[c] += g[c]; }
      for (let c = 0; c < avg.length; c++) avg[c] /= m;
      // main map
      const { ctx, w, h } = fit($('f-map'));
      clearBg(ctx, w, h);
      const rect = { x: 44, y: 20, w: w - 52, h: h - 56 };
      paintGrid(ctx, avg, GW, GH, rect, 'green', 'amber');
      const sc = scaler(rect, XR, YR);
      drawPoints(ctx, sc, 3.2);
      frame(ctx, rect);
      axes(ctx, rect, XR, YR, { xlabel: 'credit score →', ylabel: '↑ debt-to-income %' });
      // thumbnails
      [...thumbs.querySelectorAll('figure')].forEach((fig, k) => {
        const cv = fig.querySelector('canvas'), o = fit(cv);
        const r2 = { x: 0, y: 0, w: o.w, h: o.h };
        paintGrid(o.ctx, d.grids[k], GW, GH, r2, 'green', 'amber');
        drawPoints(o.ctx, scaler(r2, XR, YR), 1.4);
        const t = d.trees[k];
        fig.querySelector('figcaption').textContent = 'Tree ' + (k + 1) + ' · first asks about ' + (t.leaf ? '—' : t.f === 0 ? 'credit score' : 'debt-to-income');
      });
      // stats
      let c = 0;
      for (let i = 0; i < te.y.length; i++) { let s = 0; for (let k = 0; k < m; k++) s += d.tests[k][i]; c += (s / m > 0.5 ? 1 : 0) === te.y[i]; }
      $('f-acc').textContent = fmtPct(c / te.y.length);
      $('f-single').textContent = fmtPct(d.single);
      $('f-root').textContent = Math.round(100 * d.roots) + '% of ' + M;
      $('f-m-out').textContent = m;
    }
    $('f-m').addEventListener('input', (e) => { st.m = +e.target.value; draw(); });
    document.querySelectorAll('[data-method]').forEach((b) => b.addEventListener('click', () => {
      st.method = b.dataset.method;
      document.querySelectorAll('[data-method]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }));
    return { draw };
  })();

  /* ---------------- 02 · Random-feature lab (8-D loans) ---------------- */
  const FEAT_COLORS = ['#2f8a5f', '#d9822b', '#4f7cc0', '#9a72c9', '#c9a227', '#d0628a', '#9aa09b', '#6b726d'];
  const R = (function () {
    const tr = ML.makeLoans8(300, 1), te = ML.makeLoans8(2000, 2), M = 150;
    const cache = {};
    const st = { mtry: 8, m: 60 };
    function build(mtry) {
      const trees = ML.growForest(tr.X, tr.y, M, mtry, 3);
      const preds = trees.map((t) => Float32Array.from(te.X, (x) => ML.treePredict(t, x)));
      const n = te.y.length, S = new Float32Array(n), curve = new Float32Array(M);
      for (let m = 0; m < M; m++) {
        const p = preds[m]; let c = 0;
        for (let i = 0; i < n; i++) { S[i] += p[i]; c += (S[i] / (m + 1) > 0.5 ? 1 : 0) === te.y[i]; }
        curve[m] = c / n;
      }
      let single = 0;
      for (const p of preds) { let c = 0; for (let i = 0; i < n; i++) c += (p[i] > 0.5 ? 1 : 0) === te.y[i]; single += c / n; }
      // average pairwise correlation of tree outputs (first 16 trees)
      const K = 16, mu = [], sd = [];
      for (let a = 0; a < K; a++) { let s = 0; for (const v of preds[a]) s += v; mu.push(s / n); let q = 0; for (const v of preds[a]) q += (v - mu[a]) ** 2; sd.push(Math.sqrt(q)); }
      let rs = 0, rc = 0;
      for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
        let s = 0; const pa = preds[a], pb = preds[b];
        for (let i = 0; i < n; i++) s += (pa[i] - mu[a]) * (pb[i] - mu[b]);
        rs += s / (sd[a] * sd[b]); rc++;
      }
      return { curve, single: single / M, rho: rs / rc, roots: trees.slice(0, 48).map((t) => (t.leaf ? -1 : t.f)) };
    }
    const get = (k) => cache[k] || (cache[k] = build(k));

    const chips = $('r-chips');
    for (let i = 0; i < 48; i++) chips.appendChild(document.createElement('span'));
    $('r-legend').innerHTML = ML.LOAN_FEATURES.map((f, i) => '<span><i style="background:' + FEAT_COLORS[i] + '"></i>' + f + '</span>').join('');

    function draw() {
      const bag = get(8), d = get(st.mtry), m = st.m;
      [...chips.children].forEach((el, i) => {
        const f = d.roots[i];
        el.style.background = f < 0 ? C.line : FEAT_COLORS[f];
        el.title = 'Tree ' + (i + 1) + ': ' + (f < 0 ? 'leaf' : ML.LOAN_FEATURES[f]);
      });
      const { ctx, w, h } = fit($('r-curve'));
      clearBg(ctx, w, h);
      const rect = { x: 44, y: 8, w: w - 54, h: h - 40 };
      let lo = 1, hi = 0;
      for (const c of [bag.curve, d.curve]) for (const v of c) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const yr = [Math.floor((lo - 0.005) * 100) / 100, Math.ceil((hi + 0.005) * 100) / 100], xr = [1, M];
      axes(ctx, rect, xr, yr, { grid: true, yfmt: (v) => Math.round(v * 100) + '%', xlabel: 'number of trees', xticks: [1, 25, 50, 75, 100, 125, 150] });
      const sc = scaler(rect, xr, yr);
      line(ctx, Array.from(bag.curve, (v, i) => [sc.x(i + 1), sc.y(v)]), C.grey, 2);
      if (st.mtry !== 8) line(ctx, Array.from(d.curve, (v, i) => [sc.x(i + 1), sc.y(v)]), C.green, 2.5);
      ctx.save(); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sc.x(m), rect.y); ctx.lineTo(sc.x(m), rect.y + rect.h); ctx.stroke(); ctx.restore();
      dot(ctx, sc.x(m), sc.y(d.curve[m - 1]), 4.5, st.mtry === 8 ? C.grey : C.green, C.card, 2);
      $('r-rho').textContent = d.rho.toFixed(2);
      $('r-single').textContent = fmtPct(d.single);
      $('r-acc').textContent = fmtPct(d.curve[m - 1]);
      $('r-mtry-out').textContent = st.mtry;
      $('r-m-out').textContent = m;
      $('r-mode').innerHTML = st.mtry === 8
        ? 'm<sub>try</sub> = 8 means every feature is always allowed. That is plain bagging.'
        : 'Each split picks the best of ' + st.mtry + ' randomly chosen feature' + (st.mtry > 1 ? 's' : '') + ' (out of 8). Common default for classification: √8 ≈ 3.' +
          (st.mtry <= 2 ? ' Notice some trees now open with pure noise (zip-code digit, day of week). Make m<sub>try</sub> too small and the trees get too weak.' : '');
    }
    $('r-mtry').addEventListener('input', (e) => { st.mtry = +e.target.value; draw(); });
    $('r-m').addEventListener('input', (e) => { st.m = +e.target.value; draw(); });
    return { draw };
  })();

  /* ---------------- 02b · variance floor ---------------- */
  const V = (function () {
    let rho = 0.5;
    function draw() {
      const { ctx, w, h } = fit($('v-curve'));
      clearBg(ctx, w, h);
      const rect = { x: 40, y: 8, w: w - 50, h: h - 40 }, xr = [1, 50], yr = [0, 1];
      axes(ctx, rect, xr, yr, { grid: true, xlabel: 'number of trees M', xticks: [1, 10, 20, 30, 40, 50], yticks: [0, 0.25, 0.5, 0.75, 1] });
      const sc = scaler(rect, xr, yr), pts = [], ind = [];
      for (let m = 1; m <= 50; m += 0.25) { pts.push([sc.x(m), sc.y(rho + (1 - rho) / m)]); ind.push([sc.x(m), sc.y(1 / m)]); }
      line(ctx, ind, C.line, 1.5);
      line(ctx, [[rect.x, sc.y(rho)], [rect.x + rect.w, sc.y(rho)]], C.muted, 1.5, [5, 4]);
      line(ctx, pts, C.green, 2.5);
      ctx.save(); ctx.fillStyle = C.muted; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'right';
      ctx.fillText('floor ρσ² = ' + rho.toFixed(2) + 'σ²', rect.x + rect.w - 4, sc.y(rho) - 6);
      ctx.textAlign = 'left'; ctx.fillText('independent trees (ρ = 0)', sc.x(6.5), sc.y(1 / 6) + 4);
      ctx.restore();
      $('v-rho-out').textContent = rho.toFixed(2);
    }
    $('v-rho').addEventListener('input', (e) => { rho = +e.target.value; draw(); });
    return { draw };
  })();

  /* ---------------- 04 · Least-squares boosting (bikes) ---------------- */
  const B = (function () {
    const tr = ML.makeBikes(120, 3), te = ML.makeBikes(2000, 44), ROUNDS = 300;
    const XR = [-4, 36], GX = [];
    for (let i = 0; i <= 240; i++) GX.push(XR[0] + (XR[1] - XR[0]) * i / 240);
    const ones = tr.X.map(() => 1);
    const st = { nu: 1, depth: 1, m: 0, run: null };
    function build() {
      const N = tr.X.length, f0 = tr.y.reduce((a, b) => a + b, 0) / N;
      const fTr = new Float64Array(N).fill(f0), fTe = new Float64Array(te.X.length).fill(f0), fG = new Float64Array(GX.length).fill(f0);
      const curves = [Float64Array.from(fG)], resid = [], nextTree = [], rmse = [];
      const err = () => [Math.sqrt(tr.y.reduce((s, y, i) => s + (y - fTr[i]) ** 2, 0) / N), Math.sqrt(te.y.reduce((s, y, i) => s + (y - fTe[i]) ** 2, 0) / te.y.length)];
      rmse.push(err());
      for (let m = 0; m < ROUNDS; m++) {
        const r = tr.y.map((y, i) => y - fTr[i]);
        const t = ML.regTree1D(tr.X, r, ones, st.depth);
        resid.push(r);
        nextTree.push(Float64Array.from(GX, (x) => ML.regTree1DPredict(t, x)));
        for (let i = 0; i < N; i++) fTr[i] += st.nu * ML.regTree1DPredict(t, tr.X[i]);
        for (let i = 0; i < fTe.length; i++) fTe[i] += st.nu * ML.regTree1DPredict(t, te.X[i]);
        for (let i = 0; i < GX.length; i++) fG[i] += st.nu * nextTree[m][i];
        curves.push(Float64Array.from(fG));
        rmse.push(err());
      }
      return { curves, resid, nextTree, rmse };
    }
    let D = null;
    function rebuild() { D = build(); st.m = 0; }

    function draw() {
      const m = st.m;
      // fit
      let o = fit($('b-fit')), ctx = o.ctx;
      clearBg(ctx, o.w, o.h);
      let rect = { x: 48, y: 20, w: o.w - 58, h: o.h - 52 }, yr = [0, 6500];
      axes(ctx, rect, XR, yr, { grid: true, xlabel: 'temperature °C', ylabel: 'rentals / day', yfmt: (v) => (v ? v / 1000 + 'k' : '0') });
      let sc = scaler(rect, XR, yr);
      tr.X.forEach((x, i) => dot(ctx, sc.x(x), sc.y(Math.min(tr.y[i], 6500)), 3, C.grey + '99'));
      line(ctx, GX.map((x, i) => [sc.x(x), sc.y(D.curves[m][i])]), C.green, 2.6);
      // residuals
      o = fit($('b-res')); ctx = o.ctx;
      clearBg(ctx, o.w, o.h);
      rect = { x: 48, y: 8, w: o.w - 58, h: o.h - 34 }; yr = [-3600, 3600];
      axes(ctx, rect, XR, yr, { grid: true, yticks: [-3000, -1500, 0, 1500, 3000], yfmt: (v) => (v ? (v / 1000) + 'k' : '0') });
      sc = scaler(rect, XR, yr);
      line(ctx, [[rect.x, sc.y(0)], [rect.x + rect.w, sc.y(0)]], C.muted, 1);
      if (m < ROUNDS) {
        const r = D.resid[m];
        tr.X.forEach((x, i) => {
          const y = Math.max(-3600, Math.min(3600, r[i]));
          ctx.save(); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(sc.x(x), sc.y(0)); ctx.lineTo(sc.x(x), sc.y(y)); ctx.stroke(); ctx.restore();
          dot(ctx, sc.x(x), sc.y(y), 2.6, C.grey);
        });
        line(ctx, GX.map((x, i) => [sc.x(x), sc.y(Math.max(-3600, Math.min(3600, D.nextTree[m][i])))]), C.amber, 2.6);
      }
      // error curve
      o = fit($('b-curve')); ctx = o.ctx;
      clearBg(ctx, o.w, o.h);
      rect = { x: 48, y: 8, w: o.w - 58, h: o.h - 40 };
      let peak = 0; for (let i = 20; i <= ROUNDS; i++) peak = Math.max(peak, D.rmse[i][1]);
      const top = Math.ceil(1.6 * peak / 100) * 100; yr = [0, top];
      axes(ctx, rect, [0, ROUNDS], yr, { grid: true, xlabel: 'trees m', xticks: [0, 50, 100, 150, 200, 250, 300] });
      sc = scaler(rect, [0, ROUNDS], yr);
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      line(ctx, D.rmse.map((e, i) => [sc.x(i), sc.y(e[0])]), C.grey, 2);
      line(ctx, D.rmse.map((e, i) => [sc.x(i), sc.y(e[1])]), C.green, 2.4);
      ctx.restore();
      let best = 1; D.rmse.forEach((e, i) => { if (e[1] < D.rmse[best][1]) best = i; });
      ctx.save(); ctx.fillStyle = C.muted; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
      ctx.fillText('lowest at m = ' + best, Math.max(rect.x + 40, sc.x(best)), sc.y(D.rmse[best][1]) + 16); ctx.restore();
      dot(ctx, sc.x(best), sc.y(D.rmse[best][1]), 3, C.card, C.green, 1.5);
      ctx.save(); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sc.x(m), rect.y); ctx.lineTo(sc.x(m), rect.y + rect.h); ctx.stroke(); ctx.restore();
      dot(ctx, sc.x(m), sc.y(Math.min(top, D.rmse[m][1])), 4.5, C.green, C.card, 2);
      $('b-m').textContent = m === 0 ? '0 (just the average day)' : m;
      $('b-train').textContent = Math.round(D.rmse[m][0]).toLocaleString() + ' bikes';
      $('b-test').textContent = Math.round(D.rmse[m][1]).toLocaleString() + ' bikes';
      $('b-nu-out').textContent = st.nu.toFixed(2);
    }
    function step(k) { st.m = Math.min(ROUNDS, st.m + k); draw(); if (st.m >= ROUNDS) stop(); }
    function stop() { clearInterval(st.run); st.run = null; $('b-play').textContent = '▶ Play'; $('b-play').setAttribute('aria-pressed', 'false'); }
    $('b-step').onclick = () => step(1);
    $('b-step10').onclick = () => step(10);
    $('b-reset').onclick = () => { stop(); st.m = 0; draw(); };
    $('b-play').onclick = () => {
      if (st.run) return stop();
      if (st.m >= ROUNDS) st.m = 0;
      $('b-play').textContent = '❚❚ Pause'; $('b-play').setAttribute('aria-pressed', 'true');
      st.run = setInterval(() => step(st.m < 30 ? 1 : 3), 140);
    };
    $('b-nu').addEventListener('input', (e) => { st.nu = +e.target.value; $('b-nu-out').textContent = st.nu.toFixed(2); });
    $('b-nu').addEventListener('change', () => { stop(); rebuild(); draw(); });
    $('b-depth').addEventListener('change', (e) => { st.depth = +e.target.value; stop(); rebuild(); draw(); });
    rebuild();
    return { draw };
  })();

  /* ---------------- 05/06 · AdaBoost vs LogitBoost (spam) ---------------- */
  const A = (function () {
    const base = ML.makeEmails(150, 5), te = ML.makeEmails(3000, 77), ROUNDS = 200;
    const XR = [0, 10], YR = [0, 50], GW = 100, GH = 60;
    const cells = [];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) cells.push([XR[0] + (i + 0.5) / GW * 10, YR[0] + (j + 0.5) / GH * 50]);
    const st = { algo: 'ada', noise: false, m: 0, run: null };
    let D = null;

    function errRate(F, y) { let c = 0; for (let i = 0; i < y.length; i++) c += (F[i] > 0 ? 1 : -1) !== y[i]; return c; }
    function runAda(X, y) {
      const N = X.length, Ftr = new Float64Array(N), Fte = new Float64Array(te.X.length);
      const w = new Float64Array(N).fill(1 / N), L = [], snaps = [Float64Array.from(Ftr)], trE = [errRate(Ftr, y)], teE = [errRate(Fte, te.y)];
      for (let m = 0; m < ROUNDS; m++) {
        const s = ML.classStump(X, y, w), e = Math.min(Math.max(s.err, 1e-6), 1 - 1e-6), beta = 0.5 * Math.log((1 - e) / e);
        L.push({ f: s.f, t: s.t, err: s.err, beta, h: (x) => beta * ML.stumpPredict(s, x) });
        for (let i = 0; i < N; i++) { Ftr[i] += beta * ML.stumpPredict(s, X[i]); w[i] = Math.exp(-y[i] * Ftr[i]); }
        for (let i = 0; i < Fte.length; i++) Fte[i] += beta * ML.stumpPredict(s, te.X[i]);
        snaps.push(Float64Array.from(Ftr)); trE.push(errRate(Ftr, y)); teE.push(errRate(Fte, te.y));
      }
      return { L, snaps, trE, teE, weights: (F) => Array.from(F, (f, i) => Math.exp(-y[i] * f)) };
    }
    function runLogit(X, y) {
      const N = X.length, Ftr = new Float64Array(N), Fte = new Float64Array(te.X.length);
      const L = [], snaps = [Float64Array.from(Ftr)], trE = [errRate(Ftr, y)], teE = [errRate(Fte, te.y)];
      for (let m = 0; m < ROUNDS; m++) {
        const z = new Float64Array(N), w = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          const p = ML.sigmoid(2 * Ftr[i]), ys = y[i] > 0 ? 1 : 0;
          w[i] = Math.max(p * (1 - p), 1e-8);
          z[i] = Math.max(-4, Math.min(4, (ys - p) / w[i])); // usual cap on the working response
        }
        const s = ML.regStump2D(X, z, w);
        L.push({ f: s.f, t: s.t, h: (x) => 0.5 * ML.regStumpPredict(s, x) });
        for (let i = 0; i < N; i++) Ftr[i] += 0.5 * ML.regStumpPredict(s, X[i]);
        for (let i = 0; i < Fte.length; i++) Fte[i] += 0.5 * ML.regStumpPredict(s, te.X[i]);
        snaps.push(Float64Array.from(Ftr)); trE.push(errRate(Ftr, y)); teE.push(errRate(Fte, te.y));
      }
      return { L, snaps, trE, teE, weights: (F) => Array.from(F, (f) => { const p = ML.sigmoid(2 * f); return p * (1 - p); }) };
    }
    function rebuild() {
      const X = base.X.slice(), y = base.y.slice(), out = new Set();
      if (st.noise) ML.OUTLIERS.forEach((o) => { out.add(X.length); X.push(o.x); y.push(o.y); });
      D = { X, y, out, ada: runAda(X, y), logit: runLogit(X, y) };
    }

    function draw() {
      const R = D[st.algo], m = st.m, N = D.X.length;
      // decision map
      const grid = new Float32Array(GW * GH);
      for (let k = 0; k < m; k++) { const h = R.L[k].h; for (let c = 0; c < cells.length; c++) grid[c] += h(cells[c]); }
      for (let c = 0; c < grid.length; c++) grid[c] = ML.sigmoid(2 * grid[c]);
      let o = fit($('a-map')), ctx = o.ctx;
      clearBg(ctx, o.w, o.h);
      const rect = { x: 40, y: 20, w: o.w - 48, h: o.h - 56 };
      paintGrid(ctx, grid, GW, GH, rect, 'amber', 'green');
      const sc = scaler(rect, XR, YR);
      if (m > 0) {
        const s = R.L[m - 1];
        const pts = s.f === 0 ? [[sc.x(s.t), rect.y], [sc.x(s.t), rect.y + rect.h]] : [[rect.x, sc.y(s.t)], [rect.x + rect.w, sc.y(s.t)]];
        line(ctx, pts, C.ink, 1.6, [6, 4]);
      }
      const w = R.weights(R.snaps[m]), W = w.reduce((a, b) => a + b, 0);
      const order = D.X.map((_, i) => i).sort((a, b) => w[b] - w[a]);
      for (const i of order) {
        const r = Math.max(1.6, Math.min(19, 2.6 * Math.sqrt(N * w[i] / W)));
        const x = sc.x(D.X[i][0]), y = sc.y(D.X[i][1]);
        dot(ctx, x, y, r, D.y[i] > 0 ? C.amber : C.green, C.card, 1);
        if (D.out.has(i)) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 2 * Math.PI); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke(); }
      }
      frame(ctx, rect);
      axes(ctx, rect, XR, YR, { xlabel: 'links in email →', ylabel: '↑ % capital letters' });

      // stats
      $('a-m').textContent = m;
      const isAda = st.algo === 'ada';
      $('a-err-row').classList.toggle('off', !isAda || m === 0);
      $('a-beta-row').classList.toggle('off', !isAda || m === 0);
      $('a-err').textContent = isAda && m ? R.L[m - 1].err.toFixed(3) : '–';
      $('a-beta').textContent = isAda && m ? R.L[m - 1].beta.toFixed(3) : '–';
      $('a-train').textContent = R.trE[m] + ' / ' + N;
      $('a-test').textContent = fmtPct(R.teE[m] / te.y.length);
      $('a-share-row').classList.toggle('off', !st.noise);
      let sh = 0; D.out.forEach((i) => (sh += w[i]));
      $('a-share').textContent = st.noise ? fmtPct(sh / W) : '–';

      // test error curves
      o = fit($('a-curve')); ctx = o.ctx;
      clearBg(ctx, o.w, o.h);
      const r2 = { x: 40, y: 8, w: o.w - 50, h: o.h - 38 };
      const n = te.y.length, yr = [0, 0.3];
      axes(ctx, r2, [0, ROUNDS], yr, { grid: true, yticks: [0, 0.1, 0.2, 0.3], yfmt: (v) => Math.round(v * 100) + '%', xlabel: 'rounds', xticks: [0, 50, 100, 150, 200] });
      const s2 = scaler(r2, [0, ROUNDS], yr);
      const clip = (v) => Math.min(0.3, v / n);
      line(ctx, D.ada.teE.map((e, i) => [s2.x(i), s2.y(clip(e))]), C.amber, isAda ? 2.6 : 1.6);
      line(ctx, D.logit.teE.map((e, i) => [s2.x(i), s2.y(clip(e))]), C.green, isAda ? 1.6 : 2.6);
      ctx.save(); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(s2.x(m), r2.y); ctx.lineTo(s2.x(m), r2.y + r2.h); ctx.stroke(); ctx.restore();
      dot(ctx, s2.x(m), s2.y(clip(R.teE[m])), 4.5, isAda ? C.amber : C.green, C.card, 2);
    }
    function step(k) { st.m = Math.min(ROUNDS, st.m + k); draw(); if (st.m >= ROUNDS) stop(); }
    function stop() { clearInterval(st.run); st.run = null; $('a-play').textContent = '▶ Play'; $('a-play').setAttribute('aria-pressed', 'false'); }
    $('a-step').onclick = () => step(1);
    $('a-step10').onclick = () => step(10);
    $('a-reset').onclick = () => { stop(); st.m = 0; draw(); };
    $('a-play').onclick = () => {
      if (st.run) return stop();
      if (st.m >= ROUNDS) st.m = 0;
      $('a-play').textContent = '❚❚ Pause'; $('a-play').setAttribute('aria-pressed', 'true');
      st.run = setInterval(() => step(st.m < 20 ? 1 : 2), 160);
    };
    $('a-noise').addEventListener('change', (e) => { st.noise = e.target.checked; rebuild(); draw(); });
    document.querySelectorAll('[data-algo]').forEach((b) => b.addEventListener('click', () => {
      st.algo = b.dataset.algo;
      document.querySelectorAll('[data-algo]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }));
    rebuild();
    return { draw };
  })();

  /* ---------------- 06 · loss curves ---------------- */
  const Lc = (function () {
    let mg = -2;
    const L01 = (m) => (m < 0 ? 1 : 0), Lexp = (m) => Math.exp(-m), Llog = (m) => Math.log2(1 + Math.exp(-2 * m));
    function draw() {
      const { ctx, w, h } = fit($('l-curve'));
      clearBg(ctx, w, h);
      const rect = { x: 36, y: 8, w: w - 46, h: h - 40 }, xr = [-3, 3], yr = [0, 10];
      axes(ctx, rect, xr, yr, { grid: true, xlabel: 'margin ỹ·f   (← wrong · right →)', yticks: [0, 2, 4, 6, 8, 10] });
      const sc = scaler(rect, xr, yr);
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      const P = (fn) => { const pts = []; for (let x = -3; x <= 3.001; x += 0.02) pts.push([sc.x(x), sc.y(fn(x))]); return pts; };
      line(ctx, [[sc.x(-3), sc.y(1)], [sc.x(0), sc.y(1)], [sc.x(0), sc.y(0)], [sc.x(3), sc.y(0)]], C.grey, 2);
      line(ctx, P(Lexp), C.amber, 2.6);
      line(ctx, P(Llog), C.green, 2.6);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sc.x(mg), rect.y); ctx.lineTo(sc.x(mg), rect.y + rect.h); ctx.stroke(); ctx.restore();
      dot(ctx, sc.x(mg), sc.y(L01(mg)), 4, C.grey, C.card, 1.5);
      if (Lexp(mg) <= 10) dot(ctx, sc.x(mg), sc.y(Lexp(mg)), 4.5, C.amber, C.card, 1.5);
      dot(ctx, sc.x(mg), sc.y(Llog(mg)), 4.5, C.green, C.card, 1.5);
      $('l-m-out').textContent = (mg < 0 ? '−' : '') + Math.abs(mg).toFixed(2);
      $('l-01').textContent = L01(mg);
      $('l-exp').textContent = Lexp(mg).toFixed(2);
      $('l-log').textContent = Llog(mg).toFixed(2);
    }
    $('l-m').addEventListener('input', (e) => { mg = +e.target.value; draw(); });
    return { draw };
  })();

  /* ---------------- wiring ---------------- */
  function drawAll() { readTheme(); F.draw(); R.draw(); V.draw(); B.draw(); A.draw(); Lc.draw(); }
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

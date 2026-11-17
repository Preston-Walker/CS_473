/* Interactive demos for the 19.3 companion page. Depends on ml.js (window.ML). */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const pct = (v, d) => (100 * v).toFixed(d == null ? 0 : d) + '%';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- drawing helpers ---------------- */
  let C = {};
  const TOK = ['bg', 'card', 'ink', 'muted', 'line', 'soft', 'green', 'amber', 'grey', 'violet', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8'];
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    C = { rgb: {} };
    for (const k of TOK) { C[k] = s.getPropertyValue('--' + k).trim(); C.rgb[k] = hexRgb(C[k]); }
  }
  readTheme();
  const rgba = (k, a) => `rgba(${C.rgb[k].join(',')},${a})`;
  const KC = (j) => 'k' + ((j % 8) + 1);
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
  const font = (px, weight) => `${weight || ''} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  function dot(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  }
  function cross(ctx, x, y, s, color) {
    ctx.strokeStyle = C.card; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
  }
  function niceTicks(a, b, n) {
    const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag, step = (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  // rect = plotting area; sx, sy map data -> pixels
  function axes(ctx, rect, xt, yt, sx, sy, xl, yl, fmtY) {
    ctx.save();
    ctx.font = font(11); ctx.fillStyle = C.muted; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt) { const x = sx(v); ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke(); ctx.fillText(String(v), x, rect.y + rect.h + 5); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt) { const y = sy(v); ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke(); ctx.fillText((fmtY || String)(v), rect.x - 6, y); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if (xl) ctx.fillText(xl, rect.x + rect.w / 2, rect.y + rect.h + 34);
    if (yl) { ctx.translate(12, rect.y + rect.h / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(yl, 0, 0); }
    ctx.restore();
  }

  /* ---------------- hero ---------------- */
  (function hero() {
    const svg = $('heroSvg'), d = ML.moons(44, 21, 0.1);
    const reveal = new Set([3, 8, 17, 30]);
    const titles = [['SUPERVISED', 'all labeled'], ['UNSUPERVISED', 'no labels'], ['SEMI-SUPERVISED', 'a few labels']];
    let html = '';
    titles.forEach(([t, s], p) => {
      const ox = 10 + p * 150;
      html += `<rect x="${ox}" y="40" width="140" height="200" rx="12" style="fill:var(--card);stroke:var(--line)"/>`;
      html += `<text x="${ox + 70}" y="22" text-anchor="middle" class="svg-label">${t}</text>`;
      html += `<text x="${ox + 70}" y="262" text-anchor="middle" class="svg-small">${s}</text>`;
      d.X.forEach((x, i) => {
        const cx = ox + 18 + (x[0] + 1.25) / 3.5 * 104, cy = 210 - (x[1] + 0.75) / 2.0 * 140;
        const col = d.y[i] ? 'var(--amber)' : 'var(--green)';
        if (p === 0 || (p === 2 && reveal.has(i))) html += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${p === 2 ? 5.5 : 4}" style="fill:${col};stroke:var(--card);stroke-width:1.5"/>`;
        else html += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" style="fill:none;stroke:var(--grey);stroke-width:1.3"/>`;
      });
    });
    html += `<text x="230" y="290" text-anchor="middle" class="svg-small">same data · different amounts of answers</text>`;
    svg.innerHTML = html;
  })();

  /* ---------------- 2 · comparison lab ---------------- */
  const cmp = (function () {
    const tr = ML.moons(300, 7, 0.12), te = ML.moons(400, 99, 0.12);
    const W = ML.buildGraph(tr.X, 12, 0.15);
    const km = ML.kmeans(tr.X, 2, 3);
    const kmTest = ML.kmeansAssign(te.X, km.C);
    let accK = kmTest.reduce((s, v, i) => s + (v === te.y[i]), 0) / te.X.length;
    accK = Math.max(accK, 1 - accK);
    const XR = [-1.45, 2.45], YR = [-0.95, 1.45];
    let seed = 1, order = [];
    function reorder() {
      const o = ML.shuffle(tr.X.map((_, i) => i), ML.rng(seed));
      const i0 = o.findIndex((i) => tr.y[i] === 0), i1 = o.findIndex((i) => tr.y[i] === 1);
      order = [o[i0], o[i1]].concat(o.filter((_, k) => k !== i0 && k !== i1));
    }
    reorder();
    let cache = {};
    function compute(n) {
      if (cache.n === n && cache.seed === seed) return cache;
      const L = order.slice(0, n), LX = L.map((i) => tr.X[i]), LY = L.map((i) => tr.y[i]);
      const k = n < 10 ? 1 : 3;
      const supPred = (x) => ML.knn(LX, LY, x, k);
      const labels = tr.X.map(() => null); L.forEach((i) => { labels[i] = tr.y[i]; });
      const f = ML.propagate(W, labels, 1000), hard = ML.hardLabels(f, labels);
      const semiPred = (x) => ML.knn(tr.X, hard, x, 5);
      const acc = (pred) => te.X.reduce((s, x, i) => s + ((pred(x) > 0.5 ? 1 : 0) === te.y[i]), 0) / te.X.length;
      cache = { n, seed, L: new Set(L), labels, hard, supPred, semiPred, accS: acc(supPred), accSS: acc(semiPred) };
      return cache;
    }
    function frame(canvas) {
      const { ctx, w, h } = fit(canvas);
      const sx = (v) => (v - XR[0]) / (XR[1] - XR[0]) * w, sy = (v) => h - (v - YR[0]) / (YR[1] - YR[0]) * h;
      return { ctx, w, h, sx, sy };
    }
    function tint(f, region) {
      const cell = 7;
      for (let px = 0; px < f.w; px += cell) for (let py = 0; py < f.h; py += cell) {
        const x = [XR[0] + (px + cell / 2) / f.w * (XR[1] - XR[0]), YR[0] + (1 - (py + cell / 2) / f.h) * (YR[1] - YR[0])];
        f.ctx.fillStyle = region(x); f.ctx.fillRect(px, py, cell, cell);
      }
    }
    function draw() {
      const n = +$('cmpN').value, cost = +$('cmpCost').value, r = compute(n);
      $('cmpNOut').textContent = n; $('cmpCostOut').textContent = '$' + cost.toFixed(2);
      const col = (c) => (c ? 'amber' : 'green');
      // supervised
      let f = frame($('cmpSup'));
      tint(f, (x) => rgba(col(r.supPred(x) > 0.5 ? 1 : 0), 0.13));
      tr.X.forEach((x, i) => { if (!r.L.has(i)) dot(f.ctx, f.sx(x[0]), f.sy(x[1]), 2.4, null, rgba('grey', 0.55), 1); });
      tr.X.forEach((x, i) => { if (r.L.has(i)) dot(f.ctx, f.sx(x[0]), f.sy(x[1]), 5.5, C[col(tr.y[i])], C.card, 1.5); });
      // unsupervised
      f = frame($('cmpUns'));
      tint(f, (x) => rgba(KC(ML.kmeansAssign([x], km.C)[0]), 0.12));
      tr.X.forEach((x, i) => dot(f.ctx, f.sx(x[0]), f.sy(x[1]), 2.8, rgba(KC(km.a[i]), 0.85)));
      km.C.forEach((c, j) => cross(f.ctx, f.sx(c[0]), f.sy(c[1]), 6, C[KC(j)]));
      f.ctx.font = font(11, 600); f.ctx.fillStyle = C.muted; f.ctx.fillText('cluster A / cluster B: names unknown', 8, 16);
      // semi
      f = frame($('cmpSemi'));
      tint(f, (x) => rgba(col(r.semiPred(x) > 0.5 ? 1 : 0), 0.13));
      tr.X.forEach((x, i) => { if (!r.L.has(i)) dot(f.ctx, f.sx(x[0]), f.sy(x[1]), 2.6, rgba(col(r.hard[i]), 0.4)); });
      tr.X.forEach((x, i) => { if (r.L.has(i)) dot(f.ctx, f.sx(x[0]), f.sy(x[1]), 5.5, C[col(tr.y[i])], C.card, 1.5); });

      $('cmpSupAcc').textContent = pct(r.accS, 1);
      $('cmpUnsAcc').textContent = pct(accK, 1);
      $('cmpSemiAcc').textContent = pct(r.accSS, 1);
      const spend = (n * cost).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
      const gap = r.accSS - r.accS;
      let msg = `Labeling <b>${n}</b> tickets costs about <b>${spend}</b>. `;
      if (gap > 0.03) msg += `With that budget, using the 300 − ${n} = ${300 - n} unlabeled tickets adds <b>${(100 * gap).toFixed(1)} points</b> of accuracy, at no extra labeling cost.`;
      else if (gap < -0.03) msg += `Here the unlabeled data hurt by ${(100 * -gap).toFixed(1)} points. That can happen when a few labels sit in an awkward spot; try picking different tickets.`;
      else msg += `Supervised and semi-supervised are now within a few points of each other. With this many labels, the unlabeled data adds little.`;
      $('cmpReadout').innerHTML = msg;
    }
    $('cmpN').addEventListener('input', draw);
    $('cmpCost').addEventListener('input', draw);
    $('cmpShuffle').addEventListener('click', () => { seed++; reorder(); draw(); });
    return { draw };
  })();

  /* ---------------- 3a · k-means ---------------- */
  const km = (function () {
    const X = ML.shoppers(11);
    const Z = X.map((x) => [x[0] / 20, x[1] / 200]); // rescale both axes to 0-1 before measuring distance
    const XR = [0, 21], YR = [0, 210];
    let k = 4, seed = 5, Cn, a, it, done, timer = null;
    const elbow = [];
    for (let kk = 1; kk <= 8; kk++) {
      let best = Infinity;
      for (let s = 1; s <= 6; s++) best = Math.min(best, ML.kmeans(Z, kk, 100 * kk + s).J);
      elbow.push(best);
    }
    function reset() { stop(); Cn = ML.kmeansInit(Z, k, seed++); a = null; it = 0; done = false; draw(); }
    function step() {
      if (done) return;
      const a2 = ML.kmeansAssign(Z, Cn);
      if (a && a2.every((v, i) => v === a[i])) { done = true; }
      else { a = a2; Cn = ML.kmeansUpdate(Z, a, Cn); it++; }
      draw();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function run() {
      stop();
      if (reduceMotion) { let g = 0; while (!done && g++ < 200) step(); return; }
      timer = setInterval(() => { step(); if (done) stop(); }, 380);
    }
    function draw() {
      $('kmKOut').textContent = k; $('kmIt').textContent = it + (done ? ' (converged)' : '');
      $('kmJ').textContent = a ? ML.inertia(Z, a, Cn).toFixed(2) : '–';
      const { ctx, w, h } = fit($('kmCanvas'));
      const rect = { x: 46, y: 10, w: w - 58, h: h - 56 };
      const sx = (v) => rect.x + (v - XR[0]) / (XR[1] - XR[0]) * rect.w, sy = (v) => rect.y + rect.h - (v - YR[0]) / (YR[1] - YR[0]) * rect.h;
      axes(ctx, rect, niceTicks(0, 20, 5), niceTicks(0, 200, 5), sx, sy, 'store visits per month', '', (v) => '$' + v);
      X.forEach((x, i) => dot(ctx, sx(x[0]), sy(x[1]), 3.6, a ? rgba(KC(a[i]), 0.8) : rgba('grey', 0.6)));
      Cn.forEach((c, j) => cross(ctx, sx(c[0] * 20), sy(c[1] * 200), 8, C[KC(j)]));
      // elbow
      const e = fit($('kmElbow'));
      const er = { x: 40, y: 8, w: e.w - 50, h: e.h - 34 }, ymax = elbow[0] * 1.05;
      const ex = (v) => er.x + (v - 1) / 7 * er.w, ey = (v) => er.y + er.h - v / ymax * er.h;
      axes(e.ctx, er, [1, 2, 3, 4, 5, 6, 7, 8], niceTicks(0, ymax, 3), ex, ey, '', '', (v) => v.toFixed(0));
      e.ctx.strokeStyle = C.violet; e.ctx.lineWidth = 2; e.ctx.beginPath();
      elbow.forEach((v, i) => { const px = ex(i + 1), py = ey(v); i ? e.ctx.lineTo(px, py) : e.ctx.moveTo(px, py); }); e.ctx.stroke();
      elbow.forEach((v, i) => dot(e.ctx, ex(i + 1), ey(v), i + 1 === k ? 6 : 3, i + 1 === k ? C.amber : C.violet, i + 1 === k ? C.card : null, 2));
      e.ctx.font = font(10.5); e.ctx.fillStyle = C.muted; e.ctx.textAlign = 'center'; e.ctx.fillText('k', er.x + er.w / 2, e.h - 2);
      // descriptions
      const box = $('kmDesc');
      if (!a) { box.innerHTML = '<p class="fine">Press “Take one step” to assign shoppers to centers.</p>'; return; }
      const rows = Cn.map((c, j) => ({ j, v: c[0] * 20, b: c[1] * 200, n: a.filter((t) => t === j).length })).filter((r) => r.n).sort((p, q) => q.n - p.n);
      box.innerHTML = rows.map((r) => `<div><i style="background:var(--${KC(r.j)})"></i><b>~${r.v.toFixed(1)} visits/mo · $${r.b.toFixed(0)} basket</b><span>${r.n} shoppers</span></div>`).join('');
    }
    $('kmK').addEventListener('input', (ev) => { k = +ev.target.value; reset(); });
    $('kmStep').addEventListener('click', () => { stop(); step(); });
    $('kmRun').addEventListener('click', run);
    $('kmReset').addEventListener('click', reset);
    reset();
    return { draw };
  })();

  /* ---------------- 3b · anomaly detection ---------------- */
  const an = (function () {
    const T = ML.transactions(5);
    const scores = ML.knnOutlierScores(T.X.map((x) => [x[0], Math.log(x[1])]), 10);
    const rank = scores.map((_, i) => i).sort((p, q) => scores[q] - scores[p]);
    const nFraud = T.fraud.reduce((s, v) => s + v, 0);
    const LY = [Math.log(0.8), Math.log(600)];
    function draw() {
      const p = +$('anPct').value, reveal = $('anReveal').checked;
      $('anPctOut').textContent = p + '%';
      const m = Math.max(1, Math.round(T.X.length * p / 100)), flagged = new Set(rank.slice(0, m));
      const { ctx, w, h } = fit($('anCanvas'));
      const rect = { x: 50, y: 10, w: w - 62, h: h - 56 };
      const sx = (v) => rect.x + v / 24 * rect.w, sy = (v) => rect.y + rect.h - (Math.log(v) - LY[0]) / (LY[1] - LY[0]) * rect.h;
      axes(ctx, rect, [0, 3, 6, 9, 12, 15, 18, 21, 24], [1, 3, 10, 30, 100, 300], sx, sy, 'hour of day', '', (v) => '$' + v);
      T.X.forEach((x, i) => {
        const fr = reveal && T.fraud[i];
        dot(ctx, sx(x[0]), sy(x[1]), fr ? 4.2 : 3, fr ? C.amber : rgba('grey', 0.55));
        if (flagged.has(i)) dot(ctx, sx(x[0]), sy(x[1]), 7.5, null, C.violet, 2);
      });
      const caught = rank.slice(0, m).filter((i) => T.fraud[i]).length;
      const rows = [['Transactions', T.X.length], ['Flagged for review', m]];
      if (reveal) rows.push(['Fraud caught', `${caught} of ${nFraud}`], ['False alarms', m - caught], ['Precision (flags that were fraud)', pct(caught / m)]);
      $('anStats').innerHTML = rows.map(([l, v], i) => `<div class="${i === 2 ? 'hl' : ''}"><span>${l}</span><b>${v}</b></div>`).join('');
      let note;
      if (!reveal) note = `<p>The violet rings mark the ${m} loneliest transactions. The model was never told what fraud looks like; it only knows these points are far from the crowd.</p><p>Tick <b>Reveal</b> to see how well “unusual” matches “fraud”.</p>`;
      else if (caught < nFraud) note = `<p>Flagging ${p}% catches ${caught} of ${nFraud} frauds. The frauds it misses arrived as a tight bunch of similar charges. They are each other's nearest neighbors, so none of them looks lonely. Raise the slider to catch more, at the price of more false alarms.</p><p>Some false alarms are odd but honest: an early coffee, a large furniture purchase. Unusual doesn't always mean bad.</p>`;
      else note = `<p>All ${nFraud} frauds are caught, but ${m - caught} of the ${m} flags are false alarms, so an analyst reviews ${m} cases to find ${nFraud}.</p><p>In practice, the analyst's decisions become <em>labels</em>, and a supervised or semi-supervised model can then learn the known fraud patterns more precisely.</p>`;
      $('anNote').innerHTML = note;
    }
    $('anPct').addEventListener('input', draw);
    $('anReveal').addEventListener('change', draw);
    return { draw };
  })();

  /* ---------------- 3c · PCA ---------------- */
  const pcaLab = (function () {
    const X = ML.exams(3), P = ML.pca2(X);
    let best = Math.round(((P.angle * 180 / Math.PI) + 180) % 180), anim = null;
    function draw() {
      const deg = +$('pcaAng').value, th = deg * Math.PI / 180;
      $('pcaAngOut').textContent = deg + '°';
      const { ctx, w, h } = fit($('pcaCanvas'));
      const rect = { x: 44, y: 10, w: w - 56, h: h - 56 };
      const XR = [38, 108], YR = [30, 108];
      const s = Math.min(rect.w / (XR[1] - XR[0]), rect.h / (YR[1] - YR[0])); // equal scale so angles look right
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, mx = (XR[0] + XR[1]) / 2, my = (YR[0] + YR[1]) / 2;
      const sx = (v) => cx + (v - mx) * s, sy = (v) => cy - (v - my) * s;
      const xt = niceTicks(mx - rect.w / 2 / s, mx + rect.w / 2 / s, 6).filter((v) => sx(v) >= rect.x && sx(v) <= rect.x + rect.w);
      const yt = niceTicks(my - rect.h / 2 / s, my + rect.h / 2 / s, 5);
      axes(ctx, rect, xt, yt, sx, sy, 'midterm score', '');
      const u = [Math.cos(th), Math.sin(th)], m = P.mean;
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      ctx.strokeStyle = rgba('violet', 0.35); ctx.lineWidth = 1;
      const proj = X.map((x) => { const t = (x[0] - m[0]) * u[0] + (x[1] - m[1]) * u[1]; return [m[0] + t * u[0], m[1] + t * u[1]]; });
      X.forEach((x, i) => { ctx.beginPath(); ctx.moveTo(sx(x[0]), sy(x[1])); ctx.lineTo(sx(proj[i][0]), sy(proj[i][1])); ctx.stroke(); });
      ctx.strokeStyle = C.violet; ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(sx(m[0] - 80 * u[0]), sy(m[1] - 80 * u[1])); ctx.lineTo(sx(m[0] + 80 * u[0]), sy(m[1] + 80 * u[1])); ctx.stroke();
      X.forEach((x) => dot(ctx, sx(x[0]), sy(x[1]), 3.2, rgba('grey', 0.75)));
      proj.forEach((q) => dot(ctx, sx(q[0]), sy(q[1]), 2.6, C.violet));
      ctx.restore();
      const kept = ML.varianceAlong(P, th) / P.total, bestKept = ML.varianceAlong(P, best * Math.PI / 180) / P.total;
      $('pcaFill').style.width = pct(kept, 1);
      $('pcaRead').innerHTML = `This line keeps <b>${pct(kept)}</b> of the spread.<br><span class="fine">The best direction (${best}°) keeps ${pct(bestKept)}; the perpendicular one keeps only ${pct(1 - bestKept)}.</span>`;
    }
    function goBest() {
      if (anim) cancelAnimationFrame(anim);
      const el = $('pcaAng'), from = +el.value;
      if (reduceMotion) { el.value = best; draw(); return; }
      const t0 = performance.now();
      const tick = (t) => {
        const q = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - q, 3);
        el.value = Math.round(from + (best - from) * e); draw();
        if (q < 1) anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
    }
    $('pcaAng').addEventListener('input', draw);
    $('pcaBest').addEventListener('click', goBest);
    return { draw };
  })();

  /* tabs */
  const tabs = document.querySelectorAll('.tabs button');
  const panelDraw = { tClust: km.draw, tAnom: an.draw, tPca: pcaLab.draw };
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-selected', on); $(o.dataset.tab).hidden = !on; });
    panelDraw[b.dataset.tab]();
  }));

  /* ---------------- 4 · scenario sorter ---------------- */
  const NAMES = { S: 'Supervised', U: 'Unsupervised', SS: 'Semi-supervised' };
  const SCN = [
    ['Email spam filter', 'Millions of users click “Report spam” or “Not spam” every day.', 'S', 'Users supply the labels for free, at enormous scale. With that many labeled examples, a supervised classifier is the obvious choice.'],
    ['Grouping shoppers for marketing', 'A retailer has purchase histories for 2 million customers and wants to know what kinds of customers it has. Nobody has defined the groups.', 'U', 'There is no target to predict; the groups themselves are what you want to discover. This is clustering, as in the k-means demo.'],
    ['Reading chest X-rays', 'Radiologists have annotated 800 scans. The hospital archive holds 120,000 more that nobody has time to label.', 'SS', 'Expert labels are expensive and unlabeled scans are plentiful, which is the textbook setting for §19.3. Pseudo-labeling and consistency regularization are common choices here.'],
    ['Predicting house prices', 'A city has records of 50,000 past sales with features (size, location, age) and the final price.', 'S', 'Every record already includes the answer (sale price). This is supervised regression.'],
    ['Finding themes in news archives', 'A newspaper wants to organize 1 million old articles by topic, but has no topic tags.', 'U', 'Topic models (and embedding + clustering) discover themes from the words alone. A person then names the topics the model finds.'],
    ['Speech recognition for a rare language', 'There are 10 hours of transcribed recordings and 5,000 hours of untranscribed radio broadcasts.', 'SS', 'Transcription is slow and needs fluent speakers. Systems pre-train on the untranscribed audio, then fine-tune on the little that is labeled, combining self-supervised and semi-supervised learning.'],
    ['Factory defect detection', 'A camera photographs every part on a production line. Defects are rare and look different each time.', 'U', 'You can’t collect labeled examples of defects you haven’t seen yet. Anomaly detection learns what “normal” looks like and flags anything that departs from it.'],
    ['Classifying web pages', 'You’ve hand-labeled 300 university web pages as “course” or “faculty”, and can crawl millions more. Each page has its own text and the text of links pointing to it.', 'SS', 'This is the classic co-training example from §19.3: two “views” (page text, link text) each train a classifier that labels unlabeled pages for the other.'],
    ['Predicting customer churn', 'A phone company has 3 years of account history and knows which customers cancelled.', 'S', 'The past outcome (cancelled or not) is a label for every historic customer. Supervised classification predicts who is likely to leave next.'],
    ['Exploring single-cell gene data', 'A lab measures 20,000 genes in each of 50,000 cells and wants to see what cell types are present.', 'U', 'Dimensionality reduction (PCA, then UMAP) makes the data viewable, and clustering groups similar cells. Biologists then name the clusters, sometimes discovering new cell types.'],
    ['Content moderation at launch', 'A new app has a moderation team that can review 500 posts a week, but users post 2 million.', 'SS', 'A small, steady trickle of labels plus a flood of unlabeled posts. Semi-supervised methods (plus active learning to choose which posts to review) stretch the team’s effort.'],
    ['Credit card fraud', 'The bank has 400 confirmed fraud cases among 100 million transactions, and fraudsters keep changing tactics.', 'SS', 'This is honestly a combination: supervised or semi-supervised models learn known fraud from the few confirmed cases, and unsupervised anomaly detection catches new tactics. Partial credit for any answer here!'],
  ];
  const state = {};
  function renderScn() {
    let answered = 0, right = 0;
    $('scenarios').innerHTML = SCN.map(([t, d, ans, why], i) => {
      const pick = state[i];
      if (pick) { answered++; if (pick === ans || i === SCN.length - 1) right++; }
      const btns = ['S', 'U', 'SS'].map((k) => {
        let cls = '';
        if (pick) cls = k === ans ? 'right' : k === pick ? 'wrong' : '';
        return `<button data-i="${i}" data-k="${k}" class="${cls}" ${pick ? 'disabled' : ''}>${NAMES[k]}</button>`;
      }).join('');
      const verdict = !pick ? '' : (pick === ans ? 'Yes: ' : i === SCN.length - 1 ? 'Reasonable, and: ' : `Best fit: ${NAMES[ans]}. `);
      return `<article class="scn ${pick ? 'done' : ''}"><h3>${t}</h3><p>${d}</p><div class="choices" role="group" aria-label="Choose a learning type">${btns}</div>${pick ? `<div class="why"><b>${verdict}${NAMES[ans]}</b>${why}</div>` : ''}</article>`;
    }).join('');
    $('sortScore').textContent = `${right} of ${answered} answered correctly · ${SCN.length - answered} left`;
  }
  $('scenarios').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    state[b.dataset.i] = b.dataset.k; renderScn();
  });
  $('sortReset').addEventListener('click', () => { for (const k in state) delete state[k]; renderScn(); });
  renderScn();

  /* ---------------- 6 · decision guide ---------------- */
  function wizard() {
    const v = (n) => (document.querySelector(`input[name=${n}]:checked`) || {}).value;
    const q1 = v('q1'), q2 = v('q2'), q3 = v('q3');
    const out = $('wizOut');
    const show = (tag, cls, title, body) => { out.innerHTML = `<span class="mini-label">SUGGESTION</span><span class="tag ${cls}">${tag}</span><h3>${title}</h3>${body}`; };
    if (!q1) { out.innerHTML = '<span class="mini-label">SUGGESTION</span><p class="readout">Answer the questions on the left.</p>'; return; }
    if (q1 === 'no') return show('Unsupervised', 'violet', 'Explore with unsupervised methods',
      '<p>With no target, there is nothing to supervise. Start by plotting a PCA/UMAP projection, try clustering, and look for anomalies.</p><ul><li>Scale your features first; distance-based methods are sensitive to units.</li><li>Judge results by whether they are useful and make sense to a domain expert, not by one number.</li><li>If a clear question emerges (“which customers will churn?”), collect labels and move to supervised learning.</li></ul>');
    if (!q2) { out.innerHTML = '<span class="mini-label">SUGGESTION</span><p class="readout">You have a target. Now, how many labels?</p>'; return; }
    if (q2 === 'many') return show('Supervised', 'green', 'Go supervised',
      '<p>With plenty of labels, a supervised model (boosted trees for tables, neural nets for images and text) is the strongest, simplest option.</p>' + (q3 === 'yes' ? '<ul><li>Lots of unlabeled data too? Self-supervised pre-training or semi-supervised learning can still add a few points, especially for images, audio and text.</li></ul>' : '<ul><li>Spend your effort on label quality and a clean held-out test set.</li></ul>'));
    if (!q3) { out.innerHTML = '<span class="mini-label">SUGGESTION</span><p class="readout">Last question: is unlabeled data plentiful?</p>'; return; }
    if (q2 === 'few' && q3 === 'yes') return show('Semi-supervised', 'amber', 'This is the semi-supervised sweet spot',
      '<p>A small labeled set plus abundant unlabeled data is exactly what §19.3 is about.</p><ul><li>Simple first: self-training / pseudo-labeling with a confidence threshold.</li><li>For images or audio: consistency regularization (predictions shouldn’t change under small augmentations).</li><li>Always compare against a supervised baseline trained on the labels alone, because unlabeled data can hurt if its structure doesn’t match the classes.</li><li>Keep a labeled test set the method never touches.</li></ul>');
    if (q2 === 'few') return show('Supervised', 'green', 'Supervised, kept simple',
      '<p>With few labels and little unlabeled data, semi-supervised methods have nothing to work with.</p><ul><li>Use a simple, well-regularized model and cross-validation.</li><li>Use transfer learning: start from a model pre-trained on a related, larger dataset.</li><li>Use your budget wisely: active learning picks the most informative examples to label next.</li></ul>');
    if (q3 === 'yes') return show('Unsupervised → Semi-supervised', 'violet', 'Start unsupervised, then add a few labels',
      '<p>You want predictions but have no labels yet. Use unsupervised learning to get going:</p><ul><li>Cluster the unlabeled data and label a handful of examples from each cluster. This gets far more out of a small labeling effort than random picking.</li><li>Then train semi-supervised on those few labels plus everything else.</li><li>Or use self-supervised pre-training, then fine-tune on the small labeled set.</li></ul>');
    return show('Get labels', 'amber', 'You need some labels first',
      '<p>A predictive goal with neither labels nor much unlabeled data leaves very little to learn from.</p><ul><li>Label a small set yourself, or use crowd-workers.</li><li>Look for a pre-trained model or a public dataset from a related task.</li><li>Write a few rules by hand as a baseline (weak supervision).</li></ul>');
  }
  document.querySelectorAll('#wizard input').forEach((i) => i.addEventListener('change', wizard));

  /* ---------------- nav highlight, resize, theme ---------------- */
  const links = document.querySelectorAll('.lesson-nav a');
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id)); });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.lesson').forEach((s) => io.observe(s));

  function redrawAll() { cmp.draw(); const open = document.querySelector('.tabs button.on'); panelDraw[open.dataset.tab](); }
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(redrawAll, 120); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); redrawAll(); });
  redrawAll();
})();

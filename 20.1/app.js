/* Interactive demos for the 20.1 (PCA) companion page. Depends on pca.js (window.PCA). */
(function () {
  'use strict';
  const P = window.PCA;
  const $ = (id) => document.getElementById(id);
  const pct = (v, d) => (100 * v).toFixed(d == null ? 0 : d) + '%';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEG = Math.PI / 180;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sub = (n) => String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');

  /* ================= drawing helpers ================= */
  let C = {};
  const TOK = ['bg', 'card', 'ink', 'muted', 'line', 'soft', 'green', 'amber', 'grey', 'violet', 'k1', 'k2', 'k3'];
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
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.2; ctx.stroke(); }
  }
  function line(ctx, x0, y0, x1, y1, color, lw, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  }
  function arrow(ctx, x0, y0, x1, y1, color, lw) {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), hs = Math.min(11, L * 0.45);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - hs * 0.6 * Math.cos(a), y1 - hs * 0.6 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hs * Math.cos(a - 0.42), y1 - hs * Math.sin(a - 0.42));
    ctx.lineTo(x1 - hs * Math.cos(a + 0.42), y1 - hs * Math.sin(a + 0.42));
    ctx.closePath(); ctx.fill();
  }
  function label(ctx, text, x, y, color, opts) {
    opts = opts || {};
    ctx.font = font(opts.size || 13, opts.weight || 700);
    ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.base || 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = opts.halo || C.card; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function cross(ctx, x, y, s, color) {
    line(ctx, x - s, y - s, x + s, y + s, C.card, 6); line(ctx, x + s, y - s, x - s, y + s, C.card, 6);
    line(ctx, x - s, y - s, x + s, y + s, color, 3); line(ctx, x + s, y - s, x - s, y + s, color, 3);
  }
  function niceTicks(a, b, n) {
    const span = b - a, step0 = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag, step = (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const tickFmt = (v) => (Math.abs(v) >= 10000 ? (v / 1000).toLocaleString() + 'k' : String(+v.toPrecision(6)));

  // Equal-aspect mapping from data to pixels (so right angles stay right angles).
  function frame(w, h, xr, yr, pad) {
    const rect = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    const s = Math.min(rect.w / (xr[1] - xr[0]), rect.h / (yr[1] - yr[0]));
    const cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2, px = rect.x + rect.w / 2, py = rect.y + rect.h / 2;
    return {
      s, rect,
      sx: (x) => px + (x - cx) * s, sy: (y) => py - (y - cy) * s,
      ix: (X) => cx + (X - px) / s, iy: (Y) => cy - (Y - py) / s,
    };
  }
  // Grid + tick labels for an equal-aspect frame.
  function gridEq(ctx, F, xl, yl, opts) {
    opts = opts || {};
    const r = F.rect;
    const xt = niceTicks(F.ix(r.x), F.ix(r.x + r.w), Math.max(3, Math.round(r.w / 80)));
    const yt = niceTicks(F.iy(r.y + r.h), F.iy(r.y), Math.max(3, Math.round(r.h / 70)));
    ctx.save();
    ctx.font = font(11); ctx.fillStyle = C.muted; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt) { const x = F.sx(v); line(ctx, x, r.y, x, r.y + r.h, C.line, 1); if (!opts.noLabels) { ctx.fillStyle = C.muted; ctx.fillText(tickFmt(v), x, r.y + r.h + 5); } }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt) { const y = F.sy(v); line(ctx, r.x, y, r.x + r.w, y, C.line, 1); if (!opts.noLabels) { ctx.fillStyle = C.muted; ctx.fillText(tickFmt(v), r.x - 6, y); } }
    ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if (xl) ctx.fillText(xl, r.x + r.w / 2, r.y + r.h + 34);
    if (yl) { ctx.translate(12, r.y + r.h / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(yl, 0, 0); }
    ctx.restore();
  }
  // Ordinary (non equal-aspect) chart axes.
  function chart(ctx, w, h, xr, yr, pad, xt, yt, xl, yl, fy) {
    const rect = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
    const sx = (x) => rect.x + ((x - xr[0]) / (xr[1] - xr[0])) * rect.w;
    const sy = (y) => rect.y + rect.h - ((y - yr[0]) / (yr[1] - yr[0])) * rect.h;
    ctx.save(); ctx.font = font(11); ctx.fillStyle = C.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt) { ctx.fillText(String(v), sx(v), rect.y + rect.h + 5); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt) { line(ctx, rect.x, sy(v), rect.x + rect.w, sy(v), C.line, 1); ctx.fillStyle = C.muted; ctx.fillText((fy || String)(v), rect.x - 6, sy(v)); }
    line(ctx, rect.x, rect.y + rect.h, rect.x + rect.w, rect.y + rect.h, C.muted, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if (xl) ctx.fillText(xl, rect.x + rect.w / 2, h - 2);
    if (yl) { ctx.translate(11, rect.y + rect.h / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(yl, 0, 0); }
    ctx.restore();
    return { rect, sx, sy };
  }
  function clip(ctx, r) { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
  function extent(X, k) { let a = Infinity, b = -Infinity; for (const x of X) { a = Math.min(a, x[k]); b = Math.max(b, x[k]); } return [a, b]; }
  function animate(ms, step, done) {
    if (reduceMotion) { step(1); if (done) done(); return { stop() {} }; }
    const t0 = performance.now(); let raf, stopped = false;
    const tick = (now) => {
      if (stopped) return;
      const t = Math.min(1, (now - t0) / ms);
      step(ease(t));
      if (t < 1) raf = requestAnimationFrame(tick); else if (done) done();
    };
    raf = requestAnimationFrame(tick);
    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  }
  function onDrag(canvas, fn) {
    let down = false;
    canvas.addEventListener('pointerdown', (e) => { down = true; canvas.setPointerCapture(e.pointerId); fn(e.offsetX, e.offsetY, e, true); });
    canvas.addEventListener('pointermove', (e) => { if (down) fn(e.offsetX, e.offsetY, e, false); });
    const up = () => { down = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
  const redrawers = [], themeHooks = [];
  const onRedraw = (f) => { redrawers.push(f); f(); };

  // Shared: points, a projection line, drop-lines and shadows.
  function drawProjection(ctx, F, X, m, w, o) {
    const ext = 50;
    const proj = X.map((x) => { const d = (x[0] - m[0]) * w[0] + (x[1] - m[1]) * w[1]; return [m[0] + d * w[0], m[1] + d * w[1]]; });
    if (o.resid) {
      X.forEach((x, i) => {
        const p = proj[i], s = o.slide || 0, q = [x[0] + s * (p[0] - x[0]), x[1] + s * (p[1] - x[1])];
        line(ctx, F.sx(q[0]), F.sy(q[1]), F.sx(p[0]), F.sy(p[1]), rgba('amber', 0.8), 1.4);
      });
    }
    line(ctx, F.sx(m[0] - ext * w[0]), F.sy(m[1] - ext * w[1]), F.sx(m[0] + ext * w[0]), F.sy(m[1] + ext * w[1]), C.green, 2.6);
    X.forEach((x, i) => {
      const p = proj[i], s = o.slide || 0;
      dot(ctx, F.sx(x[0] + s * (p[0] - x[0])), F.sy(x[1] + s * (p[1] - x[1])), o.r || 3.8, rgba('ink', 0.72), C.card, 1);
    });
    if (o.shadow) proj.forEach((p) => dot(ctx, F.sx(p[0]), F.sy(p[1]), 2.6, C.green, C.card, 0.8));
  }

  /* ================= hero ================= */
  (function hero() {
    const cv = $('heroCanvas');
    const X = P.petals(70, 9), m = P.meanOf(X), e = P.eig2(P.covOf(X, m));
    let theta = e.theta, slide = 0, anim = null;
    const draw = () => {
      const { ctx, w, h } = fit(cv);
      const F = frame(w, h, [m[0] - 2.8, m[0] + 2.8], [m[1] - 1.5, m[1] + 1.5], { l: 8, r: 8, t: 8, b: 8 });
      clip(ctx, { x: 0, y: 0, w, h });
      drawProjection(ctx, F, X, m, [Math.cos(theta), Math.sin(theta)], { resid: true, shadow: true, slide, r: 4 });
      ctx.restore();
    };
    function play() {
      if (anim) anim.stop();
      theta = e.theta + 1.35; slide = 0;
      anim = animate(2600, (t) => { theta = e.theta + 1.35 * (1 - t); draw(); }, () => {
        anim = animate(1100, (t) => { slide = t; draw(); }, () => {
          setTimeout(() => { anim = animate(1100, (t) => { slide = 1 - t; draw(); }); }, 1400);
        });
      });
    }
    $('heroReplay').addEventListener('click', play);
    onRedraw(draw);
    if (!reduceMotion) setTimeout(play, 350);
  })();

  /* ================= Lab A: rotate the line ================= */
  const petals = P.petals(120, 3), pm = P.meanOf(petals), pS = P.covOf(petals, pm), pE = P.eig2(pS);
  const pTot = pS[0][0] + pS[1][1];
  (function labA() {
    const cv = $('lineCanvas'), ac = $('angleCanvas'), sl = $('lineAngle');
    const bestDeg = ((pE.theta / DEG) % 180 + 180) % 180;
    let deg = +sl.value, anim = null, F = null;
    const kept = (d) => { const c = Math.cos(d * DEG), s = Math.sin(d * DEG); return pS[0][0] * c * c + 2 * pS[0][1] * c * s + pS[1][1] * s * s; };
    const xr = extent(petals, 0), yr = extent(petals, 1);
    function draw() {
      const { ctx, w, h } = fit(cv);
      F = frame(w, h, [xr[0] - 0.4, xr[1] + 0.4], [yr[0] - 0.5, yr[1] + 0.5], { l: 44, r: 10, t: 10, b: 42 });
      gridEq(ctx, F, 'petal length (cm)', 'petal width (cm)');
      clip(ctx, F.rect);
      drawProjection(ctx, F, petals, pm, [Math.cos(deg * DEG), Math.sin(deg * DEG)], { resid: $('lineResid').checked, shadow: $('lineShadow').checked });
      cross(ctx, F.sx(pm[0]), F.sy(pm[1]), 5, C.ink);
      ctx.restore();

      const k = kept(deg), l = pTot - k;
      $('lineAngleOut').textContent = Math.round(deg) + '°';
      $('lineKept').textContent = k.toFixed(3) + ' cm²';
      $('lineLost').textContent = l.toFixed(3) + ' cm²';
      $('lineTotal').textContent = pTot.toFixed(3) + ' cm²';
      $('lineShare').textContent = pct(k / pTot, 1);
      $('lineKeptBar').style.width = pct(k / pTot, 2);
      $('lineLostBar').style.width = pct(l / pTot, 2);

      const g = fit(ac), c2 = g.ctx;
      const A = chart(c2, g.w, g.h, [0, 180], [0, pTot * 1.08], { l: 44, r: 12, t: 10, b: 36 }, [0, 45, 90, 135, 180], niceTicks(0, pTot, 4), 'line angle (degrees)', 'cm²');
      for (const [fn, col] of [[kept, C.green], [(d) => pTot - kept(d), C.amber]]) {
        c2.strokeStyle = col; c2.lineWidth = 2.4; c2.beginPath();
        for (let d = 0; d <= 180; d += 1) { const x = A.sx(d), y = A.sy(fn(d)); d ? c2.lineTo(x, y) : c2.moveTo(x, y); }
        c2.stroke();
      }
      line(c2, A.sx(bestDeg), A.rect.y, A.sx(bestDeg), A.rect.y + A.rect.h, C.muted, 1, [3, 3]);
      label(c2, 'best', A.sx(bestDeg) + 4, A.rect.y + 8, C.muted, { size: 11, weight: 600 });
      line(c2, A.sx(deg), A.rect.y, A.sx(deg), A.rect.y + A.rect.h, C.ink, 1.2);
      dot(c2, A.sx(deg), A.sy(k), 5, C.green, C.card, 2);
      dot(c2, A.sx(deg), A.sy(l), 5, C.amber, C.card, 2);
    }
    const set = (d) => { deg = ((d % 180) + 180) % 180; sl.value = Math.round(deg) % 180; draw(); };
    const go = (target) => {
      if (anim) anim.stop();
      let from = deg, to = target;
      if (to - from > 90) to -= 180; else if (from - to > 90) to += 180;
      anim = animate(700, (t) => set(from + (to - from) * t));
    };
    sl.addEventListener('input', () => { if (anim) anim.stop(); set(+sl.value); });
    $('lineResid').addEventListener('change', draw);
    $('lineShadow').addEventListener('change', draw);
    $('lineBest').addEventListener('click', () => go(bestDeg));
    $('lineWorst').addEventListener('click', () => go(bestDeg + 90));
    $('lineSweep').addEventListener('click', () => {
      if (anim) anim.stop();
      const from = deg;
      anim = animate(4200, (t) => set(from + 180 * t), () => go(bestDeg));
    });
    onDrag(cv, (x, y) => {
      if (!F) return;
      if (anim) anim.stop();
      const dx = F.ix(x) - pm[0], dy = F.iy(y) - pm[1];
      if (Math.hypot(dx, dy) > 0.05) set(Math.atan2(dy, dx) / DEG);
    });
    onRedraw(draw);
  })();

  /* ================= Lab B: power iteration / eigenvectors ================= */
  (function labB() {
    const cv = $('eigCanvas'), sl = $('eigAngle');
    const Xc = petals.map((x) => [x[0] - pm[0], x[1] - pm[1]]);
    let ang = +sl.value * DEG, steps = 0, anim = null, F = null;
    const Sv = (v) => P.matVec(pS, v);
    function draw() {
      const { ctx, w, h } = fit(cv);
      F = frame(w, h, [-3, 3], [-1.7, 1.7], { l: 36, r: 10, t: 10, b: 40 });
      gridEq(ctx, F, 'centred length (cm)', 'centred width (cm)');
      clip(ctx, F.rect);
      const O = [F.sx(0), F.sy(0)];
      if ($('eigEllipse').checked) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const t = (i / 120) * 2 * Math.PI, a = 2 * Math.sqrt(pE.values[0]) * Math.cos(t), b = 2 * Math.sqrt(pE.values[1]) * Math.sin(t);
          const x = a * pE.vectors[0][0] + b * pE.vectors[1][0], y = a * pE.vectors[0][1] + b * pE.vectors[1][1];
          i ? ctx.lineTo(F.sx(x), F.sy(y)) : ctx.moveTo(F.sx(x), F.sy(y));
        }
        ctx.strokeStyle = rgba('muted', 0.7); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
        for (let j = 0; j < 2; j++) {
          const u = pE.vectors[j], r = 3.2;
          line(ctx, F.sx(-r * u[0]), F.sy(-r * u[1]), F.sx(r * u[0]), F.sy(r * u[1]), rgba(j ? 'violet' : 'green', 0.45), 1.2, [2, 4]);
        }
      }
      for (const x of Xc) dot(ctx, F.sx(x[0]), F.sy(x[1]), 3, rgba('ink', 0.22));
      if ($('eigPeanut').checked) {
        ctx.beginPath();
        for (let i = 0; i <= 180; i++) {
          const t = (i / 180) * 2 * Math.PI, u = [Math.cos(t), Math.sin(t)], r = P.dot(u, Sv(u));
          i ? ctx.lineTo(F.sx(r * u[0]), F.sy(r * u[1])) : ctx.moveTo(F.sx(r * u[0]), F.sy(r * u[1]));
        }
        ctx.fillStyle = rgba('green', 0.13); ctx.fill(); ctx.strokeStyle = rgba('green', 0.55); ctx.lineWidth = 1.3; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(O[0], O[1], F.s, 0, 2 * Math.PI); ctx.strokeStyle = C.muted; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const v = [Math.cos(ang), Math.sin(ang)], sv = Sv(v);
      arrow(ctx, O[0], O[1], F.sx(sv[0]), F.sy(sv[1]), C.violet, 3);
      arrow(ctx, O[0], O[1], F.sx(v[0]), F.sy(v[1]), C.ink, 3);
      label(ctx, 'v', F.sx(v[0] * 1.12), F.sy(v[1] * 1.12), C.ink, { align: 'center', size: 15 });
      const svn = Math.hypot(sv[0], sv[1]);
      label(ctx, 'Σ̂v', F.sx(sv[0] + (0.16 * sv[0]) / svn), F.sy(sv[1] + (0.16 * sv[1]) / svn), C.violet, { align: 'center', size: 14 });
      dot(ctx, F.sx(v[0]), F.sy(v[1]), 7, rgba('ink', 0.12));
      ctx.restore();

      const variance = P.dot(v, sv);
      let gap = Math.abs(Math.atan2(v[0] * sv[1] - v[1] * sv[0], P.dot(v, sv))) / DEG;
      $('eigAngleOut').textContent = Math.round(((ang / DEG) % 360 + 360) % 360) + '°';
      $('eigVar').textContent = variance.toFixed(3) + ' cm²';
      $('eigGap').textContent = gap.toFixed(1) + '°';
      $('eigSteps').textContent = steps;
      const which = Math.abs(P.dot(v, pE.vectors[0])) > 0.7 ? 0 : 1;
      $('eigReadout').innerHTML = gap < 0.5
        ? `<b>Σ̂v points the same way as v.</b> v is an eigenvector: Σ̂v = λv with λ = ${pE.values[which].toFixed(3)}, the ${which ? 'smallest' : 'largest'} possible variance. ${which ? 'This is <b>w</b>₂, the direction PCA throws away.' : 'This is <b>w</b>₁, the first principal component.'}`
        : `Σ̂ turns v by <b>${gap.toFixed(0)}°</b> towards the long axis and changes its length to ${svn.toFixed(2)}. Since the direction changed, v is <em>not</em> an eigenvector.`;
    }
    const set = (a) => { ang = a; sl.value = Math.round(((a / DEG) % 360 + 360) % 360) % 360; draw(); };
    function step(done) {
      const v = [Math.cos(ang), Math.sin(ang)], sv = Sv(v);
      let to = Math.atan2(sv[1], sv[0]), from = ang;
      while (to - from > Math.PI) to -= 2 * Math.PI;
      while (from - to > Math.PI) to += 2 * Math.PI;
      steps++;
      if (anim) anim.stop();
      anim = animate(420, (t) => set(from + (to - from) * t), done);
    }
    $('eigStep').addEventListener('click', () => step());
    $('eigRun').addEventListener('click', () => { let n = 0; const go = () => { if (n++ < 10) step(() => setTimeout(go, reduceMotion ? 0 : 60)); }; go(); });
    $('eigReset').addEventListener('click', () => { if (anim) anim.stop(); steps = 0; set((40 + Math.random() * 280) * DEG); });
    sl.addEventListener('input', () => { if (anim) anim.stop(); steps = 0; set(+sl.value * DEG); });
    $('eigPeanut').addEventListener('change', draw);
    $('eigEllipse').addEventListener('change', draw);
    onDrag(cv, (x, y) => {
      if (!F) return;
      if (anim) anim.stop();
      const dx = F.ix(x), dy = F.iy(y);
      if (Math.hypot(dx, dy) > 0.05) { steps = 0; set(Math.atan2(dy, dx)); }
    });
    onRedraw(draw);
  })();

  /* ================= Lab C: the recipe ================= */
  (function labC() {
    const X = P.petals(60, 17), m = P.meanOf(X), S = P.covOf(X, m), e = P.eig2(S), th = e.theta;
    const [w1, w2] = e.vectors, [l1, l2] = e.values;
    const Z = X.map((x) => { const d = [x[0] - m[0], x[1] - m[1]]; return [P.dot(d, w1), P.dot(d, w2)]; });
    const rot = (p, a) => [Math.cos(a) * p[0] - Math.sin(a) * p[1], Math.sin(a) * p[0] + Math.cos(a) * p[1]];
    const f3 = (v) => v.toFixed(3), f2 = (v) => v.toFixed(2);
    const mat = (a, b, c, d) => `<span class="mat"><span>${a}</span><span>${b}</span><span>${c}</span><span>${d}</span></span>`;
    const vec = (a, b) => `<span class="mat col"><span>${a}</span><span>${b}</span></span>`;
    const STEPS = [
      { t: 'Raw data', x: 'Each flower is a point (length, width) in cm. The cross marks the mean <b>μ</b>, the centre of the cloud. The dark lines are the axes through the origin (0, 0).',
        n: () => `<div><span>mean <b>μ</b></span>${vec(f2(m[0]), f2(m[1]))}</div><div><span>flowers</span><b>N = ${X.length}</b></div>` },
      { t: '1 · Centre', x: 'Subtract <b>μ</b> from every point. The cloud slides so that its centre sits on the origin. Its shape is unchanged; we only moved it so that directions can be measured from the middle.',
        n: () => `<div><span>new mean</span>${vec('0', '0')}</div>` },
      { t: '2 · Measure the spread', x: 'Compute the covariance matrix <b>Σ̂</b> = (1/N) Σ (x − μ)(x − μ)<sup>⊤</sup>. The diagonal holds each feature\'s variance; the off-diagonal is positive because long petals tend to be wide. The dashed ellipse (2 standard deviations) is the shape <b>Σ̂</b> describes.',
        n: () => `<div><span><b>Σ̂</b> (cm²)</span>${mat(f3(S[0][0]), f3(S[0][1]), f3(S[1][0]), f3(S[1][1]))}</div><div><span>total variance = trace</span><b>${f3(S[0][0] + S[1][1])}</b></div>` },
      { t: '3 · Eigen-decompose', x: 'The eigenvectors of <b>Σ̂</b> are the axes of the ellipse. <b class="c-green">w₁</b> has the largest eigenvalue, so it is the direction of greatest spread; <b class="c-violet">w₂</b> is at right angles to it. Arrows are drawn 2√λ long.',
        n: () => `<div><span class="c-green">w₁, λ₁</span>${vec(f3(w1[0]), f3(w1[1]))}<b>${f3(l1)}</b></div><div><span class="c-violet">w₂, λ₂</span>${vec(f3(w2[0]), f3(w2[1]))}<b>${f3(l2)}</b></div>` },
      { t: '4 · Rotate into PC coordinates', x: 'Compute z = <b>W</b><sup>⊤</sup>(x − μ) using both eigenvectors. This is a pure rotation: distances don\'t change, but now the first coordinate runs along w₁ and the second along w₂. In these coordinates the covariance is diagonal: the two new features are uncorrelated.',
        n: () => `<div><span>cov of z</span>${mat(f3(l1), '0', '0', f3(l2))}</div><div><span>variance along z₁</span><b>${pct(l1 / (l1 + l2), 1)}</b></div>` },
      { t: '5 · Drop the small direction', x: 'Keep only z₁ (L = 1). Each flower is now a single number, its position along w₁. The z₂ values we threw away are exactly the reconstruction error; their variance is λ₂.',
        n: () => `<div><span>numbers per flower</span><b>2 → 1</b></div><div><span>variance kept, λ₁</span><b>${f3(l1)}</b></div><div><span>variance lost, λ₂</span><b>${f3(l2)}</b></div>` },
      { t: '6 · Reconstruct', x: 'Map back with x̂ = μ + w₁z₁. Every flower lands on the line through μ along w₁, at the point closest to where it started. The orange segments are the errors; their mean squared length equals λ₂.',
        n: () => `<div><span>mean squared error</span><b>${f3(Z.reduce((s, z) => s + z[1] * z[1], 0) / Z.length)}</b></div><div><span>λ₂</span><b>${f3(l2)}</b></div>` },
    ];
    let stage = 0, t = 1, anim = null;
    const ol = $('recSteps');
    ol.innerHTML = STEPS.map((s, i) => `<li><button type="button" data-i="${i}">${s.t.replace(/^\d · /, '')}</button></li>`).join('');
    ol.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) go(+b.dataset.i); });

    function pos(i, s, tt) {
      const x = X[i], c = [x[0] - m[0], x[1] - m[1]], z = Z[i];
      if (s === 0) return x;
      if (s === 1) return [x[0] - tt * m[0], x[1] - tt * m[1]];
      if (s === 2 || s === 3) return c;
      if (s === 4) return rot(c, -th * tt);
      if (s === 5) return [z[0], z[1] * (1 - tt)];
      const r = rot([z[0], 0], th * tt);
      return [r[0] + tt * m[0], r[1] + tt * m[1]];
    }
    // fixed frame that contains every stage
    const all = [];
    for (let s = 0; s < 7; s++) for (let i = 0; i < X.length; i++) all.push(pos(i, s, 1));
    const xr = extent(all, 0), yr = extent(all, 1);

    function draw() {
      const { ctx, w, h } = fit($('recCanvas'));
      const F = frame(w, h, [xr[0] - 0.4, xr[1] + 0.4], [yr[0] - 0.4, yr[1] + 0.4], { l: 40, r: 10, t: 10, b: 30 });
      gridEq(ctx, F, '', '');
      clip(ctx, F.rect);
      line(ctx, F.sx(-99), F.sy(0), F.sx(99), F.sy(0), rgba('ink', 0.55), 1.3);
      line(ctx, F.sx(0), F.sy(-99), F.sx(0), F.sy(99), rgba('ink', 0.55), 1.3);
      const a = stage === 4 ? -th * t : stage === 5 ? -th : 0; // frame rotation for overlays
      if (stage >= 2 && stage <= 3) {
        const al = stage === 2 ? t : 1;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const q = (i / 100) * 2 * Math.PI, u = 2 * Math.sqrt(l1) * Math.cos(q), v = 2 * Math.sqrt(l2) * Math.sin(q);
          const p = [u * w1[0] + v * w2[0], u * w1[1] + v * w2[1]];
          i ? ctx.lineTo(F.sx(p[0]), F.sy(p[1])) : ctx.moveTo(F.sx(p[0]), F.sy(p[1]));
        }
        ctx.strokeStyle = rgba('muted', 0.8 * al); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.stroke(); ctx.setLineDash([]);
      }
      if (stage === 6) {
        X.forEach((x, i) => {
          const p = pos(i, 6, t);
          line(ctx, F.sx(x[0]), F.sy(x[1]), F.sx(p[0]), F.sy(p[1]), rgba('amber', 0.75 * t), 1.3);
          dot(ctx, F.sx(x[0]), F.sy(x[1]), 3.3, rgba('ink', 0.2 * t));
        });
        line(ctx, F.sx(m[0] - 9 * w1[0]), F.sy(m[1] - 9 * w1[1]), F.sx(m[0] + 9 * w1[0]), F.sy(m[1] + 9 * w1[1]), rgba('green', 0.8 * t), 2);
      }
      for (let i = 0; i < X.length; i++) {
        const p = pos(i, stage, t);
        dot(ctx, F.sx(p[0]), F.sy(p[1]), 4, stage >= 5 ? C.green : rgba('ink', 0.72), C.card, 1);
      }
      if (stage === 0) cross(ctx, F.sx(m[0]), F.sy(m[1]), 6, C.amber);
      if (stage === 1) cross(ctx, F.sx(m[0] * (1 - t)), F.sy(m[1] * (1 - t)), 6, C.amber);
      if (stage >= 3 && stage <= 5) {
        const al = stage === 3 ? t : 1;
        ctx.globalAlpha = al;
        const r1 = rot(w1, a), r2 = rot(w2, a), s1 = 2 * Math.sqrt(l1), s2 = 2 * Math.sqrt(l2);
        arrow(ctx, F.sx(0), F.sy(0), F.sx(s1 * r1[0]), F.sy(s1 * r1[1]), C.green, 3);
        if (stage !== 5) arrow(ctx, F.sx(0), F.sy(0), F.sx(s2 * r2[0]), F.sy(s2 * r2[1]), C.violet, 3);
        label(ctx, stage === 5 || (stage === 4 && t > 0.5) ? 'z₁' : 'w₁', F.sx(s1 * r1[0] * 1.08) + 6, F.sy(s1 * r1[1] * 1.08), C.green);
        if (stage !== 5) label(ctx, stage === 4 && t > 0.5 ? 'z₂' : 'w₂', F.sx(s2 * r2[0]) + 6, F.sy(s2 * r2[1]) - 8, C.violet);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    function render() {
      const s = STEPS[stage];
      $('recTitle').textContent = s.t;
      $('recText').innerHTML = s.x;
      $('recNums').innerHTML = s.n();
      [...ol.children].forEach((li, i) => li.classList.toggle('on', i === stage));
      [...ol.children].forEach((li, i) => li.classList.toggle('done', i < stage));
      $('recPrev').disabled = stage === 0;
      $('recNext').textContent = stage === STEPS.length - 1 ? 'Start over' : 'Next step →';
      draw();
    }
    function go(s) {
      if (anim) anim.stop();
      const forward = s === stage + 1;
      stage = s;
      if (forward) { t = 0; render(); anim = animate(1100, (tt) => { t = tt; draw(); }); }
      else { t = 1; render(); }
    }
    $('recNext').addEventListener('click', () => go(stage === STEPS.length - 1 ? 0 : stage + 1));
    $('recPrev').addEventListener('click', () => { if (stage > 0) go(stage - 1); });
    render();
    redrawers.push(draw);
  })();

  /* ================= Lab D: 3-D to 2-D ================= */
  (function labD() {
    const { X, g } = P.sheet3d(240, 21), m = P.meanOf(X), S = P.covOf(X, m), e = P.jacobiEig(S);
    const W = e.vectors, lam = e.values, tot = lam[0] + lam[1] + lam[2];
    const Xc = X.map((x) => x.map((v, j) => v - m[j]));
    const Z = Xc.map((p) => [P.dot(p, W[0]), P.dot(p, W[1]), P.dot(p, W[2])]);
    const R = 2.7 * Math.sqrt(lam[0]);
    // start looking at the plane from about 40 degrees off its normal
    const f0 = [0, 1, 2].map((j) => 0.75 * W[2][j] + 0.5 * W[1][j] + 0.35 * W[0][j]), fn = Math.hypot(...f0);
    let yaw = Math.atan2(f0[1], f0[0]), pitch = Math.max(-1.4, Math.min(1.4, Math.asin(f0[2] / fn))), t = 0, spinning = !reduceMotion, visible = false, anim = null, camAnim = null;
    const cols = () => [C.k1, C.k2, C.k3];

    function cam() {
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      return { r: [-sy, cy, 0], u: [-sp * cy, -sp * sy, cp], f: [cp * cy, cp * sy, sp] };
    }
    function draw() {
      const { ctx, w, h } = fit($('d3Canvas'));
      const k = cam(), sc = (Math.min(w, h) / 2 - 14) / R, cx = w / 2, cy = h / 2;
      const scr = (p) => [cx + sc * P.dot(p, k.r), cy - sc * P.dot(p, k.u), P.dot(p, k.f)];
      // world axes triad (small, bottom-left)
      const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      ax.forEach((a, i) => {
        const x0 = 34, y0 = h - 30, x1 = x0 + 20 * P.dot(a, k.r), y1 = y0 - 20 * P.dot(a, k.u);
        line(ctx, x0, y0, x1, y1, C.muted, 1.2);
        label(ctx, 'x' + sub(i + 1), x1 + (x1 - x0) * 0.35, y1 + (y1 - y0) * 0.35, C.muted, { size: 10, align: 'center', halo: C.bg });
      });
      const cur = Xc.map((p, i) => { const d = Z[i][2] * t; return [p[0] - d * W[2][0], p[1] - d * W[2][1], p[2] - d * W[2][2]]; });
      const side = P.dot(k.f, W[2]);
      const inFront = (i) => (t > 0.98 ? true : Z[i][2] * (1 - t) * side > 0);
      const order = [...cur.keys()].sort((a, b) => P.dot(cur[a], k.f) - P.dot(cur[b], k.f));
      const drawPts = (front) => {
        for (const i of order) {
          if (inFront(i) !== front) continue;
          const s = scr(cur[i]);
          if (t > 0) { const o = scr(Xc[i]); line(ctx, o[0], o[1], s[0], s[1], rgba('amber', 0.6 * t), 1); }
          dot(ctx, s[0], s[1], 3.6 + s[2] * 0.25 * sc / 60, cols()[g[i]], C.card, 0.8);
        }
      };
      drawPts(false);
      // plane
      const a = 2.4 * Math.sqrt(lam[0]), b = 2.4 * Math.sqrt(lam[1]);
      const corners = [[a, b], [a, -b], [-a, -b], [-a, b]].map(([u, v]) => scr([0, 1, 2].map((j) => u * W[0][j] + v * W[1][j])));
      ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]))); ctx.closePath();
      ctx.fillStyle = rgba('green', 0.1); ctx.fill(); ctx.strokeStyle = rgba('green', 0.5); ctx.lineWidth = 1.2; ctx.stroke();
      drawPts(true);
      const o = scr([0, 0, 0]);
      [[0, C.green], [1, C.violet], [2, C.amber]].forEach(([j, col]) => {
        const L = 2 * Math.sqrt(lam[j]), tip = scr(W[j].map((v) => v * L));
        arrow(ctx, o[0], o[1], tip[0], tip[1], col, 3);
        label(ctx, 'w' + sub(j + 1), tip[0] + (tip[0] - o[0]) * 0.12, tip[1] + (tip[1] - o[1]) * 0.12, col, { align: 'center' });
      });

      const f = fit($('d3Flat')), c2 = f.ctx;
      const zr = Math.max(...Z.map((z) => Math.max(Math.abs(z[0]), Math.abs(z[1])))) + 0.3;
      const F = frame(f.w, f.h, [-zr, zr], [-zr * 0.75, zr * 0.75], { l: 36, r: 10, t: 10, b: 40 });
      gridEq(c2, F, 'z₁ (along w₁)', 'z₂ (along w₂)');
      clip(c2, F.rect);
      line(c2, F.sx(-99), F.sy(0), F.sx(99), F.sy(0), rgba('green', 0.6), 1.5);
      line(c2, F.sx(0), F.sy(-99), F.sx(0), F.sy(99), rgba('violet', 0.6), 1.5);
      Z.forEach((z, i) => dot(c2, F.sx(z[0]), F.sy(z[1]), 3.6, cols()[g[i]], C.card, 0.8));
      c2.restore();
    }
    $('d3Vars').innerHTML = [0, 1, 2].map((j) => `
      <div class="var-row${j === 2 ? ' off' : ''}"><span>PC${j + 1}${j === 2 ? ' · discarded' : ''}</span>
      <div class="gain-track"><div class="gain-fill ${['', 'violet', 'amber'][j]}" style="width:${pct(lam[j] / tot, 1)}"></div></div>
      <b>λ${sub(j + 1)} = ${lam[j].toFixed(2)} · ${pct(lam[j] / tot, 1)}</b></div>`).join('') +
      `<p class="fine">Keeping two of three directions keeps ${pct((lam[0] + lam[1]) / tot, 1)} of the variance. The error is λ₃ = ${lam[2].toFixed(3)}, the mean squared length of the orange drop-lines.</p>`;

    const spinBtn = $('d3Spin');
    const setSpin = (on) => { spinning = on; spinBtn.textContent = on ? 'Pause spin' : 'Spin'; spinBtn.setAttribute('aria-pressed', on); if (on) loop(); };
    let raf = null, last = 0;
    function loop() {
      if (raf) return;
      const tick = (now) => {
        raf = null;
        if (!spinning || !visible) return;
        if (now - last > 30) { yaw += 0.006; draw(); last = now; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && spinning) loop(); }).observe($('d3Canvas'));
    spinBtn.addEventListener('click', () => setSpin(!spinning));
    $('d3Project').addEventListener('click', (ev) => {
      const on = ev.currentTarget.getAttribute('aria-pressed') !== 'true';
      ev.currentTarget.setAttribute('aria-pressed', on);
      ev.currentTarget.textContent = on ? 'Restore the 3-D points' : 'Project onto the plane';
      if (anim) anim.stop();
      const from = t;
      anim = animate(900, (tt) => { t = from + ((on ? 1 : 0) - from) * tt; draw(); });
    });
    $('d3Edge').addEventListener('click', () => {
      setSpin(false);
      const f = W[1], ty = Math.atan2(f[1], f[0]), tp = Math.asin(Math.max(-1, Math.min(1, f[2])));
      const y0 = yaw, p0 = pitch;
      let dy = ty - y0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      if (camAnim) camAnim.stop();
      camAnim = animate(900, (tt) => { yaw = y0 + dy * tt; pitch = p0 + (tp - p0) * tt; draw(); });
    });
    let lx = 0, ly = 0;
    onDrag($('d3Canvas'), (x, y, e, first) => {
      if (first) { lx = x; ly = y; setSpin(false); if (camAnim) camAnim.stop(); return; }
      yaw -= (x - lx) * 0.01; pitch = Math.max(-1.45, Math.min(1.45, pitch + (y - ly) * 0.01));
      lx = x; ly = y; draw();
    });
    onRedraw(draw);
  })();

  /* ================= Labs E & F: eigenfaces and choosing L ================= */
  (function labEF() {
    const SIZE = 20, D = SIZE * SIZE, KMAX = 40, NTRAIN = 320;
    let ready = false, M, lam, Wv, trace, train, test, cum, trainErr, testErr;
    let K = 4, idx = 0, useTest = false, walkJ = 0;

    function compute() {
      const all = P.faces(400, SIZE, 5);
      train = all.slice(0, NTRAIN); test = all.slice(NTRAIN);
      const c = P.imageCov(train);
      M = c.mean; trace = c.trace;
      const e = P.topEig(c.S, D, KMAX, 30, 7);
      lam = e.values; Wv = e.vectors.map((v) => Float64Array.from(v));
      cum = [0]; lam.forEach((l, i) => cum.push(cum[i] + l));
      trainErr = cum.map((s) => trace - s);
      testErr = new Array(KMAX + 1).fill(0);
      for (const x of test) {
        let r = 0; const d = new Float64Array(D);
        for (let i = 0; i < D; i++) { d[i] = x[i] - M[i]; r += d[i] * d[i]; }
        testErr[0] += r;
        for (let j = 0; j < KMAX; j++) { const z = P.dot(d, Wv[j]); r -= z * z; testErr[j + 1] += r; }
      }
      testErr = testErr.map((v) => v / test.length);
      ready = true;
    }
    function paintGray(cv, img) {
      const ctx = cv.getContext('2d'), id = ctx.createImageData(SIZE, SIZE);
      for (let i = 0; i < D; i++) { const v = Math.round(255 * Math.min(1, Math.max(0, img[i]))); id.data[4 * i] = id.data[4 * i + 1] = id.data[4 * i + 2] = v; id.data[4 * i + 3] = 255; }
      ctx.putImageData(id, 0, 0);
    }
    function paintDiv(cv, v) {
      const ctx = cv.getContext('2d'), id = ctx.createImageData(SIZE, SIZE);
      let mx = 1e-12; for (const x of v) mx = Math.max(mx, Math.abs(x));
      const base = C.rgb.card, pos = C.rgb.green, neg = C.rgb.amber;
      for (let i = 0; i < D; i++) {
        const s = v[i] / mx, tgt = s > 0 ? pos : neg, a = Math.min(1, Math.abs(s));
        for (let c = 0; c < 3; c++) id.data[4 * i + c] = Math.round(base[c] + (tgt[c] - base[c]) * a);
        id.data[4 * i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    }
    const pix = (cls) => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.className = 'pix ' + (cls || ''); return c; };

    function current() { return useTest ? test[idx % test.length] : train[idx % train.length]; }
    function renderE() {
      if (!ready) return;
      const x = current(), d = new Float64Array(D), rec = Float64Array.from(M);
      for (let i = 0; i < D; i++) d[i] = x[i] - M[i];
      const z = [];
      for (let j = 0; j < K; j++) { const zj = P.dot(d, Wv[j]); z.push(zj); for (let i = 0; i < D; i++) rec[i] += zj * Wv[j][i]; }
      let err = 0; for (let i = 0; i < D; i++) err += (x[i] - rec[i]) ** 2;
      paintGray($('faceOrig'), x); paintGray($('faceMean'), M); paintGray($('faceRecon'), rec);
      const terms = $('faceTerms'); terms.innerHTML = '';
      if (K === 0) terms.innerHTML = '<span class="term-none">nothing<br>(L = 0)</span>';
      z.slice(0, 4).forEach((zj, j) => {
        const f = document.createElement('figure'), cv = pix('small'); paintDiv(cv, Wv[j]);
        f.appendChild(cv); const cap = document.createElement('figcaption');
        cap.innerHTML = `z${sub(j + 1)} = ${zj.toFixed(2)}`; f.appendChild(cap); terms.appendChild(f);
      });
      if (K > 4) { const s = document.createElement('span'); s.className = 'term-more'; s.textContent = `+ ${K - 4} more`; terms.appendChild(s); }
      $('faceKOut').textContent = K; $('howKOut').textContent = K;
      $('faceK').value = K; $('howK').value = K;
      $('faceStore').textContent = `${K} instead of ${D}`;
      $('faceErr').textContent = err.toFixed(2);
      $('faceFrac').textContent = pct(cum[K] / trace, 1);
      $('faceReconCap').textContent = `Rebuilt from ${K} number${K === 1 ? '' : 's'}`;
      $('faceTest').textContent = useTest ? 'Use a training face' : 'Use an unseen face';
      $('faceTest').setAttribute('aria-pressed', useTest);
    }
    const NOTES = [
      'Mostly overall brightness, with a little head size mixed in. Brightness varies most between faces, so it takes the top spot.',
      'Lighting side: one half of the face brightens while the other darkens.',
      'Hairline: how far the dark hair comes down the forehead.',
      'Mouth shape: a smile at one end, a frown at the other.',
      'From here on, components blend several knobs together (head height, mouth, hair). PCA finds directions of variance, not the “true” causes, so a component need not match a single knob.',
      'Smaller and harder to name. Each later component explains less variance and looks more like a mix of edges.',
    ];
    function renderWalk() {
      if (!ready) return;
      const tt = +$('walkT').value, j = walkJ, img = new Float64Array(D);
      for (let i = 0; i < D; i++) img[i] = M[i] + tt * Math.sqrt(lam[j]) * Wv[j][i];
      paintDiv($('walkEig'), Wv[j]); paintGray($('walkImg'), img);
      $('walkTOut').textContent = (tt > 0 ? '+' : '') + tt.toFixed(1);
      $('walkEigCap').textContent = `w${sub(j + 1)} · ${pct(lam[j] / trace, 1)} of variance`;
      $('walkNote').textContent = `PC${j + 1}: ${NOTES[j]}`;
      [...$('walkPick').children].forEach((b, i) => b.classList.toggle('on', i === j));
    }
    function renderGrid() {
      const g = $('eigGrid'); g.innerHTML = '';
      for (let j = 0; j < 12; j++) {
        const f = document.createElement('figure'), cv = pix(); paintDiv(cv, Wv[j]); f.appendChild(cv);
        const c = document.createElement('figcaption'); c.textContent = `λ${sub(j + 1)} · ${pct(lam[j] / trace, 1)}`; f.appendChild(c); g.appendChild(f);
      }
    }
    function renderF() {
      if (!ready) return;
      const xs = [0, 10, 20, 30, 40];
      // scree
      let g = fit($('screeCanvas')), A = chart(g.ctx, g.w, g.h, [0.5, KMAX + 0.5], [0, lam[0] * 1.08], { l: 40, r: 8, t: 8, b: 32 }, [1, 10, 20, 30, 40], niceTicks(0, lam[0], 4), 'component j', '');
      const bw = Math.max(1, (A.rect.w / KMAX) * 0.72);
      lam.forEach((l, j) => { g.ctx.fillStyle = j < K ? C.green : rgba('grey', 0.5); g.ctx.fillRect(A.sx(j + 1) - bw / 2, A.sy(l), bw, A.sy(0) - A.sy(l)); });
      // fraction explained
      g = fit($('fracCanvas'));
      A = chart(g.ctx, g.w, g.h, [0, KMAX], [0, 1], { l: 40, r: 8, t: 8, b: 32 }, xs, [0, 0.25, 0.5, 0.75, 0.9, 1], 'L', '', (v) => pct(v));
      for (const th of [0.9, 0.95]) line(g.ctx, A.rect.x, A.sy(th), A.rect.x + A.rect.w, A.sy(th), C.muted, 1, [3, 3]);
      g.ctx.strokeStyle = C.green; g.ctx.lineWidth = 2.4; g.ctx.beginPath();
      cum.forEach((s, L) => (L ? g.ctx.lineTo(A.sx(L), A.sy(s / trace)) : g.ctx.moveTo(A.sx(L), A.sy(s / trace))));
      g.ctx.stroke();
      line(g.ctx, A.sx(K), A.rect.y, A.sx(K), A.rect.y + A.rect.h, C.ink, 1);
      dot(g.ctx, A.sx(K), A.sy(cum[K] / trace), 5, C.green, C.card, 2);
      // errors
      g = fit($('errCanvas'));
      const top = Math.max(trainErr[0], testErr[0]);
      A = chart(g.ctx, g.w, g.h, [0, KMAX], [0, top * 1.05], { l: 40, r: 8, t: 8, b: 32 }, xs, niceTicks(0, top, 4), 'L', '');
      for (const [arr, col] of [[trainErr, C.green], [testErr, C.amber]]) {
        g.ctx.strokeStyle = col; g.ctx.lineWidth = 2.4; g.ctx.beginPath();
        arr.forEach((v, L) => (L ? g.ctx.lineTo(A.sx(L), A.sy(v)) : g.ctx.moveTo(A.sx(L), A.sy(v))));
        g.ctx.stroke();
      }
      line(g.ctx, A.sx(K), A.rect.y, A.sx(K), A.rect.y + A.rect.h, C.ink, 1);
      dot(g.ctx, A.sx(K), A.sy(trainErr[K]), 5, C.green, C.card, 2);
      dot(g.ctx, A.sx(K), A.sy(testErr[K]), 5, C.amber, C.card, 2);

      const need = (f) => { const i = cum.findIndex((s) => s / trace >= f); return i < 0 ? `more than ${KMAX}` : i; };
      $('howReadout').innerHTML = `With <b>L = ${K}</b>, each face is stored as ${K} number${K === 1 ? '' : 's'} instead of ${D} and keeps <b>${pct(cum[K] / trace, 1)}</b> of the variance. Reaching 90% takes L = ${need(0.9)}; reaching 95% takes L = ${need(0.95)}. The first few components do most of the work, which is what the eight hidden knobs would lead you to expect.`;
    }
    const setK = (k) => { K = k; renderE(); renderF(); };
    $('faceK').addEventListener('input', (e) => setK(+e.target.value));
    $('howK').addEventListener('input', (e) => setK(+e.target.value));
    $('faceNext').addEventListener('click', () => { idx = (idx + 1 + Math.floor(Math.random() * 37)) % 400; renderE(); });
    $('faceTest').addEventListener('click', () => { useTest = !useTest; renderE(); });
    $('walkPick').innerHTML = [0, 1, 2, 3, 4, 5].map((j) => `<button type="button">PC${j + 1}</button>`).join('');
    $('walkPick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { walkJ = [...b.parentNode.children].indexOf(b); renderWalk(); } });
    $('walkT').addEventListener('input', renderWalk);

    setTimeout(() => {
      compute();
      $('faceLoading').hidden = true;
      renderE(); renderWalk(); renderGrid(); renderF();
      redrawers.push(renderF);
      themeHooks.push(() => { renderE(); renderWalk(); renderGrid(); });
    }, 60);
  })();

  /* ================= Lab G: units and standardisation ================= */
  (function labG() {
    const raw = P.heightWeight(200, 11);
    const HF = { m: 0.01, cm: 1, mm: 10 }, WF = { kg: 1, g: 1000 };
    let hu = 'cm', wu = 'kg';
    const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : +v.toPrecision(3) + '');
    function draw() {
      const std = $('unitStd').checked;
      let X = raw.map((x) => [x[0] * HF[hu], x[1] * WF[wu]]);
      let m = P.meanOf(X), S = P.covOf(X, m);
      if (std) {
        const sd = [Math.sqrt(S[0][0]), Math.sqrt(S[1][1])];
        X = X.map((x) => [(x[0] - m[0]) / sd[0], (x[1] - m[1]) / sd[1]]);
        m = [0, 0]; S = P.covOf(X, m);
      }
      const e = P.eig2(S), w1 = e.vectors[0], w2 = e.vectors[1];
      const { ctx, w, h } = fit($('unitCanvas'));
      const xr = extent(X, 0), yr = extent(X, 1);
      const padx = (xr[1] - xr[0]) * 0.08, pady = (yr[1] - yr[0]) * 0.08;
      const F = frame(w, h, [xr[0] - padx, xr[1] + padx], [yr[0] - pady, yr[1] + pady], { l: 56, r: 10, t: 10, b: 42 });
      gridEq(ctx, F, std ? 'height (standardised)' : `height (${hu})`, std ? 'weight (standardised)' : `weight (${wu})`);
      clip(ctx, F.rect);
      for (const x of X) dot(ctx, F.sx(x[0]), F.sy(x[1]), 3.2, rgba('ink', 0.55), C.card, 0.8);
      const L1 = 3 * Math.sqrt(e.values[0]), L2 = 3 * Math.sqrt(Math.max(0, e.values[1]));
      line(ctx, F.sx(m[0] - 1e6 * w1[0]), F.sy(m[1] - 1e6 * w1[1]), F.sx(m[0] + 1e6 * w1[0]), F.sy(m[1] + 1e6 * w1[1]), rgba('green', 0.35), 1.2);
      arrow(ctx, F.sx(m[0]), F.sy(m[1]), F.sx(m[0] + L1 * w1[0]), F.sy(m[1] + L1 * w1[1]), C.green, 3);
      if (F.s * L2 > 6) arrow(ctx, F.sx(m[0]), F.sy(m[1]), F.sx(m[0] + L2 * w2[0]), F.sy(m[1] + L2 * w2[1]), C.violet, 3);
      ctx.restore();

      const sh = w1[0] * w1[0], sw = w1[1] * w1[1];
      $('loadH').style.width = pct(sh, 1); $('loadW').style.width = pct(sw, 1);
      $('loadHOut').textContent = pct(sh); $('loadWOut').textContent = pct(sw);
      const su = (u) => (std ? '' : ` ${u}²`);
      $('unitVH').textContent = fmt(S[0][0]) + su(hu);
      $('unitVW').textContent = fmt(S[1][1]) + su(wu);
      $('unitPC1').textContent = pct(e.values[0] / (S[0][0] + S[1][1]), 1);
      $('unitReadout').innerHTML = std
        ? '<b>Both features count equally.</b> After standardising, each has variance 1, and PC1 points along the diagonal: the “overall size” direction, taller and heavier together. Changing units now makes no difference.'
        : sh > 0.9 ? `<b>PC1 is basically just height.</b> In ${hu}, height's variance dwarfs weight's, so PCA chases it and nearly ignores weight.`
        : sw > 0.9 ? `<b>PC1 is basically just weight.</b> Height in ${hu} has tiny numbers, so its variance is tiny and PCA nearly ignores it.`
        : '<b>A mix of both</b>, but the mix depends on your units. Try metres or millimetres and watch the direction swing.';
      [['unitH', hu], ['unitW', wu]].forEach(([id, v]) => [...$(id).children].forEach((b) => { b.classList.toggle('on', b.dataset.v === v); b.disabled = std; }));
    }
    $('unitH').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { hu = b.dataset.v; draw(); } });
    $('unitW').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { wu = b.dataset.v; draw(); } });
    $('unitStd').addEventListener('change', draw);
    onRedraw(draw);
  })();

  /* ================= page plumbing ================= */
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redrawers.forEach((f) => f()), 120); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); redrawers.forEach((f) => f()); themeHooks.forEach((f) => f()); });

  const links = [...document.querySelectorAll('.lesson-nav a')];
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('section.lesson').forEach((s) => io.observe(s));
})();

/* Interactive demos for the 20.4 (manifold learning) companion page. Depends on manifold.js (window.ML). */
(function () {
  'use strict';
  const ML = window.ML;
  const $ = (id) => document.getElementById(id);
  const pct = (v, d) => (100 * v).toFixed(d == null ? 0 : d) + '%';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const fmt = (v, d) => (v == null || !isFinite(v) ? '–' : v.toFixed(d == null ? 2 : d));
  const later = (fn) => setTimeout(fn, 16);

  /* ================= theme + drawing helpers ================= */
  let C = {};
  const TOK = ['bg', 'card', 'ink', 'muted', 'line', 'soft', 'green', 'amber', 'grey', 'violet',
    'seq0', 'seq1', 'seq2', 'seq3', 's1', 's2', 's3', 'divn', 'divm', 'divp'];
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
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  // Sequential single-hue ramp (light → dark on light theme; recedes → bright on dark theme).
  function seq(u, alpha) {
    u = clamp(u, 0, 1) * 3;
    const i = Math.min(2, Math.floor(u)), c = mix(C.rgb['seq' + i], C.rgb['seq' + (i + 1)], u - i);
    return alpha == null ? `rgb(${c})` : `rgba(${c},${alpha})`;
  }
  // Diverging ramp for signed values in [-1, 1] with a neutral grey midpoint.
  function div(v) {
    v = clamp(v, -1, 1);
    const c = v < 0 ? mix(C.rgb.divm, C.rgb.divn, -v) : mix(C.rgb.divm, C.rgb.divp, v);
    return `rgb(${c})`;
  }
  const SLOT = () => [C.s1, C.s2, C.s3];

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
  const FONT = getComputedStyle(document.body).fontFamily;
  const font = (px, weight) => `${weight || ''} ${px}px ${FONT}`;
  function dot(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.2; ctx.stroke(); }
  }
  function line(ctx, x0, y0, x1, y1, color, lw, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  }
  function label(ctx, text, x, y, color, opts) {
    opts = opts || {};
    ctx.font = font(opts.size || 12, opts.weight || 600);
    ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.base || 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = opts.halo || C.bg; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  // Equal-aspect frame that fits a set of 2-D points.
  function fitFrame(w, h, pts, pad) {
    pad = pad || 18;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (!(x1 > x0)) { x0 -= 1; x1 += 1; }
    if (!(y1 > y0)) { y0 -= 1; y1 += 1; }
    const s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { s, sx: (x) => w / 2 + (x - cx) * s, sy: (y) => h / 2 - (y - cy) * s };
  }
  function onRedraw(f) { redrawers.push(f); f(); }
  const redrawers = [];
  // Run a callback only while an element is on screen.
  function whenVisible(el, cb) {
    new IntersectionObserver((es) => cb(es[0].isIntersecting), { rootMargin: '80px' }).observe(el);
  }
  function seg(id, fn) {
    const el = $(id);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      [...el.children].forEach((c) => c.classList.toggle('on', c === b));
      fn(b.dataset.v);
    });
    return () => el.querySelector('.on').dataset.v;
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ================= 3-D view with drag-to-rotate ================= */
  function make3D(canvas, opts) {
    const st = { yaw: opts.yaw || 0, pitch: opts.pitch || 0, render: () => {} };
    let last = null, moved = 0;
    canvas.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; moved = 0; canvas.setPointerCapture(e.pointerId); st.dragging = true; });
    canvas.addEventListener('pointermove', (e) => {
      if (!last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      moved += Math.abs(dx) + Math.abs(dy);
      st.yaw += dx * 0.01; st.pitch = clamp(st.pitch + dy * 0.01, -1.55, 1.55);
      last = [e.clientX, e.clientY]; st.render();
    });
    const end = (e) => {
      if (last && moved < 5 && opts.onClick) { const r = canvas.getBoundingClientRect(); opts.onClick(e.clientX - r.left, e.clientY - r.top); }
      last = null; st.dragging = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { last = null; st.dragging = false; });
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
      if (m) { e.preventDefault(); st.yaw += m[0]; st.pitch = clamp(st.pitch + m[1], -1.55, 1.55); st.render(); }
    });
    // Projector for points given a centre and radius.
    st.projector = (center, radius, w, h, zoom) => {
      const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const s = (Math.min(w, h) / (2 * radius)) * (zoom || 0.95);
      return (p) => {
        const x = p[0] - center[0], y = p[1] - center[1], z = p[2] - center[2];
        const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
        const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
        return [w / 2 + s * x1, h / 2 - s * y2, z2];
      };
    };
    return st;
  }
  function bounds3(X) {
    const c = [0, 0, 0]; for (const p of X) for (let d = 0; d < 3; d++) c[d] += p[d] / X.length;
    let r = 0; for (const p of X) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
    return { c, r };
  }
  // Depth-sorted 3-D scatter. colorOf(i) → css colour. Returns projected points.
  function draw3DPoints(ctx, P, colorOf, radiusOf) {
    let zmin = Infinity, zmax = -Infinity;
    for (const p of P) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); }
    const order = P.map((_, i) => i).sort((a, b) => P[a][2] - P[b][2]);
    for (const i of order) {
      const depth = (P[i][2] - zmin) / (zmax - zmin || 1);
      ctx.globalAlpha = 0.45 + 0.55 * depth;
      dot(ctx, P[i][0], P[i][1], radiusOf ? radiusOf(i) : 2.6, colorOf(i));
    }
    ctx.globalAlpha = 1;
  }
  function drawEmbedding(ctx, F, Y, colorOf, r) {
    for (let i = 0; i < Y.length; i++) dot(ctx, F.sx(Y[i][0]), F.sy(Y[i][1]), r || 2.6, colorOf(i));
  }
  function nearestProjected(P, x, y, maxD) {
    let best = -1, bd = maxD || 14;
    P.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function imgToCanvas(canvas, img, size) {
    const ctx = canvas.getContext('2d'), id = ctx.createImageData(size, size);
    const bg = C.rgb.card, ink = C.rgb.ink;
    for (let i = 0; i < size * size; i++) {
      const c = mix(bg, ink, img[i]);
      id.data[4 * i] = c[0]; id.data[4 * i + 1] = c[1]; id.data[4 * i + 2] = c[2]; id.data[4 * i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }

  /* ================= HERO: rolling and unrolling ================= */
  (function hero() {
    const cv = $('heroCanvas');
    const data = ML.swissRoll(520, 0, 21);
    const M = 360, grid = [];
    for (let i = 0; i <= M; i++) {
      const t = ML.T0 + (ML.T1 - ML.T0) * (i / M);
      const dx = Math.cos(t) - t * Math.sin(t), dz = Math.sin(t) + t * Math.cos(t);
      grid.push({ t, s: ML.spiralArc(t) - ML.spiralArc(ML.T0), phi: Math.atan2(dz, dx) });
    }
    for (let i = 1; i <= M; i++) { while (grid[i].phi - grid[i - 1].phi > Math.PI) grid[i].phi -= 2 * Math.PI; while (grid[i].phi - grid[i - 1].phi < -Math.PI) grid[i].phi += 2 * Math.PI; }
    const S = grid[M].s, sPts = data.X.map((p, i) => data.truth[i][0] - ML.spiralArc(ML.T0));
    function curve(alpha) {
      const out = [[ML.T0 * Math.cos(ML.T0), ML.T0 * Math.sin(ML.T0)]], phi0 = grid[0].phi;
      for (let i = 1; i <= M; i++) {
        const ds = grid[i].s - grid[i - 1].s, ph = phi0 + (1 - alpha) * (grid[i].phi - phi0);
        const prev = out[i - 1];
        out.push([prev[0] + Math.cos(ph) * ds, prev[1] + Math.sin(ph) * ds]);
      }
      let cx = 0, cz = 0; // centroid weighted by arc length, so the strip stays centred
      for (let i = 1; i <= M; i++) { const ds = (grid[i].s - grid[i - 1].s) / S; cx += ds * (out[i][0] + out[i - 1][0]) / 2; cz += ds * (out[i][1] + out[i - 1][1]) / 2; }
      return out.map((p) => [p[0] - cx, p[1] - cz]);
    }
    const view = make3D(cv, { yaw: 0.35, pitch: 0.95 });
    let alpha = 0, playing = !reduceMotion, visible = true, t0 = performance.now(), raf = 0;
    function draw() {
      const { ctx, w, h } = fit(cv);
      const cur = curve(alpha);
      const pts = sPts.map((s, i) => {
        const f = (s / S) * M, k = Math.min(M - 1, Math.floor(f)), u = f - k;
        return [lerp(cur[k][0], cur[k + 1][0], u), data.X[i][1] - 9, lerp(cur[k][1], cur[k + 1][1], u)];
      });
      const e = ease(alpha), R = lerp(16, (S / 2 + 4) * Math.min(w, h) / w, e);
      // turn the camera to face the sheet as it flattens
      const keepYaw = view.yaw, keepPitch = view.pitch;
      if (!view.dragging) { view.yaw = lerp(keepYaw, -grid[0].phi, e); view.pitch = lerp(keepPitch, 0.35, e); }
      const pr = view.projector([0, 0, 0], R, w, h, 1.0);
      view.yaw = keepYaw; view.pitch = keepPitch;
      draw3DPoints(ctx, pts.map(pr), (i) => seq(data.color[i]), () => 2.6);
    }
    function loop(now) {
      if (!playing || !visible) { raf = 0; return; }
      const T = 10000, ph = ((now - t0) % T) / T;
      alpha = ph < 0.15 ? 0 : ph < 0.45 ? ease((ph - 0.15) / 0.3) : ph < 0.6 ? 1 : ph < 0.9 ? 1 - ease((ph - 0.6) / 0.3) : 0;
      if (!view.dragging) view.yaw = 0.35 + 0.25 * Math.sin((now - t0) / 4000);
      draw();
      raf = requestAnimationFrame(loop);
    }
    view.render = draw;
    const start = () => { if (!raf && playing && visible) raf = requestAnimationFrame(loop); };
    whenVisible(cv, (v) => { visible = v; start(); });
    const btn = $('heroToggle');
    if (reduceMotion) { alpha = 0.5; btn.textContent = 'Play'; }
    btn.addEventListener('click', () => {
      playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; btn.setAttribute('aria-pressed', String(!playing));
      if (playing) { t0 = performance.now() - 0; start(); }
    });
    onRedraw(draw);
  })();

  /* ================= LAB A: geodesic vs Euclidean on the rug's cross-section ================= */
  (function geo() {
    const cv = $('geoCanvas'), SC = 0.05; // display units: metres
    const M = 800, ts = [], P = [], arcs = [];
    for (let i = 0; i <= M; i++) { const t = ML.T0 + (ML.T1 - ML.T0) * (i / M); ts.push(t); P.push([t * Math.cos(t), t * Math.sin(t)]); arcs.push(ML.spiralArc(t)); }
    let a = 260, b = 610, F = null, drag = -1;
    function draw() {
      const { ctx, w, h } = fit(cv);
      F = fitFrame(w, h, P, 30);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = C.soft; ctx.lineWidth = 9; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(F.sx(p[0]), F.sy(p[1])) : ctx.moveTo(F.sx(p[0]), F.sy(p[1])))); ctx.stroke();
      ctx.strokeStyle = C.grey; ctx.lineWidth = 1.2; ctx.stroke();
      const lo = Math.min(a, b), hi = Math.max(a, b);
      ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = lo; i <= hi; i++) (i === lo ? ctx.moveTo(F.sx(P[i][0]), F.sy(P[i][1])) : ctx.lineTo(F.sx(P[i][0]), F.sy(P[i][1])));
      ctx.stroke();
      line(ctx, F.sx(P[a][0]), F.sy(P[a][1]), F.sx(P[b][0]), F.sy(P[b][1]), C.amber, 2.5, [7, 5]);
      for (const k of [a, b]) dot(ctx, F.sx(P[k][0]), F.sy(P[k][1]), 9, C.card, C.ink, 2.5);
      label(ctx, 'A', F.sx(P[a][0]), F.sy(P[a][1]), C.ink, { align: 'center', size: 11, weight: 700, halo: C.card });
      label(ctx, 'B', F.sx(P[b][0]), F.sy(P[b][1]), C.ink, { align: 'center', size: 11, weight: 700, halo: C.card });
      label(ctx, 'inner end', F.sx(P[0][0]) + 10, F.sy(P[0][1]) - 12, C.muted, { size: 11 });
      label(ctx, 'outer end', F.sx(P[M][0]) - 6, F.sy(P[M][1]) + 16, C.muted, { size: 11, align: 'right' });
      const E = Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) * SC, G = Math.abs(arcs[a] - arcs[b]) * SC, r = G / Math.max(E, 1e-9);
      $('geoE').textContent = E.toFixed(2) + ' m'; $('geoG').textContent = G.toFixed(2) + ' m'; $('geoR').textContent = r.toFixed(1) + '×';
      $('geoReadout').innerHTML = r < 1.15
        ? '<b>Close neighbours on the same turn.</b> The straight line and the path along the rug agree, so locally the rug is flat and Euclidean distance is fine.'
        : r < 2
          ? `The rug curves between A and B, so the path along it is ${pct(r - 1)} longer than the straight line. The error grows with separation.`
          : `<b>Through the air A and B are ${E.toFixed(2)} m apart, but an ant must walk ${G.toFixed(2)} m</b>, ${r.toFixed(1)}× as far. A method that trusts straight lines would call them neighbours.`;
    }
    function nearestT(x, y) {
      let best = 0, bd = Infinity;
      P.forEach((p, i) => { const d = (F.sx(p[0]) - x) ** 2 + (F.sy(p[1]) - y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    }
    cv.addEventListener('pointerdown', (e) => {
      const da = Math.hypot(F.sx(P[a][0]) - e.offsetX, F.sy(P[a][1]) - e.offsetY), db = Math.hypot(F.sx(P[b][0]) - e.offsetX, F.sy(P[b][1]) - e.offsetY);
      drag = da < db ? 0 : 1; cv.setPointerCapture(e.pointerId);
      const k = nearestT(e.offsetX, e.offsetY); if (drag === 0) a = k; else b = k; draw();
    });
    cv.addEventListener('pointermove', (e) => { if (drag < 0) return; const k = nearestT(e.offsetX, e.offsetY); if (drag === 0) a = k; else b = k; draw(); });
    cv.addEventListener('pointerup', () => { drag = -1; });
    cv.tabIndex = 0;
    cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); b = clamp(b + (e.key === 'ArrowRight' ? 6 : -6), 0, M); draw(); } });
    onRedraw(draw);
  })();

  /* ================= LAB B: rotating digit traces a loop ================= */
  (function rot() {
    const SZ = 24, imgs = [];
    for (let k = 0; k < 72; k++) imgs.push(ML.renderDigit(6, SZ, { rot: (k * 5 * Math.PI) / 180, scale: 0.78, width: 0.085 }));
    const pc = ML.pca(imgs, 3).Y, b3 = bounds3(pc);
    const cv = $('rotLoop'), view = make3D(cv, { yaw: 0.6, pitch: 0.35 });
    let k = 0;
    const rnd = ML.rng(99);
    function noise() { const im = new Float64Array(SZ * SZ); for (let i = 0; i < im.length; i++) im[i] = rnd(); imgToCanvas($('rotNoise'), im, SZ); }
    function draw() {
      const { ctx, w, h } = fit(cv), pr = view.projector(b3.c, b3.r, w, h, 0.85);
      const P = pc.map(pr);
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      for (let i = 0; i < 72; i++) { const j = (i + 1) % 72; line(ctx, P[i][0], P[i][1], P[j][0], P[j][1], seq(i / 71), 2); }
      draw3DPoints(ctx, P, (i) => seq(i / 71), () => 3.2);
      dot(ctx, P[k][0], P[k][1], 8, C.amber, C.card, 2.5);
      label(ctx, (k * 5) + '°', P[k][0] + 12, P[k][1] - 10, C.ink, { size: 12, weight: 700 });
      if (k !== 0) label(ctx, '0°', P[0][0] - 10, P[0][1] + 14, C.muted, { size: 11, align: 'right' });
      imgToCanvas($('rotImg'), imgs[k], SZ);
      $('rotOut').textContent = (k * 5) + '°';
      $('rotReadout').innerHTML = `At ${k * 5}° this image is the point (${pc[k].map((v) => v.toFixed(1)).join(', ')}) on the loop. All 576 pixel values change as you turn the knob, yet the images stay on a 1-D curve. A random point of ℝ<sup>576</sup> (right) is static.`;
    }
    view.render = draw;
    $('rotSlider').addEventListener('input', (e) => { k = +e.target.value / 5; draw(); });
    $('noiseBtn').addEventListener('click', noise);
    noise();
    onRedraw(draw);
    redrawers.push(noise);
  })();

  /* ================= LAB C: MDS on city distances ================= */
  (function mds() {
    const cv = $('mdsCanvas'), ev = $('mdsEig');
    let dataset = 'us', method = 'classical', noise = 0, Y = null, iter = 0, anim = 0, D = null, list = null, N = 0, truth = null, eig = null;
    function build() {
      list = dataset === 'us' ? ML.US_CITIES : ML.WORLD_CITIES; N = list.length;
      const D0 = ML.cityDistances(list), r = ML.rng(1234);
      D = new Float64Array(N * N);
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const v = Math.max(0, D0[i * N + j] * (1 + (noise / 100) * r.normal())); D[i * N + j] = D[j * N + i] = v; }
      const lat0 = dataset === 'us' ? 38 : 0;
      truth = list.map((c) => [c[2] * 111.2 * Math.cos((lat0 * Math.PI) / 180), c[1] * 111.2]);
      const D2 = D.map((v) => v * v);
      eig = ML.smallEig(ML.doubleCenter(D2, N), N).values;
      $('mdsTruth').disabled = dataset !== 'us';
      // distance table
      const k = 6, t = $('mdsTable');
      let html = '<tr><th></th>' + list.slice(0, k).map((c) => `<th>${c[0]}</th>`).join('') + '</tr>';
      for (let i = 0; i < k; i++) html += `<tr><th>${list[i][0]}</th>` + list.slice(0, k).map((_, j) => `<td>${Math.round(D[i * N + j]).toLocaleString()}</td>`).join('') + '</tr>';
      t.innerHTML = html;
    }
    function classical() { const D2 = D.map((v) => v * v); return ML.classicalMDS(D2, N, 2).Y; }
    function start(fromRandom) {
      cancelAnimationFrame(anim);
      if (method === 'classical') { Y = classical(); iter = null; draw(); return; }
      const r = ML.rng((Math.random() * 1e9) | 0), sc = dataset === 'us' ? 2500 : 10000;
      Y = fromRandom === false ? classical() : list.map(() => [sc * (r() - 0.5), sc * (r() - 0.5)]);
      iter = 0;
      const total = method === 'metric' ? 120 : 200;
      const stepFn = () => {
        const per = reduceMotion ? total : 2;
        for (let s = 0; s < per && iter < total; s++, iter++) Y = method === 'metric' ? ML.smacofStep(Y, D, N) : ML.sammonStep(Y, D, N, 0.35);
        draw();
        if (iter < total) anim = requestAnimationFrame(stepFn);
      };
      stepFn();
    }
    function draw() {
      if (!Y) return;
      const { ctx, w, h } = fit(cv);
      const A = ML.procrustes(Y, truth);
      const showT = $('mdsTruth').checked && dataset === 'us';
      const F = fitFrame(w, h, showT ? A.concat(truth) : A, w < 520 ? 30 : 54);
      if (showT) for (let i = 0; i < N; i++) {
        line(ctx, F.sx(A[i][0]), F.sy(A[i][1]), F.sx(truth[i][0]), F.sy(truth[i][1]), C.muted, 1);
        dot(ctx, F.sx(truth[i][0]), F.sy(truth[i][1]), 6.5, null, C.muted, 1.6);
      }
      for (let i = 0; i < N; i++) dot(ctx, F.sx(A[i][0]), F.sy(A[i][1]), 5, C.green, C.bg, 1.5);
      for (let i = 0; i < N; i++) {
        const right = F.sx(A[i][0]) < w - 90;
        label(ctx, list[i][0], F.sx(A[i][0]) + (right ? 9 : -9), F.sy(A[i][1]) - 9, C.ink, { size: w < 520 ? 10 : 11.5, align: right ? 'left' : 'right' });
      }
      const s = ML.stress(Y, D, N);
      $('mdsStress').textContent = pct(s, 1);
      $('mdsIter').textContent = iter == null ? 'closed form' : String(iter);
      drawEig();
      const pos = eig.filter((v) => v > 0).reduce((a, b) => a + b, 0), share3 = eig[2] / pos, neg = eig[N - 1] / pos;
      const flat = dataset === 'us';
      let txt = flat
        ? `<b>Two big eigenvalues, then almost nothing</b> (λ₃ is ${pct(share3, 1)} of the total). Distances across the continental US are nearly those of a flat 2-D map, so MDS redraws it, rotated or mirrored arbitrarily.`
        : `<b>A large third eigenvalue (${pct(share3)}) and big negative ones (${pct(neg)}).</b> The globe needs 3 dimensions, and great-circle distances aren't Euclidean in <em>any</em> flat space. Every 2-D layout must distort; look at where Honolulu and Sydney land. That's the Mercator problem.`;
      if (method === 'metric') txt += ' <b>Metric MDS</b> attacks the stress directly from a random start; on curved data it beats classical MDS on stress.';
      if (method === 'sammon') txt += ' <b>Sammon</b> weights small distances more, so nearby cities are placed most carefully.';
      if (method === 'classical') txt += ' Classical MDS is an eigenproblem: press “Scramble” and you get the identical answer.';
      if (noise > 0) txt += ` With ${noise}% measurement error, positions wobble but the overall map survives: MDS averages errors over many pairs.`;
      $('mdsReadout').innerHTML = txt;
    }
    function drawEig() {
      const { ctx, w, h } = fit(ev);
      const vals = eig.slice(0, 5).concat([eig[N - 1]]), labs = ['λ₁', 'λ₂', 'λ₃', 'λ₄', 'λ₅', 'λ_min'];
      const mx = Math.max(...vals.map(Math.abs)), base = h * 0.62, top = 10, bot = h - 22;
      const sc = Math.min((base - top) / mx, (bot - base) / Math.max(1e-9, -Math.min(0, ...vals)));
      const bw = (w - 20) / vals.length;
      vals.forEach((v, i) => {
        const x = 10 + i * bw + bw * 0.2, ww = bw * 0.6, y = v >= 0 ? base - v * sc : base, hh = Math.max(1, Math.abs(v) * sc);
        ctx.fillStyle = i < 2 ? C.green : v < 0 ? C.amber : C.grey;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, ww, hh, 3) : ctx.rect(x, y, ww, hh); ctx.fill();
        ctx.font = font(11, 600); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(labs[i], x + ww / 2, h - 16);
      });
      line(ctx, 6, base, w - 6, base, C.muted, 1);
      ctx.font = font(10.5, 600); ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('kept (green) · dropped (grey) · negative (orange)', 8, 0);
    }
    seg('mdsData', (v) => { dataset = v; build(); start(); });
    seg('mdsMethod', (v) => { method = v; start(); });
    $('mdsNoise').addEventListener('input', (e) => { noise = +e.target.value; $('mdsNoiseOut').textContent = noise + '%'; build(); start(false); });
    $('mdsTruth').addEventListener('change', draw);
    $('mdsScramble').addEventListener('click', () => start(true));
    build(); start();
    onRedraw(draw);
  })();

  /* ================= LAB D: Isomap ================= */
  (function iso() {
    const cvR = $('isoRoll'), cvE = $('isoEmbed');
    const view = make3D(cvR, { yaw: 0.3, pitch: 0.95 });
    let K = 10, noise = 0.25, data, D2, res, Yal, bad = [], pair = [0, 1], path = [], b3;
    function compute() {
      const t0 = performance.now();
      data = ML.swissRoll(600, noise, 1); D2 = ML.sqDist(data.X); b3 = bounds3(data.X);
      res = ML.isomap(data.X, K, 2, D2);
      Yal = ML.procrustes(res.Y, data.truth);
      bad = [];
      res.adj.forEach((es, i) => es.forEach((e) => {
        if (e.j < i) return;
        const tr = Math.hypot(data.truth[i][0] - data.truth[e.j][0], data.truth[i][1] - data.truth[e.j][1]);
        if (tr > 2.5 * e.w + 1) bad.push([i, e.j]);
      }));
      const T2 = ML.sqDist(data.truth);
      $('isoTrust').textContent = pct(ML.trustworthiness(T2, res.Y, 10));
      $('isoTime').textContent = Math.round(performance.now() - t0) + ' ms';
      if (!pair || pair[0] >= 600) newPair(); else setPath();
    }
    function newPair() {
      const r = ML.rng((Math.random() * 1e9) | 0); let best = null, bv = 0;
      for (let tries = 0; tries < 3000; tries++) {
        const a = (r() * 600) | 0, b = (r() * 600) | 0; if (a === b) continue;
        const e = Math.sqrt(D2[a * 600 + b]), t = Math.hypot(data.truth[a][0] - data.truth[b][0], data.truth[a][1] - data.truth[b][1]);
        if (e > 4 && e < 9 && t / e > bv) { bv = t / e; best = [a, b]; }
      }
      pair = best || [0, 1]; setPath();
    }
    function setPath() {
      const { prev } = ML.dijkstra(res.adj, pair[0]);
      path = []; let u = pair[1];
      while (u >= 0 && path.length < 2000) { path.push(u); if (u === pair[0]) break; u = prev[u]; }
      if (path[path.length - 1] !== pair[0]) path = [];
      const [a, b] = pair;
      $('isoE').textContent = fmt(Math.sqrt(D2[a * 600 + b]), 1);
      $('isoG').textContent = path.length ? fmt(res.G[a * 600 + b], 1) : 'no path';
      $('isoT').textContent = fmt(Math.hypot(data.truth[a][0] - data.truth[b][0], data.truth[a][1] - data.truth[b][1]), 1);
      $('isoBad').textContent = String(bad.length);
      const tr = Math.hypot(data.truth[a][0] - data.truth[b][0], data.truth[a][1] - data.truth[b][1]), g = res.G[a * 600 + b];
      $('isoReadout').innerHTML = res.components > 1
        ? `<b>The graph fell apart into ${res.components} pieces.</b> With K = ${K}, some regions have no path to others, so their geodesic distance is undefined (it's patched with a large constant) and the embedding is garbage. Raise K.`
        : bad.length
          ? `<b>${bad.length} short-circuit edge${bad.length > 1 ? 's' : ''}</b> tunnel between layers (orange). Shortest paths take these shortcuts, so geodesic distances shrink (here ${fmt(g, 1)} vs. a true ${fmt(tr, 1)}) and MDS folds the roll back up. Lower K or the noise.`
          : `<b>No short-circuits.</b> The graph distance (${fmt(g, 1)}) closely tracks the true distance on the rug (${fmt(tr, 1)}), even though the points are only ${fmt(Math.sqrt(D2[a * 600 + b]), 1)} apart through the air. Classical MDS on these distances unrolls the sheet.`;
      draw();
    }
    function draw() {
      if (!res) return;
      { // 3-D roll
        const { ctx, w, h } = fit(cvR), pr = view.projector(b3.c, b3.r, w, h, 0.98), P = data.X.map(pr);
        if ($('isoEdges').checked) {
          ctx.strokeStyle = rgba('grey', 0.18); ctx.lineWidth = 0.7; ctx.beginPath();
          res.adj.forEach((es, i) => es.forEach((e) => { if (e.j > i) { ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[e.j][0], P[e.j][1]); } }));
          ctx.stroke();
        }
        draw3DPoints(ctx, P, (i) => seq(data.color[i]), () => 2.4);
        for (const [i, j] of bad) line(ctx, P[i][0], P[i][1], P[j][0], P[j][1], C.amber, 2.2);
        ctx.strokeStyle = C.green; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.beginPath();
        path.forEach((u, k) => (k ? ctx.lineTo(P[u][0], P[u][1]) : ctx.moveTo(P[u][0], P[u][1]))); ctx.stroke();
        for (const u of pair) dot(ctx, P[u][0], P[u][1], 6.5, C.card, C.ink, 2.5);
      }
      { // embedding
        const { ctx, w, h } = fit(cvE), F = fitFrame(w, h, Yal, 20);
        for (const [i, j] of bad) line(ctx, F.sx(Yal[i][0]), F.sy(Yal[i][1]), F.sx(Yal[j][0]), F.sy(Yal[j][1]), rgba('amber', 0.6), 1.2);
        drawEmbedding(ctx, F, Yal, (i) => seq(data.color[i]), 2.6);
        ctx.strokeStyle = C.green; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.beginPath();
        path.forEach((u, k) => (k ? ctx.lineTo(F.sx(Yal[u][0]), F.sy(Yal[u][1])) : ctx.moveTo(F.sx(Yal[u][0]), F.sy(Yal[u][1])))); ctx.stroke();
        for (const u of pair) dot(ctx, F.sx(Yal[u][0]), F.sy(Yal[u][1]), 6.5, C.card, C.ink, 2.5);
      }
    }
    view.render = draw;
    const recompute = debounce(() => { compute(); }, 120);
    $('isoK').addEventListener('input', (e) => { K = +e.target.value; $('isoKOut').textContent = K; recompute(); });
    $('isoNoise').addEventListener('input', (e) => { noise = +e.target.value; $('isoNoiseOut').textContent = noise.toFixed(2); recompute(); });
    $('isoEdges').addEventListener('change', draw);
    $('isoPair').addEventListener('click', newPair);
    let done = false;
    whenVisible(cvR, (v) => { if (v && !done) { done = true; compute(); newPair(); } });
    onRedraw(draw);
  })();

  /* ================= LAB E: kernel PCA on rings ================= */
  (function kpca() {
    const data = ML.rings(300, 0.13, 3), D2 = ML.sqDist(data.X);
    let kernel = 'rbf', slider = 65, res = null;
    const gamma = () => Math.pow(10, -2 + (3 * slider) / 100), degree = () => 1 + Math.round(slider / 20);
    function compute() {
      $('kpParam').disabled = kernel === 'linear';
      if (kernel === 'rbf') { $('kpParamLab').firstChild.textContent = 'RBF width γ '; $('kpParamOut').textContent = gamma().toPrecision(2); }
      else if (kernel === 'poly') { $('kpParamLab').firstChild.textContent = 'Polynomial degree '; $('kpParamOut').textContent = degree(); }
      else { $('kpParamLab').firstChild.textContent = 'No parameter for the linear kernel '; $('kpParamOut').textContent = ''; }
      res = ML.kernelPCA(data.X, kernel, kernel === 'rbf' ? gamma() : degree(), 2, D2);
      const v = res.Y.map((y, i) => [y[0], data.y[i]]).sort((a, b) => a[0] - b[0]);
      let best = 0, c0 = 0;
      const n1 = data.y.reduce((a, b) => a + b, 0);
      for (let t = 0; t <= v.length; t++) {
        if (t > 0) c0 += v[t - 1][1] === 0 ? 1 : 0;
        const left0 = c0, left1 = t - c0, acc = (left0 + (n1 - left1)) / v.length;
        best = Math.max(best, acc, 1 - acc);
      }
      $('kpAcc').textContent = pct(best);
      $('kpVar').textContent = pct(res.values[0] / res.trace);
      $('kpForm').textContent = kernel === 'rbf' ? 'exp(−γ‖x−x′‖²)' : kernel === 'poly' ? `(1 + x·x′)^${degree()}` : 'x·x′';
      let txt;
      if (kernel === 'linear') txt = `<b>Linear kernel = ordinary PCA.</b> It can only rotate the data, and a ring around a core has no "special" direction. One component separates at best ${pct(best)}, barely above guessing.`;
      else if (kernel === 'poly') txt = degree() === 1 ? 'Degree 1 is just PCA again.' : degree() === 2
        ? `<b>A cautionary tale.</b> Degree 2 includes x², y² and xy, so the perfect feature x² + y² (squared radius) is available. But kernel PCA picks the feature with the most <em>variance</em>, and around the big outer ring x² − y² varies even more. Best split: only ${pct(best)}. Unsupervised methods find what varies, not necessarily what you care about.`
        : `Degree ${degree()} adds many higher-order features. Radius is still in there, but other features vary more, so KPC 1 isn't it (${pct(best)}).`;
      else {
        const g = gamma();
        txt = g < 0.03 ? `<b>γ is tiny</b>, so every point looks similar to every other and the kernel behaves almost linearly: ${pct(best)}.`
          : g > 4 ? `<b>γ is huge</b>: each point is similar only to its closest neighbours, the kernel matrix approaches the identity, and the components latch onto small local clumps (${pct(best)}).`
            : best > 0.95 ? `<b>Just right.</b> The RBF kernel turns "close together" into "similar", and the first kernel component comes out as roughly <em>distance from the centre</em>. One number separates core from suburbs: ${pct(best)}, with no labels used.`
              : `<b>Getting there (${pct(best)}).</b> At this width the leading component still mostly describes the big outer ring. Slide γ up a little until it singles out the core.`;
      }
      $('kpReadout').innerHTML = txt;
      draw();
    }
    function draw() {
      const cols = [C.s1, C.s2];
      { const { ctx, w, h } = fit($('kpData')), F = fitFrame(w, h, data.X, 20); drawEmbedding(ctx, F, data.X, (i) => cols[data.y[i]], 3); }
      if (!res) return;
      const { ctx, w, h } = fit($('kpEmbed')), strip = 46;
      const F = fitFrame(w, h - strip, res.Y, 18);
      drawEmbedding(ctx, F, res.Y, (i) => cols[data.y[i]], 3);
      let x0 = Infinity, x1 = -Infinity; res.Y.forEach((y) => { x0 = Math.min(x0, y[0]); x1 = Math.max(x1, y[0]); });
      const sy = h - strip + 6;
      line(ctx, 14, sy + 20, w - 14, sy + 20, C.line, 1);
      const jr = ML.rng(5);
      res.Y.forEach((y, i) => dot(ctx, 14 + ((y[0] - x0) / (x1 - x0 || 1)) * (w - 28), sy + 20 + (data.y[i] ? -7 : 7) + 3 * (jr() - 0.5), 2.5, cols[data.y[i]]));
      label(ctx, 'KPC 1 only', 16, sy + 2, C.muted, { size: 10.5 });
    }
    seg('kpKernel', (v) => { kernel = v; compute(); });
    $('kpParam').addEventListener('input', debounce((e) => { slider = +$('kpParam').value; compute(); }, 30));
    compute();
    onRedraw(draw);
  })();

  /* ================= LAB F: MVU-style unfolding ================= */
  (function mvu() {
    const cv = $('mvuCanvas'), N = 60, SP = 0.5;
    let mode = '2', U = null, running = false, raf = 0;
    const base = ML.necklace(N, SP);
    function reset() {
      cancelAnimationFrame(raf); running = false; $('mvuPlay').textContent = 'Pull';
      const links = [];
      if (mode !== '0') for (let i = 0; i + 1 < N; i++) { links.push([i, i + 1]); if (i + 2 < N) links.push([i, i + 2]); }
      U = new ML.Unfolder(base.X, links); U.spread0 = U.spread();
      stats(); draw();
    }
    function stats() {
      $('mvuSpread').textContent = U.spread().toFixed(1) + (U.iter ? ` (${(U.spread() / U.spread0).toFixed(1)}×)` : '');
      $('mvuViol').textContent = mode === '0' ? 'n/a' : pct(U.maxViolation(), 1);
      $('mvuStep').textContent = String(U.iter);
      if (!U.iter) return;
      const e2e = Math.hypot(U.X[0][0] - U.X[N - 1][0], U.X[0][1] - U.X[N - 1][1]) / ((N - 1) * SP);
      $('mvuReadout').innerHTML = mode === '0'
        ? '<b>Nothing locked: the spiral just inflates.</b> Maximising spread without constraints scales everything up forever, and the shape never changes. The neighbour constraints are what force unfolding.'
        : e2e > 0.95
          ? `<b>Straight.</b> End-to-end distance is ${pct(Math.min(1, e2e))} of the chain's length. The locked links never stretched by more than ${pct(U.maxViolation(), 1)}. Reading off positions along the line recovers each bead's place on the necklace, so the 1-D manifold is unrolled.`
          : `Unfolding… spread is up ${(U.spread() / U.spread0).toFixed(1)}× while every locked link keeps its length.`;
    }
    function draw() {
      const { ctx, w, h } = fit(cv);
      let ext = 0; for (const p of U.X) ext = Math.max(ext, Math.abs(p[0]) * 0.55, Math.abs(p[1]));
      U.frame = Math.max(U.frame || 0, ext * 1.05, 5);
      const F = fitFrame(w, h, [[-U.frame / 0.55, -U.frame], [U.frame / 0.55, U.frame]], 14);
      if (U.links.length) {
        ctx.strokeStyle = rgba('grey', 0.55); ctx.lineWidth = 1.2; ctx.beginPath();
        for (const [a, b] of U.links) { ctx.moveTo(F.sx(U.X[a][0]), F.sy(U.X[a][1])); ctx.lineTo(F.sx(U.X[b][0]), F.sy(U.X[b][1])); }
        ctx.stroke();
      }
      U.X.forEach((p, i) => dot(ctx, F.sx(p[0]), F.sy(p[1]), 5, seq(base.color[i]), C.bg, 1.2));
    }
    function loop() {
      for (let s = 0; s < 2; s++) U.step(mode === '0' ? 0.01 : 0.012);
      stats(); draw();
      const limit = mode === '0' ? 140 : 500;
      if (running && U.iter < limit) raf = requestAnimationFrame(loop);
      else { running = false; $('mvuPlay').textContent = 'Pull'; }
    }
    $('mvuPlay').addEventListener('click', () => {
      if (running) { running = false; cancelAnimationFrame(raf); $('mvuPlay').textContent = 'Pull'; return; }
      if (U.iter >= (mode === '0' ? 140 : 500)) reset();
      running = true; $('mvuPlay').textContent = 'Pause';
      if (reduceMotion) { while (U.iter < (mode === '0' ? 140 : 500)) U.step(mode === '0' ? 0.01 : 0.012); running = false; $('mvuPlay').textContent = 'Pull'; stats(); draw(); return; }
      loop();
    });
    $('mvuReset').addEventListener('click', reset);
    seg('mvuLinks', (v) => { mode = v; reset(); });
    reset();
    onRedraw(draw);
  })();

  /* ================= LAB G: LLE ================= */
  (function lle() {
    const data = ML.sCurve(500, 0.05, 2), D2 = ML.sqDist(data.X), b3 = bounds3(data.X);
    const cvC = $('lleCurve'), cvE = $('lleEmbed');
    let K = 12, reg = 0.001, res = null, Yal = null, sel = 0, P3 = [];
    // start with a point near the middle of the S
    let bd = Infinity; data.color.forEach((c, i) => { const d = Math.abs(c - 0.42) + Math.abs(data.truth[i][1] - 5) / 10; if (d < bd) { bd = d; sel = i; } });
    const view = make3D(cvC, { yaw: -0.5, pitch: 0.3, onClick: (x, y) => { const i = nearestProjected(P3, x, y, 16); if (i >= 0) { sel = i; draw(); weights(); } } });
    function compute() {
      res = ML.lle(data.X, K, 2, reg, D2);
      Yal = ML.procrustes(res.Y, data.truth);
      weights(); draw();
    }
    function weights() {
      const nb = res.nb[sel], w = res.W[sel];
      const order = nb.map((_, a) => a).sort((a, b) => w[b] - w[a]);
      const mx = Math.max(...w.map(Math.abs));
      $('lleWeights').innerHTML = order.map((a) => {
        const v = w[a], frac = Math.abs(v) / mx;
        const left = v >= 0 ? 30 : 30 - 30 * frac, width = v >= 0 ? 70 * frac : 30 * frac;
        return `<div class="wbar"><span>nbr #${nb[a]}</span><div class="wtrack"><div class="zero"></div><div class="fill${v < 0 ? ' neg' : ''}" style="left:${left}%;width:${width}%"></div></div><b>${v.toFixed(3)}</b></div>`;
      }).join('');
      const x = data.X[sel], rec = [0, 0, 0];
      nb.forEach((j, a) => { for (let d = 0; d < 3; d++) rec[d] += w[a] * data.X[j][d]; });
      const err = Math.hypot(x[0] - rec[0], x[1] - rec[1], x[2] - rec[2]);
      const nd = nb.reduce((s, j) => s + Math.sqrt(D2[sel * 500 + j]), 0) / nb.length;
      const sum = w.reduce((a, b) => a + b, 0), wmax = Math.max(...res.W.map((r) => Math.max(...r.map(Math.abs))));
      $('lleRecon').innerHTML = `Weights sum to ${sum.toFixed(3)}. Recipe error ‖x<sub>i</sub> − Σw<sub>ij</sub>x<sub>j</sub>‖ = ${err.toFixed(3)}, while neighbours are ${nd.toFixed(2)} away on average. Orange = positive weight, purple = negative.`;
      $('lleReadout').innerHTML = reg < 1e-4
        ? `<b>Barely regularised.</b> With K = ${K} neighbours on a 2-D sheet there are many exact recipes, so the solver picks extreme ones: the largest |w| anywhere is ${wmax.toFixed(1)}. Those wild recipes make the 2-D layout unreliable.`
        : reg > 0.05
          ? `<b>Heavily regularised.</b> Weights are pushed towards a plain average (≈ 1/K = ${(1 / K).toFixed(3)} each), so recipes stay tame but blur the local geometry.`
          : `<b>Each recipe is local and tame</b> (largest |w| = ${wmax.toFixed(2)}). The embedding on the right keeps every recipe as well as possible, so the S is flattened into a sheet with colour running light → dark along it. Nothing preserves global scale, so expect some squashing at the edges. Try a small K (5) or a large one (24) to see how touchy LLE is.`;
    }
    function draw() {
      if (!res) return;
      const nb = new Set(res.nb[sel]);
      { const { ctx, w, h } = fit(cvC), pr = view.projector(b3.c, b3.r, w, h, 0.95);
        P3 = data.X.map(pr);
        draw3DPoints(ctx, P3, (i) => (nb.has(i) ? C.ink : seq(data.color[i])), (i) => (nb.has(i) ? 3.4 : 2.4));
        for (const j of nb) line(ctx, P3[sel][0], P3[sel][1], P3[j][0], P3[j][1], C.amber, 1.4);
        dot(ctx, P3[sel][0], P3[sel][1], 6.5, C.amber, C.card, 2);
      }
      { const { ctx, w, h } = fit(cvE), F = fitFrame(w, h, Yal, 18);
        drawEmbedding(ctx, F, Yal, (i) => seq(data.color[i]), 2.5);
        for (const j of nb) { line(ctx, F.sx(Yal[sel][0]), F.sy(Yal[sel][1]), F.sx(Yal[j][0]), F.sy(Yal[j][1]), C.amber, 1.2); dot(ctx, F.sx(Yal[j][0]), F.sy(Yal[j][1]), 3.4, C.ink); }
        dot(ctx, F.sx(Yal[sel][0]), F.sy(Yal[sel][1]), 6.5, C.amber, C.card, 2);
      }
    }
    view.render = draw;
    $('lleK').addEventListener('input', debounce((e) => { K = +$('lleK').value; compute(); }, 120));
    $('lleK').addEventListener('input', (e) => { $('lleKOut').textContent = e.target.value; });
    seg('lleReg', (v) => { reg = +v; compute(); });
    let done = false;
    whenVisible(cvC, (v) => { if (v && !done) { done = true; compute(); } });
    onRedraw(draw);
  })();

  /* ================= LAB H: Laplacian eigenmaps ================= */
  (function lap() {
    const data = ML.swissRoll(600, 0.25, 1), D2 = ML.sqDist(data.X), b3 = bounds3(data.X);
    const cvR = $('lapRoll'), cvE = $('lapEmbed'), view = make3D(cvR, { yaw: 0.3, pitch: 0.95 });
    let K = 10, t = 1, which = '1', res = null;
    const corr = (x, y) => {
      const n = x.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i] / n; my += y[i] / n; }
      let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
      return sxy / Math.sqrt(sx * sy || 1);
    };
    const arc = data.truth.map((p) => p[0]), hgt = data.truth.map((p) => p[1]);
    let a0 = Infinity, a1 = -Infinity; arc.forEach((v) => { a0 = Math.min(a0, v); a1 = Math.max(a1, v); });
    const overtone = arc.map((v) => Math.cos((2 * Math.PI * (v - a0)) / (a1 - a0))); // second harmonic along the roll
    function compute() {
      const t0 = performance.now();
      res = ML.laplacianEigenmaps(data.X, K, 2, t, D2, 4);
      for (let c = 1; c <= 4; c++) if (corr(res.vectors[c], arc) < 0) res.vectors[c] = res.vectors[c].map((v) => -v);
      res.Y = data.X.map((_, i) => [res.vectors[1][i], res.vectors[2][i]]);
      $('lapL1').textContent = res.values[1].toExponential(2);
      $('lapL2').textContent = res.values[2].toExponential(2);
      $('lapTime').textContent = Math.round(performance.now() - t0) + ' ms';
      draw();
    }
    function draw() {
      if (!res) return;
      const v = which === 't' ? null : res.vectors[+which], mx = v ? Math.max(...v.map(Math.abs)) : 1;
      { const { ctx, w, h } = fit(cvR), pr = view.projector(b3.c, b3.r, w, h, 0.98);
        draw3DPoints(ctx, data.X.map(pr), (i) => (v ? div(v[i] / mx) : seq(data.color[i])), () => 2.6); }
      { const { ctx, w, h } = fit(cvE), F = fitFrame(w, h, res.Y, 20);
        drawEmbedding(ctx, F, res.Y, (i) => seq(data.color[i]), 2.6);
        ctx.font = font(11, 600); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.fillText('eigenvector 1 →', w / 2, h - 6);
        ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('eigenvector 2 →', 0, 0); ctx.restore(); }
      let txt;
      if (which === 't') txt = 'True position along the roll, for reference. Compare with eigenvector 1.';
      else {
        const k = +which, ra = Math.abs(corr(v, arc)), rh = Math.abs(corr(v, hgt)), ro = Math.abs(corr(v, overtone));
        const best = Math.max(ra, rh, ro);
        txt = best === ra && ra > 0.8
          ? `<b>Eigenvector ${k} runs smoothly from the inner end to the outer end</b> (correlation ${ra.toFixed(2)} with true position). It is the graph's "fundamental mode", discovered from neighbour links alone. It is the smoothest non-constant way to colour the graph.`
          : best === rh && rh > 0.6
            ? `<b>Eigenvector ${k} runs across the rug</b>, tracking height (correlation ${rh.toFixed(2)}). That's the second intrinsic coordinate.`
            : best === ro && ro > 0.6
              ? `<b>Eigenvector ${k} is an overtone</b>: it goes up and back down along the roll (correlation ${ro.toFixed(2)} with a full cosine wave along the roll), like a guitar string's second harmonic. It adds no new direction, which is a known weakness when the manifold is long and thin.`
              : `Eigenvector ${k} mixes several modes. Higher eigenvectors wiggle faster and are less useful as coordinates.`;
        if (k === 2 && best === ro) txt += ' (So the 2-D embedding on the right curls into a horseshoe instead of a rectangle.)';
      }
      $('lapReadout').innerHTML = txt;
    }
    view.render = draw;
    seg('lapColor', (v) => { which = v; draw(); });
    seg('lapT', (v) => { t = v === 'Infinity' ? Infinity : +v; compute(); });
    $('lapK').addEventListener('input', (e) => { $('lapKOut').textContent = e.target.value; });
    $('lapK').addEventListener('input', debounce(() => { K = +$('lapK').value; compute(); }, 120));
    let done = false;
    whenVisible(cvR, (v) => { if (v && !done) { done = true; compute(); } });
    onRedraw(draw);
  })();

  /* ================= shared digits data + highlight state ================= */
  const DIG = ML.digits(50, 7, 16);
  const DIG_D2 = ML.sqDist(DIG.X);
  let highlight = [4, 7, 9]; // slot index = position, kept stable while a digit stays selected
  const hlListeners = [];
  function digitColor(d) { const k = highlight.indexOf(d); return k >= 0 && highlight[k] != null ? SLOT()[k] : null; }
  function drawGlyphs(ctx, F, Y, size) {
    ctx.font = font(size || 11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const order = Y.map((_, i) => i).sort((a, b) => (digitColor(DIG.y[a]) ? 1 : 0) - (digitColor(DIG.y[b]) ? 1 : 0));
    for (const i of order) {
      const c = digitColor(DIG.y[i]);
      ctx.fillStyle = c || rgba('muted', 0.5);
      ctx.fillText(String(DIG.y[i]), F.sx(Y[i][0]), F.sy(Y[i][1]));
    }
  }
  function knnAcc(Y) {
    const N = Y.length, nb = ML.knn(ML.sqDist(Y), N, 5); let c = 0;
    for (let i = 0; i < N; i++) for (const j of nb[i]) if (DIG.y[j] === DIG.y[i]) c++;
    return c / (N * 5);
  }

  /* ================= LAB I: t-SNE ================= */
  (function tsne() {
    const cv = $('tsCanvas'), N = DIG.X.length;
    const nbPix = ML.knn(DIG_D2, N, 5), pcaY = ML.pca(DIG.X, 2).Y, pcaAcc = knnAcc(pcaY);
    let perp = 30, kernel = 't', viewMode = 'tsne', ts = null, running = true, visible = false, raf = 0, F = null, hover = -1, acc = NaN;
    let ext = null;
    const MAXIT = 1000;
    function restart(newSeed) {
      ts = new ML.TSNE(DIG_D2, N, { perplexity: perp, kernel, seed: newSeed ? (Math.random() * 1e9) | 0 : 1 });
      ext = null; acc = NaN; update(); kick();
    }
    function kick() { if (!raf && running && visible && viewMode === 'tsne' && ts.iter < MAXIT) raf = requestAnimationFrame(loop); }
    function loop() {
      raf = 0;
      if (!running || !visible || viewMode !== 'tsne') return;
      const steps = reduceMotion ? 50 : 3;
      for (let s = 0; s < steps && ts.iter < MAXIT; s++) ts.step();
      if (ts.iter % 50 < steps || ts.iter >= MAXIT) acc = knnAcc(ts.Y);
      update();
      if (ts.iter < MAXIT) raf = requestAnimationFrame(loop);
      else { running = false; $('tsPlay').textContent = 'Run'; }
    }
    function update() {
      const Y = viewMode === 'pca' ? pcaY : ts.Y;
      const { ctx, w, h } = fit(cv);
      // smooth the frame so the picture doesn't jitter as t-SNE expands
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of Y) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      if (viewMode === 'pca' || !ext) ext = [x0, x1, y0, y1];
      else ext = [lerp(ext[0], x0, 0.15), lerp(ext[1], x1, 0.15), lerp(ext[2], y0, 0.15), lerp(ext[3], y1, 0.15)];
      F = fitFrame(w, h, [[Math.min(ext[0], x0), Math.min(ext[2], y0)], [Math.max(ext[1], x1), Math.max(ext[3], y1)]], 16);
      drawGlyphs(ctx, F, Y, 11.5);
      if (hover >= 0) { dot(ctx, F.sx(Y[hover][0]), F.sy(Y[hover][1]), 10, null, C.ink, 2); for (const j of nbPix[hover]) dot(ctx, F.sx(Y[j][0]), F.sy(Y[j][1]), 8, null, C.amber, 1.6); }
      $('tsIter').textContent = viewMode === 'pca' ? '–' : String(ts.iter);
      $('tsKL').textContent = viewMode === 'pca' || !isFinite(ts.kl) ? '–' : ts.kl.toFixed(3);
      $('tsAcc').textContent = viewMode === 'pca' ? pct(pcaAcc) : isFinite(acc) ? pct(acc) : '…';
      let txt;
      if (viewMode === 'pca') txt = `<b>PCA, for contrast.</b> The two highest-variance directions of the 256-pixel space keep only ${pct(pcaAcc)} of map neighbours in the same class. Digits overlap in a smear because the classes don't differ along one flat plane.`;
      else if (ts.iter < 100) txt = '<b>Early exaggeration.</b> For the first 100 iterations, every p<sub>ij</sub> is multiplied by 4, so similar points clump together strongly before the fine arrangement starts.';
      else if (kernel === 'gauss') txt = '<b>Gaussian map kernel: the crowding problem.</b> A Gaussian can\'t place moderately similar points far apart, so everything piles up and the classes run into each other. Switch back to Student-t and restart.';
      else if (perp <= 5) txt = `<b>Perplexity ${perp}:</b> each point listens to only ~${perp} neighbours, so true classes shatter into small fragments. These little clumps aren't real structure.`;
      else if (perp >= 80) txt = `<b>Perplexity ${perp}:</b> each point considers a large share of the dataset as neighbours. The picture becomes more global and nearby clusters start to merge.`;
      else txt = 'Islands of digits appear without any labels. Look at which islands touch: shapes that share strokes (4/9, 3/5/8, 7/1) sit close and swap a few members. Press <b>Restart</b> and see the islands rearrange; only the neighbourhoods are stable.';
      $('tsReadout').innerHTML = txt;
    }
    function showHover(i) {
      hover = i;
      if (i < 0) { $('tsHoverLab').textContent = 'Hover a point'; return; }
      imgToCanvas($('tsHoverImg'), DIG.X[i], 16);
      $('tsHoverLab').textContent = `A “${DIG.y[i]}” (image #${i})`;
      $('tsHoverTxt').textContent = 'Its 5 nearest neighbours in pixel space (circled in orange on the map):';
      const row = $('tsHoverNb'); row.innerHTML = '';
      for (const j of nbPix[i]) { const c = document.createElement('canvas'); c.width = c.height = 16; c.title = 'a ' + DIG.y[j]; imgToCanvas(c, DIG.X[j], 16); row.appendChild(c); }
    }
    cv.addEventListener('pointermove', (e) => {
      if (!F) return;
      const Y = viewMode === 'pca' ? pcaY : ts.Y;
      let best = -1, bd = 12;
      Y.forEach((p, i) => { const d = Math.hypot(F.sx(p[0]) - e.offsetX, F.sy(p[1]) - e.offsetY); if (d < bd) { bd = d; best = i; } });
      if (best !== hover) { showHover(best); if (!raf) update(); }
    });
    cv.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; showHover(-1); if (!raf) update(); } });
    $('tsPlay').addEventListener('click', () => {
      if (ts.iter >= MAXIT) { running = true; restart(true); $('tsPlay').textContent = 'Pause'; return; }
      running = !running; $('tsPlay').textContent = running ? 'Pause' : 'Run'; kick();
    });
    $('tsRestart').addEventListener('click', () => { running = true; $('tsPlay').textContent = 'Pause'; restart(true); });
    $('tsPerp').addEventListener('input', (e) => { $('tsPerpOut').textContent = e.target.value; });
    $('tsPerp').addEventListener('change', (e) => { perp = +e.target.value; running = true; $('tsPlay').textContent = 'Pause'; restart(false); });
    seg('tsKernel', (v) => { kernel = v; running = true; $('tsPlay').textContent = 'Pause'; restart(false); });
    seg('tsView', (v) => { viewMode = v; ext = null; update(); kick(); });
    // highlight chips
    const chips = $('tsChips');
    function renderChips() {
      chips.innerHTML = '';
      for (let d = 0; d < 10; d++) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = d;
        const k = highlight.indexOf(d);
        if (k >= 0) b.className = 'on c' + k;
        b.setAttribute('aria-pressed', String(k >= 0));
        b.addEventListener('click', () => {
          const kk = highlight.indexOf(d);
          if (kk >= 0) highlight[kk] = null;
          else { const free = highlight.indexOf(null); if (free >= 0) highlight[free] = d; else if (highlight.length < 3) highlight.push(d); else { highlight.shift(); highlight.push(d); } }
          renderChips(); hlListeners.forEach((f) => f());
        });
        chips.appendChild(b);
      }
    }
    renderChips();
    hlListeners.push(() => { if (!raf) update(); });
    restart(false);
    whenVisible(cv, (v) => { visible = v; kick(); });
    onRedraw(update);
  })();

  /* ================= LAB I·2: crowding ================= */
  (function crowd() {
    const cv = $('crowdCanvas'); let p = 0.05;
    function draw() {
      const { ctx, w, h } = fit(cv);
      const dG = Math.sqrt(-Math.log(p)), dT = Math.sqrt(1 / p - 1), xmax = Math.min(12, Math.max(5, dT * 1.15));
      const pad = { l: 40, r: 14, t: 14, b: 32 }, rw = w - pad.l - pad.r, rh = h - pad.t - pad.b;
      const sx = (x) => pad.l + (x / xmax) * rw, sy = (y) => pad.t + rh - y * rh;
      ctx.font = font(11); ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const y of [0, 0.25, 0.5, 0.75, 1]) { line(ctx, pad.l, sy(y), w - pad.r, sy(y), C.line, 1); ctx.fillText(String(y), pad.l - 6, sy(y)); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = 0; x <= xmax; x += xmax > 8 ? 2 : 1) ctx.fillText(String(x), sx(x), h - pad.b + 5);
      ctx.fillText('distance on the map', pad.l + rw / 2, h - 14);
      const curve = (f, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const x = (xmax * i) / 200; i ? ctx.lineTo(sx(x), sy(f(x))) : ctx.moveTo(sx(x), sy(f(x))); } ctx.stroke(); };
      curve((x) => Math.exp(-x * x), C.violet); curve((x) => 1 / (1 + x * x), C.green);
      line(ctx, pad.l, sy(p), w - pad.r, sy(p), C.amber, 1.5, [5, 4]);
      line(ctx, sx(dG), sy(p), sx(dG), sy(0), C.violet, 1.5, [3, 3]); dot(ctx, sx(dG), sy(p), 5, C.violet, C.bg, 1.5);
      line(ctx, sx(dT), sy(p), sx(dT), sy(0), C.green, 1.5, [3, 3]); dot(ctx, sx(dT), sy(p), 5, C.green, C.bg, 1.5);
      label(ctx, 'Gaussian', sx(0.55), sy(Math.exp(-0.3)) - 4, C.ink, { size: 11.5 });
      label(ctx, 'Student-t', sx(Math.min(xmax * 0.55, 2.4)), sy(1 / (1 + Math.min(xmax * 0.55, 2.4) ** 2)) - 14, C.ink, { size: 11.5 });
      $('crowdOut').textContent = p.toFixed(2);
      $('crowdG').textContent = dG.toFixed(2); $('crowdT').textContent = dT.toFixed(2) + ` (${(dT / dG).toFixed(1)}×)`;
    }
    $('crowdP').addEventListener('input', (e) => { p = +e.target.value / 100; draw(); });
    onRedraw(draw);
  })();

  /* ================= LAB J: compare ================= */
  (function compare() {
    const grid = $('cmpGrid'), METHODS = ['PCA', 'Isomap', 'Kernel PCA (RBF)', 'LLE', 'Laplacian eigenmaps', 't-SNE'];
    const panels = METHODS.map((m) => {
      const f = document.createElement('figure');
      f.innerHTML = `<div class="cmp-h"><b>${m}</b><span>–</span></div><canvas height="230" aria-label="${m} embedding"></canvas>`;
      grid.appendChild(f);
      return { canvas: f.querySelector('canvas'), info: f.querySelector('span'), Y: null };
    });
    let dsName = 'swiss', ds = null, running = false, token = 0;
    function getData() {
      if (dsName === 'swiss') { const d = ML.swissRoll(600, 0.25, 1); return { X: d.X, color: d.color, truth: d.truth, D2: ML.sqDist(d.X) }; }
      if (dsName === 'scurve') { const d = ML.sCurve(500, 0.05, 2); return { X: d.X, color: d.color, truth: d.truth, D2: ML.sqDist(d.X) }; }
      return { X: DIG.X, digits: true, D2: DIG_D2 };
    }
    function drawPanel(p) {
      const { ctx, w, h } = fit(p.canvas);
      if (!p.Y) { ctx.font = font(12); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.fillText('not run yet', w / 2, h / 2); return; }
      const Y = ds.truth ? ML.procrustes(p.Y, ds.truth) : p.Y, F = fitFrame(w, h, Y, 14);
      if (ds.digits) drawGlyphs(ctx, F, Y, 9.5); else drawEmbedding(ctx, F, Y, (i) => seq(ds.color[i]), 2);
    }
    function finish(i, Y, ms) {
      panels[i].Y = Y;
      const tw = ML.trustworthiness(ds.D2, Y, 10);
      panels[i].info.textContent = `kept ${pct(tw)} · ${ms} ms` + (ds.digits ? ` · same digit ${pct(knnAcc(Y))}` : '');
      panels[i].info.title = 'Neighbours kept: share of 10 nearest neighbours preserved in 2-D';
      drawPanel(panels[i]);
    }
    function run() {
      const my = ++token; running = true; $('cmpRun').disabled = true;
      ds = getData();
      panels.forEach((p) => { p.Y = null; p.info.textContent = '…'; drawPanel(p); });
      const X = ds.X, D2 = ds.D2, N = X.length;
      let med = []; for (let i = 0; i < N; i += 7) for (let j = i + 1; j < N; j += 11) med.push(D2[i * N + j]);
      med.sort((a, b) => a - b); const gamma = 1 / med[med.length >> 1];
      const jobs = [
        () => ML.pca(X, 2).Y,
        () => ML.isomap(X, 10, 2, D2).Y,
        () => ML.kernelPCA(X, 'rbf', gamma, 2, D2).Y,
        () => ML.lle(X, 12, 2, 1e-3, D2).Y,
        () => ML.laplacianEigenmaps(X, 10, 2, 1, D2).Y,
      ];
      let k = 0;
      const status = (s) => { $('cmpStatus').textContent = s; };
      const next = () => {
        if (my !== token) return;
        if (k < jobs.length) {
          status(`Running ${METHODS[k]}…`);
          later(() => { if (my !== token) return; const t0 = performance.now(); const Y = jobs[k](); finish(k, Y, Math.round(performance.now() - t0)); k++; next(); });
          return;
        }
        // t-SNE in chunks so the page stays responsive
        const t0 = performance.now(), ts = new ML.TSNE(D2, N, { perplexity: 30, seed: 3 }), total = 700;
        const chunk = () => {
          if (my !== token) return;
          for (let s = 0; s < 25 && ts.iter < total; s++) ts.step();
          status(`Running t-SNE… iteration ${ts.iter} / ${total}`);
          panels[5].Y = ts.Y.map((p) => p.slice()); drawPanel(panels[5]);
          if (ts.iter < total) later(chunk);
          else { finish(5, ts.Y, Math.round(performance.now() - t0)); status(summary()); running = false; $('cmpRun').disabled = false; }
        };
        chunk();
      };
      next();
    }
    function summary() {
      if (ds.digits) return 'Digits: only the neighbourhood methods separate the classes; t-SNE does it best. PCA and kernel PCA smear them together.';
      return `${dsName === 'swiss' ? 'Swiss roll' : 'S-curve'}: Isomap unrolls it faithfully (a clean light → dark gradient); LLE and Laplacian eigenmaps keep the order but squash the shape; PCA and RBF kernel PCA fold the layers; t-SNE keeps neighbours but tears the sheet into pieces.`;
    }
    seg('cmpData', (v) => { dsName = v; token++; running = false; $('cmpRun').disabled = false; ds = getData(); panels.forEach((p) => { p.Y = null; p.info.textContent = '–'; drawPanel(p); }); $('cmpStatus').textContent = 'Press “Run all six”.'; });
    $('cmpRun').addEventListener('click', () => { if (!running) run(); });
    hlListeners.push(() => { if (ds && ds.digits) panels.forEach(drawPanel); });
    ds = getData();
    onRedraw(() => panels.forEach(drawPanel));
  })();

  /* ================= page plumbing ================= */
  let rt = null;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(() => redrawers.forEach((f) => f()), 120); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); redrawers.forEach((f) => f()); });
  const links = [...document.querySelectorAll('.lesson-nav a')];
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('section.lesson').forEach((s) => io.observe(s));
})();

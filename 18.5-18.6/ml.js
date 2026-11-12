/* Small, dependency-free ML core for the 18.5.5–18.6 walkthrough.
   Gradient boosting with several losses, an XGBoost-style tree learner,
   gain-based feature importance and partial dependence.
   Everything is seeded so the page looks the same on every load. */
(function (global) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  const median = (a) => {
    const s = Float64Array.from(a).sort(), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };

  /* =========================================================
     Part 1 · Gradient boosting on house prices (1-D input)
     ========================================================= */

  // Sale price ($k) as a function of size (thousands of sq ft).
  function houseTruth(s) {
    return 110 + 150 * s + 70 * Math.tanh(2.2 * (s - 2.1));
  }
  // Clean listings plus 5 data-entry errors that overstate the price by ~$650k,
  // all for mid-sized homes (1,200–2,100 sq ft).
  function makeHouses(n, seed, withTypos) {
    const r = rng(seed), x = [], y = [], typo = [];
    for (let i = 0; i < n; i++) {
      const s = 0.6 + 3.0 * r();
      x.push(s); y.push(houseTruth(s) + 32 * gauss(r)); typo.push(false);
    }
    if (withTypos) {
      const r2 = rng(seed + 1000);
      for (let k = 0; k < 5; k++) {
        const s = 1.2 + 0.2 * k + 0.1 * r2();
        x.push(s); y.push(houseTruth(s) + 600 + 100 * r2()); typo.push(true);
      }
    }
    return { x, y, typo };
  }

  const LOSSES = {
    // value, negative gradient (pseudo-residual), and the optimal constant for a leaf
    squared: {
      init: (y) => y.reduce((a, b) => a + b, 0) / y.length,
      grad: (y, f) => y - f,
      leaf: (res) => res.reduce((a, b) => a + b, 0) / res.length,
    },
    absolute: {
      init: (y) => median(y),
      grad: (y, f) => (y > f ? 1 : y < f ? -1 : 0),
      leaf: (res) => median(res),
    },
    huber: {
      delta: 60,
      init: (y) => median(y),
      grad: (y, f) => { const r = y - f, d = LOSSES.huber.delta; return Math.abs(r) <= d ? r : d * Math.sign(r); },
      // Friedman's one-step approximation to the Huber-optimal constant
      leaf: (res) => {
        const m = median(res), d = LOSSES.huber.delta;
        let s = 0;
        for (const r of res) { const q = r - m; s += Math.sign(q) * Math.min(d, Math.abs(q)); }
        return m + s / res.length;
      },
    },
  };

  // Least-squares regression tree on 1-D x, fit to `target`; returns leaves with member indices.
  function fitTree1D(x, target, depth, minLeaf) {
    const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
    function build(ids, d) {
      const n = ids.length;
      if (d === 0 || n < 2 * minLeaf) return { leaf: true, ids };
      let tot = 0, tot2 = 0;
      for (const i of ids) { tot += target[i]; tot2 += target[i] * target[i]; }
      let best = null, ls = 0, ls2 = 0;
      for (let k = 0; k < n - 1; k++) {
        const i = ids[k];
        ls += target[i]; ls2 += target[i] * target[i];
        const nl = k + 1, nr = n - nl;
        if (nl < minLeaf || nr < minLeaf || x[i] === x[ids[k + 1]]) continue;
        const rs = tot - ls, rs2 = tot2 - ls2;
        const sse = (ls2 - ls * ls / nl) + (rs2 - rs * rs / nr);
        if (!best || sse < best.sse) best = { sse, k, t: (x[i] + x[ids[k + 1]]) / 2 };
      }
      if (!best) return { leaf: true, ids };
      return { leaf: false, t: best.t, l: build(ids.slice(0, best.k + 1), d - 1), r: build(ids.slice(best.k + 1), d - 1) };
    }
    return build(order, depth);
  }
  function leaves(node, out) {
    out = out || [];
    if (node.leaf) out.push(node); else { leaves(node.l, out); leaves(node.r, out); }
    return out;
  }
  function tree1DPredict(n, x) { while (!n.leaf) n = x <= n.t ? n.l : n.r; return n.v; }

  // Gradient tree boosting (Friedman's Algorithm): fit a tree to the pseudo-residuals,
  // then re-optimise each leaf's value for the actual loss.
  function gradientBoost1D(x, y, lossKey, opts) {
    const L = LOSSES[lossKey], N = x.length;
    const f0 = L.init(y), F = new Float64Array(N).fill(f0), trees = [], pseudo = [];
    for (let m = 0; m < opts.M; m++) {
      const g = Float64Array.from(y, (yi, i) => L.grad(yi, F[i]));
      pseudo.push(g);
      const tree = fitTree1D(x, g, opts.depth, opts.minLeaf);
      for (const lf of leaves(tree)) lf.v = L.leaf(lf.ids.map((i) => y[i] - F[i]));
      trees.push(tree);
      for (let i = 0; i < N; i++) F[i] += opts.nu * tree1DPredict(tree, x[i]);
    }
    pseudo.push(Float64Array.from(y, (yi, i) => L.grad(yi, F[i])));
    return { f0, trees, pseudo, nu: opts.nu };
  }

  /* =========================================================
     Part 2 · Spam filter: XGBoost-style boosting on 9–10 features
     ========================================================= */

  // Word / character frequencies (% of the email), modelled on the UCI "spambase"
  // data the book uses. "hp" and "george" are clues that the email is a work email
  // to George at HP Labs, where that dataset was collected.
  const SPAM_FEATURES = [
    { key: 'excl', label: '“!”', long: 'frequency of “!”' },
    { key: 'dollar', label: '“$”', long: 'frequency of “$”' },
    { key: 'remove', label: 'remove', long: 'frequency of the word “remove”' },
    { key: 'free', label: 'free', long: 'frequency of the word “free”' },
    { key: 'your', label: 'your', long: 'frequency of the word “your”' },
    { key: 'hp', label: 'hp', long: 'frequency of the word “hp”' },
    { key: 'edu', label: 'edu', long: 'frequency of the word “edu”' },
    { key: 'george', label: 'george', long: 'frequency of the word “george”' },
    { key: 'noise', label: 'msg-ID digit', long: 'a random digit from the message ID (pure noise)' },
  ];
  const COPY_FEATURE = { key: 'excl2', label: '“!” (2nd counter)', long: '“!” counted by a second, slightly different tokenizer' };

  function zeroExp(r, pZero, mean) { return r() < pZero ? 0 : -mean * Math.log(1 - r()); }

  function spamLogit(e) {
    const [ex, dol, rem, fr, yo, hp, edu, geo] = e;
    const work = hp > 0.05 ? 1 : 0;
    let z = -1.35;
    z += 2.8 * (1 - Math.exp(-ex / 0.22)) * (work ? 0.3 : 1); // "!" matters far less in work emails
    z += 2.0 * (1 - Math.exp(-dol / 0.07));
    z += 2.4 * sigmoid((rem - 0.12) / 0.03);
    z += 1.1 * (1 - Math.exp(-fr / 0.25));
    z += 0.35 * Math.min(yo, 2.5);
    z -= 2.6 * (1 - Math.exp(-hp / 0.25));
    z -= 2.0 * (1 - Math.exp(-edu / 0.15));
    z -= 3.2 * sigmoid((geo - 0.05) / 0.02);
    return z;
  }
  function makeSpam(n, seed, withCopy) {
    const r = rng(seed), rc = rng(seed + 7777), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const e = [
        zeroExp(r, 0.45, 0.35), zeroExp(r, 0.68, 0.14), zeroExp(r, 0.8, 0.4), zeroExp(r, 0.7, 0.4),
        zeroExp(r, 0.38, 1.0), zeroExp(r, 0.74, 0.7), zeroExp(r, 0.85, 0.45), zeroExp(r, 0.86, 1.0),
        Math.floor(10 * r()),
      ];
      const label = r() < sigmoid(2.2 * spamLogit(e)) ? 1 : 0;
      if (withCopy) e.push(Math.max(0, e[0] * (0.95 + 0.1 * rc()) + 0.01 * gauss(rc)));
      X.push(e); y.push(label);
    }
    return { X, y };
  }

  // Quantile thresholds for histogram-based split finding (as XGBoost's "hist" method does).
  function makeBins(X, nb) {
    const D = X[0].length, N = X.length, thr = [], bin = [];
    for (let f = 0; f < D; f++) {
      const v = Float64Array.from(X, (x) => x[f]).sort();
      const cuts = [];
      for (let q = 1; q < nb; q++) {
        const a = v[Math.floor(q / nb * (N - 1))], b = v[Math.min(N - 1, Math.floor(q / nb * (N - 1)) + 1)];
        const c = (a + b) / 2;
        if (a !== b && (!cuts.length || c > cuts[cuts.length - 1])) cuts.push(c);
      }
      // make sure "is it exactly zero?" is always a candidate split
      const firstPos = v.find((t) => t > 0);
      if (v[0] === 0 && firstPos !== undefined) { const c = firstPos / 2; if (!cuts.includes(c)) { cuts.push(c); cuts.sort((p, q) => p - q); } }
      thr.push(cuts);
      const b = new Uint8Array(N);
      for (let i = 0; i < N; i++) { let k = 0; while (k < cuts.length && X[i][f] > cuts[k]) k++; b[i] = k; }
      bin.push(b);
    }
    return { thr, bin };
  }

  // XGBoost objective: sum of second-order loss approximations + gamma*J + lambda/2 * sum w^2.
  function xgbTree(bins, g, h, ids, depth, p) {
    const D = bins.thr.length;
    let G = 0, H = 0;
    for (const i of ids) { G += g[i]; H += h[i]; }
    const node = { leaf: true, w: -G / (H + p.lambda), n: ids.length };
    if (depth === 0 || ids.length < 2 * p.minLeaf) return node;
    let best = null;
    const base = G * G / (H + p.lambda);
    for (const f of p.feats || [...Array(D).keys()]) {
      const nb = bins.thr[f].length + 1, Gb = new Float64Array(nb), Hb = new Float64Array(nb), Cb = new Int32Array(nb);
      const bf = bins.bin[f];
      for (const i of ids) { const b = bf[i]; Gb[b] += g[i]; Hb[b] += h[i]; Cb[b]++; }
      let GL = 0, HL = 0, CL = 0;
      for (let b = 0; b < nb - 1; b++) {
        GL += Gb[b]; HL += Hb[b]; CL += Cb[b];
        const CR = ids.length - CL;
        if (CL < p.minLeaf || CR < p.minLeaf) continue;
        const GR = G - GL, HR = H - HL;
        const gain = 0.5 * (GL * GL / (HL + p.lambda) + GR * GR / (HR + p.lambda) - base) - p.gamma;
        if (!best || gain > best.gain) best = { gain, f, b };
      }
    }
    if (!best || best.gain <= 0) return node;
    const L = [], R = [], bf = bins.bin[best.f];
    for (const i of ids) (bf[i] <= best.b ? L : R).push(i);
    return {
      leaf: false, f: best.f, t: bins.thr[best.f][best.b], gain: best.gain, n: ids.length,
      l: xgbTree(bins, g, h, L, depth - 1, p), r: xgbTree(bins, g, h, R, depth - 1, p),
    };
  }
  function xgbPredict(n, x) { while (!n.leaf) n = x[n.f] <= n.t ? n.l : n.r; return n.w; }
  function addImportance(n, imp) { if (!n.leaf) { imp[n.f] += n.gain; addImportance(n.l, imp); addImportance(n.r, imp); } }

  // Binary log-loss boosting. Returns everything the page needs, cached per prefix length.
  function trainSpamGBM(train, test, p) {
    const N = train.X.length, D = train.X[0].length, r = rng(p.seed || 1);
    const bins = makeBins(train.X, 32);
    const ybar = train.y.reduce((a, b) => a + b, 0) / N;
    const f0 = Math.log(ybar / (1 - ybar));
    const F = new Float64Array(N).fill(f0), Ft = new Float64Array(test.X.length).fill(f0);
    const g = new Float64Array(N), h = new Float64Array(N), all = [...Array(N).keys()];
    const trees = [], cumImp = [new Float64Array(D)], testAcc = [];
    const acc = () => { let c = 0; for (let i = 0; i < Ft.length; i++) c += (Ft[i] > 0 ? 1 : 0) === test.y[i]; return c / Ft.length; };
    testAcc.push(acc());
    for (let m = 0; m < p.M; m++) {
      for (let i = 0; i < N; i++) { const q = sigmoid(F[i]); g[i] = q - train.y[i]; h[i] = q * (1 - q); }
      // colsample_bytree: each tree may only use a random subset of the features
      let feats = [...Array(D).keys()];
      if (p.colsample < 1) {
        for (let i = D - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [feats[i], feats[j]] = [feats[j], feats[i]]; }
        feats = feats.slice(0, Math.max(1, Math.round(p.colsample * D))).sort((a, b) => a - b);
      }
      const t = xgbTree(bins, g, h, all, p.depth, Object.assign({}, p, { feats }));
      trees.push(t);
      for (let i = 0; i < N; i++) F[i] += p.nu * xgbPredict(t, train.X[i]);
      for (let i = 0; i < Ft.length; i++) Ft[i] += p.nu * xgbPredict(t, test.X[i]);
      const imp = Float64Array.from(cumImp[m]);
      addImportance(t, imp);
      cumImp.push(imp);
      testAcc.push(acc());
    }
    return { f0, trees, nu: p.nu, cumImp, testAcc, D };
  }
  function gbmLogit(model, M, x) {
    let z = model.f0;
    for (let m = 0; m < M; m++) z += model.nu * xgbPredict(model.trees[m], x);
    return z;
  }

  // Partial dependence of the predicted spam probability on feature k:
  //   pd(v) = (1/N) * sum_n  p(spam | x_k = v, x_{n,-k})
  // Also returns every row's individual curve (ICE) so the page can show the average forming.
  function partialDependence(model, M, rows, k, grid) {
    const ice = rows.map(() => new Float64Array(grid.length));
    const pd = new Float64Array(grid.length);
    rows.forEach((x0, r) => {
      const x = x0.slice();
      grid.forEach((v, j) => { x[k] = v; ice[r][j] = sigmoid(gbmLogit(model, M, x)); });
    });
    for (let j = 0; j < grid.length; j++) { let s = 0; for (const c of ice) s += c[j]; pd[j] = s / rows.length; }
    return { pd, ice };
  }
  function partialDependence2D(model, M, rows, a, b, ga, gb) {
    const out = new Float64Array(ga.length * gb.length);
    for (const x0 of rows) {
      const x = x0.slice();
      for (let j = 0; j < gb.length; j++) {
        x[b] = gb[j];
        for (let i = 0; i < ga.length; i++) { x[a] = ga[i]; out[j * ga.length + i] += sigmoid(gbmLogit(model, M, x)); }
      }
    }
    for (let q = 0; q < out.length; q++) out[q] /= rows.length;
    return out;
  }

  global.ML = {
    rng, gauss, sigmoid, median,
    houseTruth, makeHouses, LOSSES, gradientBoost1D, tree1DPredict,
    SPAM_FEATURES, COPY_FEATURE, makeSpam, trainSpamGBM, gbmLogit, partialDependence, partialDependence2D,
  };
})(typeof window !== 'undefined' ? window : globalThis);

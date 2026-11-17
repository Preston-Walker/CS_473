/* Small, dependency-free learning routines for the 19.3 companion page.
   Exposes window.ML. All randomness is seeded so the page is reproducible. */
(function () {
  'use strict';

  /* ---------- seeded randomness ---------- */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
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
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  /* ---------- datasets ---------- */
  // Two interleaved arcs ("moons"): support tickets mapped to 2-D by text similarity.
  // y = 0 billing, y = 1 technical. Coordinates roughly in [-1.3, 2.3] x [-0.8, 1.3].
  function moons(n, seed, noise) {
    const r = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const c = i % 2, t = Math.PI * r();
      let px, py;
      if (c === 0) { px = Math.cos(t); py = Math.sin(t); }
      else { px = 1 - Math.cos(t); py = 0.5 - Math.sin(t); }
      X.push([px + noise * gauss(r), py + noise * gauss(r)]);
      y.push(c);
    }
    return { X, y };
  }

  // Shoppers: [visits per month, average basket in dollars]. No labels are ever used.
  function shoppers(seed) {
    const r = rng(seed), X = [];
    const groups = [
      { n: 70, m: [14, 28], s: [2.6, 8] },   // frequent, small baskets
      { n: 55, m: [4.5, 140], s: [1.4, 22] }, // weekly-ish big shop
      { n: 45, m: [1.6, 55], s: [0.8, 16] },  // rare visitors
      { n: 40, m: [10, 95], s: [2.2, 15] },   // regular, mid-to-large
    ];
    for (const g of groups) for (let i = 0; i < g.n; i++) {
      X.push([
        Math.min(20, Math.max(0.2, g.m[0] + g.s[0] * gauss(r))),
        Math.min(200, Math.max(5, g.m[1] + g.s[1] * gauss(r))),
      ]);
    }
    return shuffle(X, r);
  }

  // Card transactions: [hour of day, purchase amount $]. `fraud` is hidden truth, never used for fitting.
  function transactions(seed) {
    const r = rng(seed), X = [], fraud = [];
    for (let i = 0; i < 360; i++) {
      const lunch = r() < 0.35;
      const hour = lunch ? 12.5 + 1.1 * gauss(r) : 17.5 + 2.4 * gauss(r);
      const amt = Math.exp(Math.log(lunch ? 14 : 45) + 0.55 * gauss(r));
      X.push([Math.min(23.9, Math.max(6, hour)), Math.min(480, amt)]); fraud.push(0);
    }
    for (let i = 0; i < 40; i++) { // a few legitimate oddities: morning coffee, a big furniture buy
      if (i % 4 === 0) { X.push([9 + 6 * r(), 250 + 200 * r()]); }
      else { X.push([7 + 1.5 * r(), Math.exp(Math.log(6) + 0.4 * gauss(r))]); }
      fraud.push(0);
    }
    for (let i = 0; i < 14; i++) { // fraud: small "test" charges and large purchases in the small hours
      const big = i % 3 !== 0;
      X.push([1 + 3.5 * r(), big ? 260 + 210 * r() : 1 + 2 * r()]); fraud.push(1);
    }
    const idx = shuffle(X.map((_, i) => i), r);
    return { X: idx.map((i) => X[i]), fraud: idx.map((i) => fraud[i]) };
  }

  // Two correlated exam scores [midterm, final].
  function exams(seed) {
    const r = rng(seed), X = [];
    for (let i = 0; i < 120; i++) {
      const ability = gauss(r);
      X.push([72 + 10 * ability + 4.5 * gauss(r), 70 + 12 * ability + 5 * gauss(r)]);
    }
    return X;
  }

  /* ---------- supervised: k-nearest neighbours ---------- */
  function knn(trainX, trainY, x, k) {
    const best = [];
    for (let i = 0; i < trainX.length; i++) {
      const d = d2(trainX[i], x);
      if (best.length < k) { best.push([d, trainY[i]]); best.sort((a, b) => a[0] - b[0]); }
      else if (d < best[k - 1][0]) { best[k - 1] = [d, trainY[i]]; best.sort((a, b) => a[0] - b[0]); }
    }
    let v = 0; for (const b of best) v += b[1];
    return v / best.length; // probability of class 1
  }

  /* ---------- semi-supervised: label propagation on a k-NN graph ---------- */
  // Labeled points are clamped; every unlabeled point repeatedly takes the
  // weighted average of its neighbours' scores (the harmonic solution).
  function buildGraph(X, k, sigma) {
    const n = X.length, W = Array.from({ length: n }, () => new Map());
    for (let i = 0; i < n; i++) {
      const ds = [];
      for (let j = 0; j < n; j++) if (j !== i) ds.push([d2(X[i], X[j]), j]);
      ds.sort((a, b) => a[0] - b[0]);
      for (const [d, j] of ds.slice(0, k)) { // symmetric k-NN graph with Gaussian weights
        const w = Math.exp(-d / (2 * sigma * sigma));
        W[i].set(j, Math.max(W[i].get(j) || 0, w));
        W[j].set(i, Math.max(W[j].get(i) || 0, w));
      }
    }
    return W.map((m) => Array.from(m));
  }
  // labels[i] is 0, 1 or null. Labeled nodes are clamped; each unlabeled node repeatedly
  // becomes the weighted average of its neighbours (Gauss-Seidel sweeps toward the harmonic solution).
  function propagate(W, labels, iters) {
    const f = labels.map((l) => (l == null ? 0.5 : l));
    for (let t = 0; t < iters; t++) {
      for (let i = 0; i < f.length; i++) {
        if (labels[i] != null) continue;
        let s = 0, ws = 0;
        for (const [j, w] of W[i]) { s += w * f[j]; ws += w; }
        if (ws > 0) f[i] = s / ws;
      }
    }
    return f;
  }

  // Class mass normalisation (Zhu, Ghahramani & Lafferty 2003): with very few labels the raw
  // scores drift toward one class, so compare each score to its class's total mass instead of 0.5.
  function hardLabels(f, labels) {
    let s1 = 1e-12, s0 = 1e-12;
    f.forEach((v, i) => { if (labels[i] == null) { s1 += v; s0 += 1 - v; } });
    return f.map((v, i) => (labels[i] != null ? labels[i] : v / s1 > (1 - v) / s0 ? 1 : 0));
  }

  /* ---------- unsupervised: k-means ---------- */
  function kmeansInit(X, k, seed) { // k-means++
    const r = rng(seed), C = [X[Math.floor(r() * X.length)].slice()];
    while (C.length < k) {
      const ds = X.map((x) => Math.min(...C.map((c) => d2(x, c))));
      const tot = ds.reduce((a, b) => a + b, 0);
      let u = r() * tot, i = 0;
      while (u > ds[i] && i < X.length - 1) { u -= ds[i]; i++; }
      C.push(X[i].slice());
    }
    return C;
  }
  function kmeansAssign(X, C) {
    return X.map((x) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = d2(x, c); if (d < bd) { bd = d; b = j; } }); return b; });
  }
  function kmeansUpdate(X, a, C) {
    return C.map((c, j) => {
      let sx = 0, sy = 0, m = 0;
      X.forEach((x, i) => { if (a[i] === j) { sx += x[0]; sy += x[1]; m++; } });
      return m ? [sx / m, sy / m] : c.slice();
    });
  }
  function inertia(X, a, C) { let s = 0; X.forEach((x, i) => { s += d2(x, C[a[i]]); }); return s; }
  function kmeans(X, k, seed, maxIt) {
    let C = kmeansInit(X, k, seed), a = kmeansAssign(X, C);
    for (let t = 0; t < (maxIt || 100); t++) {
      const C2 = kmeansUpdate(X, a, C), a2 = kmeansAssign(X, C2);
      C = C2;
      if (a2.every((v, i) => v === a[i])) { a = a2; break; }
      a = a2;
    }
    return { C, a, J: inertia(X, a, C) };
  }

  /* ---------- unsupervised: anomaly score ---------- */
  // Mean distance to the k nearest neighbours in standardised space. Larger = lonelier.
  function knnOutlierScores(X, k) {
    const dims = X[0].length, mu = [], sd = [];
    for (let d = 0; d < dims; d++) {
      const v = X.map((x) => x[d]); const m = v.reduce((a, b) => a + b, 0) / v.length;
      mu.push(m); sd.push(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1);
    }
    const Z = X.map((x) => x.map((v, d) => (v - mu[d]) / sd[d]));
    return Z.map((z, i) => {
      const ds = [];
      for (let j = 0; j < Z.length; j++) if (j !== i) ds.push(Math.sqrt(d2(z, Z[j])));
      ds.sort((a, b) => a - b);
      return ds.slice(0, k).reduce((a, b) => a + b, 0) / k;
    });
  }

  /* ---------- unsupervised: PCA in 2-D ---------- */
  function pca2(X) {
    const n = X.length, m = [0, 0];
    for (const x of X) { m[0] += x[0] / n; m[1] += x[1] / n; }
    let sxx = 0, syy = 0, sxy = 0;
    for (const x of X) { const a = x[0] - m[0], b = x[1] - m[1]; sxx += a * a / n; syy += b * b / n; sxy += a * b / n; }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    return { mean: m, cov: [[sxx, sxy], [sxy, syy]], angle, total: sxx + syy };
  }
  function varianceAlong(p, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return c * c * p.cov[0][0] + 2 * c * s * p.cov[0][1] + s * s * p.cov[1][1];
  }

  window.ML = { rng, gauss, shuffle, moons, shoppers, transactions, exams, knn, buildGraph, propagate, hardLabels,
    kmeansInit, kmeansAssign, kmeansUpdate, inertia, kmeans, knnOutlierScores, pca2, varianceAlong };
})();

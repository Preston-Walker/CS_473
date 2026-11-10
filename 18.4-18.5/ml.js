/* Small, dependency-free ML core for the 18.4–18.5 walkthrough.
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

  /* ---------- Datasets ---------- */

  // Loan applicants: x = [credit score, debt-to-income %], y = 1 if repaid.
  // Credit score is the strong feature, so every bagged tree wants it first.
  function loanTruth(s, d) {
    const a = (s - 655) / 38;
    const b = (d - 30) / 9;
    return sigmoid(1.7 * a - 1.25 * b + 0.9 * Math.sin(1.3 * b) - 0.25 * a * b);
  }
  function makeLoans(n, seed) {
    const r = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const s = 520 + 320 * r(), d = 2 + 56 * r();
      X.push([s, d]);
      y.push(r() < loanTruth(s, d) ? 1 : 0);
    }
    return { X, y };
  }

  // Bike rentals vs. temperature (°C): busy on mild days, quiet when cold or very hot.
  function bikeTruth(t) {
    return 600 + 4200 * Math.exp(-Math.pow((t - 23) / 9.5, 2)) + 220 * Math.sin(t / 2.2);
  }
  function makeBikes(n, seed) {
    const r = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const t = -4 + 40 * r();
      X.push(t);
      y.push(Math.max(0, bikeTruth(t) + 520 * gauss(r)));
    }
    return { X, y };
  }

  // Emails: x = [links in the message, % CAPITAL letters], y = +1 spam / -1 ham.
  function spamTruth(l, c) {
    const u = l / 10, v = c / 50;
    return sigmoid(25 * (u + 0.9 * v + 0.6 * u * v - 0.95));
  }
  function makeEmails(n, seed) {
    const r = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const l = 10 * r(), c = 50 * r();
      X.push([l, c]);
      y.push(r() < spamTruth(l, c) ? 1 : -1);
    }
    return { X, y };
  }
  // Eight mislabeled emails sitting deep inside the other class.
  const OUTLIERS = [
    { x: [0.8, 6], y: 1 }, { x: [1.6, 3], y: 1 }, { x: [0.5, 15], y: 1 }, { x: [2.2, 9], y: 1 },       // plain ham tagged "spam"
    { x: [8.8, 44], y: -1 }, { x: [9.5, 35], y: -1 }, { x: [7.5, 47], y: -1 }, { x: [9.2, 25], y: -1 }, // blatant spam tagged "ham"
  ];

  // Eight-feature loan applications (standardised units) for the random-feature lab.
  const LOAN_FEATURES = ['Credit score', 'Debt-to-income', 'Late payments', 'Years employed', 'Savings', 'Loan size', 'Zip-code digit', 'Day of week'];
  function makeLoans8(n, seed) {
    const r = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const x = [];
      for (let j = 0; j < 8; j++) x.push(gauss(r));
      const z = 2.0 * x[0] - 0.9 * x[1] - 0.8 * Math.max(0, x[2]) + 0.7 * Math.tanh(x[3]) + 0.6 * x[4] - 0.4 * x[5] * x[1] - 0.5 * x[5];
      X.push(x);
      y.push(r() < sigmoid(1.6 * z) ? 1 : 0);
    }
    return { X, y };
  }

  /* ---------- Classification trees for the forest ---------- */

  // Bootstrap sample + optionally a random subset of features at every split.
  function growTree(X, y, idx, opts, r, depth) {
    let pos = 0;
    for (const i of idx) pos += y[i];
    const n = idx.length, p = pos / n;
    if (depth >= opts.maxDepth || n < opts.minSplit || pos === 0 || pos === n) return { leaf: true, p };
    const D = X[0].length;
    let feats = [];
    for (let f = 0; f < D; f++) feats.push(f);
    if (opts.mtry < D) {
      for (let i = feats.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [feats[i], feats[j]] = [feats[j], feats[i]]; }
      feats = feats.slice(0, opts.mtry);
    }
    let best = null;
    for (const f of feats) {
      const order = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
      let lp = 0;
      for (let k = 0; k < n - 1; k++) {
        lp += y[order[k]];
        const v = X[order[k]][f], w = X[order[k + 1]][f];
        if (v === w) continue;
        const nl = k + 1, nr = n - nl, rp = pos - lp;
        const gl = 1 - (lp / nl) ** 2 - (1 - lp / nl) ** 2;
        const gr = 1 - (rp / nr) ** 2 - (1 - rp / nr) ** 2;
        const cost = (nl * gl + nr * gr) / n;
        if (!best || cost < best.cost) best = { cost, f, t: (v + w) / 2 };
      }
    }
    if (!best) return { leaf: true, p };
    const L = [], R = [];
    for (const i of idx) (X[i][best.f] <= best.t ? L : R).push(i);
    return { leaf: false, f: best.f, t: best.t, l: growTree(X, y, L, opts, r, depth + 1), r: growTree(X, y, R, opts, r, depth + 1) };
  }
  function treePredict(node, x) {
    while (!node.leaf) node = x[node.f] <= node.t ? node.l : node.r;
    return node.p;
  }
  function growForest(X, y, M, mtry, seed) {
    const r = rng(seed), trees = [], N = X.length;
    for (let m = 0; m < M; m++) {
      const idx = [];
      for (let i = 0; i < N; i++) idx.push(Math.floor(r() * N));
      trees.push(growTree(X, y, idx, { maxDepth: 12, minSplit: 2, mtry }, r, 0));
    }
    return trees;
  }

  /* ---------- Weak learners for boosting ---------- */

  // Weighted least-squares tree on 1-D input (used by LS boosting).
  function regTree1D(x, r, w, depth) {
    const idx = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
    function build(ids, d) {
      let sw = 0, swr = 0;
      for (const i of ids) { sw += w[i]; swr += w[i] * r[i]; }
      const mean = sw ? swr / sw : 0;
      if (d === 0 || ids.length < 4) return { leaf: true, v: mean };
      let best = null, lw = 0, lwr = 0, lwrr = 0, tw = 0, twr = 0, twrr = 0;
      for (const i of ids) { tw += w[i]; twr += w[i] * r[i]; twrr += w[i] * r[i] * r[i]; }
      for (let k = 0; k < ids.length - 1; k++) {
        const i = ids[k];
        lw += w[i]; lwr += w[i] * r[i]; lwrr += w[i] * r[i] * r[i];
        if (x[i] === x[ids[k + 1]] || k < 1 || k > ids.length - 3) continue;
        const rw = tw - lw, rwr = twr - lwr, rwrr = twrr - lwrr;
        const sse = (lwrr - lwr * lwr / lw) + (rwrr - rwr * rwr / rw);
        if (!best || sse < best.sse) best = { sse, k, t: (x[i] + x[ids[k + 1]]) / 2 };
      }
      if (!best) return { leaf: true, v: mean };
      return { leaf: false, t: best.t, l: build(ids.slice(0, best.k + 1), d - 1), r: build(ids.slice(best.k + 1), d - 1) };
    }
    return build(idx, depth);
  }
  function regTree1DPredict(n, x) { while (!n.leaf) n = x <= n.t ? n.l : n.r; return n.v; }

  // Weighted classification stump on 2-D input (discrete AdaBoost).
  function classStump(X, y, w) {
    const N = X.length; let best = null, W = 0;
    for (let i = 0; i < N; i++) W += w[i];
    for (let f = 0; f < 2; f++) {
      const order = X.map((_, i) => i).sort((a, b) => X[a][f] - X[b][f]);
      // err for rule "predict +1 if x_f > t" ; flip gives W - err
      let errRight = 0; // all predicted +1 initially (t below min): error = weight of negatives
      for (let i = 0; i < N; i++) if (y[i] < 0) errRight += w[i];
      for (let k = -1; k < N; k++) {
        if (k >= 0) { const i = order[k]; errRight += y[i] > 0 ? w[i] : -w[i]; }
        if (k >= 0 && k < N - 1 && X[order[k]][f] === X[order[k + 1]][f]) continue;
        const lo = k < 0 ? X[order[0]][f] - 1 : X[order[k]][f];
        const hi = k >= N - 1 ? X[order[N - 1]][f] + 1 : X[order[k + 1]][f];
        const t = (lo + hi) / 2;
        for (const s of [1, -1]) {
          const e = (s === 1 ? errRight : W - errRight) / W;
          if (!best || e < best.err) best = { f, t, s, err: e };
        }
      }
    }
    return best; // predict s if x_f > t else -s
  }
  const stumpPredict = (st, x) => (x[st.f] > st.t ? st.s : -st.s);

  // Weighted regression stump on 2-D input (LogitBoost).
  function regStump2D(X, z, w) {
    const N = X.length; let best = null;
    let tw = 0, twz = 0;
    for (let i = 0; i < N; i++) { tw += w[i]; twz += w[i] * z[i]; }
    for (let f = 0; f < 2; f++) {
      const order = X.map((_, i) => i).sort((a, b) => X[a][f] - X[b][f]);
      let lw = 0, lwz = 0;
      for (let k = 0; k < N - 1; k++) {
        const i = order[k];
        lw += w[i]; lwz += w[i] * z[i];
        if (X[i][f] === X[order[k + 1]][f]) continue;
        const rw = tw - lw, rwz = twz - lwz;
        if (lw <= 0 || rw <= 0) continue;
        const gain = lwz * lwz / lw + rwz * rwz / rw; // maximise = minimise weighted SSE
        if (!best || gain > best.gain) best = { gain, f, t: (X[i][f] + X[order[k + 1]][f]) / 2, vl: lwz / lw, vr: rwz / rw };
      }
    }
    return best;
  }
  const regStumpPredict = (st, x) => (x[st.f] <= st.t ? st.vl : st.vr);

  global.ML = {
    rng, gauss, sigmoid,
    loanTruth, makeLoans, LOAN_FEATURES, makeLoans8, bikeTruth, makeBikes, spamTruth, makeEmails, OUTLIERS,
    growTree, treePredict, growForest,
    regTree1D, regTree1DPredict, classStump, stumpPredict, regStump2D, regStumpPredict,
  };
})(typeof window !== 'undefined' ? window : globalThis);

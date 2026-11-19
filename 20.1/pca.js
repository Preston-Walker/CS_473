/* Small linear-algebra + PCA toolkit for the 20.1 companion page. Exposes window.PCA. */
(function () {
  'use strict';

  /* ---------- seeded random numbers ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  }

  /* ---------- basic statistics ---------- */
  function meanOf(X) {
    const D = X[0].length, m = new Array(D).fill(0);
    for (const x of X) for (let j = 0; j < D; j++) m[j] += x[j];
    return m.map((v) => v / X.length);
  }
  // Empirical covariance with 1/N (the maximum-likelihood estimate Murphy uses).
  function covOf(X, m) {
    m = m || meanOf(X);
    const D = m.length, S = Array.from({ length: D }, () => new Array(D).fill(0));
    for (const x of X) {
      for (let i = 0; i < D; i++) {
        const di = x[i] - m[i];
        for (let j = i; j < D; j++) S[i][j] += di * (x[j] - m[j]);
      }
    }
    for (let i = 0; i < D; i++) for (let j = i; j < D; j++) { S[i][j] /= X.length; S[j][i] = S[i][j]; }
    return S;
  }
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const matVec = (S, v) => S.map((row) => dot(row, v));

  /* ---------- 2x2 symmetric eigen-decomposition (closed form) ---------- */
  function eig2(S) {
    const a = S[0][0], b = S[0][1], c = S[1][1];
    const mid = (a + c) / 2, rad = Math.sqrt(((a - c) / 2) ** 2 + b * b);
    const theta = 0.5 * Math.atan2(2 * b, a - c); // angle of the top eigenvector
    const w1 = [Math.cos(theta), Math.sin(theta)], w2 = [-Math.sin(theta), Math.cos(theta)];
    return { values: [mid + rad, mid - rad], vectors: [w1, w2], theta };
  }

  /* ---------- cyclic Jacobi for small symmetric matrices ---------- */
  function jacobiEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice());
    const V = Array.from({ length: n }, (_, i) => { const r = new Array(n).fill(0); r[i] = 1; return r; });
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0, diag = 0;
      for (let p = 0; p < n; p++) { diag += A[p][p] * A[p][p]; for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q]; }
      if (off <= 1e-26 * Math.max(diag, 1e-300)) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = A[p][q];
          if (apq === 0) continue;
          const th = (A[q][q] - A[p][p]) / (2 * apq);
          const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < n; k++) { const x = A[k][p], y = A[k][q]; A[k][p] = c * x - s * y; A[k][q] = s * x + c * y; }
          for (let k = 0; k < n; k++) { const x = A[p][k], y = A[q][k]; A[p][k] = c * x - s * y; A[q][k] = s * x + c * y; }
          for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
        }
      }
    }
    const order = [...Array(n).keys()].sort((i, j) => A[j][j] - A[i][i]);
    const values = order.map((i) => A[i][i]);
    const vectors = order.map((i) => fixSign(V.map((row) => row[i])));
    return { values, vectors };
  }
  // Eigenvectors are only defined up to sign; pick the sign whose biggest entry is positive.
  function fixSign(v) {
    let k = 0;
    for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i;
    return v[k] < 0 ? v.map((x) => -x) : v;
  }

  /* ---------- top-k eigenvectors of a big covariance (subspace iteration + Rayleigh-Ritz) ---------- */
  // S: Float64Array, D*D row-major.  Returns k eigenpairs, largest first.
  function topEig(S, D, k, iters, seed) {
    const r = rng(seed || 7);
    let Q = Array.from({ length: k }, () => Float64Array.from({ length: D }, () => gauss(r)));
    const mul = (v) => {
      const out = new Float64Array(D);
      for (let i = 0; i < D; i++) { let s = 0; const o = i * D; for (let j = 0; j < D; j++) s += S[o + j] * v[j]; out[i] = s; }
      return out;
    };
    const orth = (cols) => {
      for (let a = 0; a < cols.length; a++) {
        const v = cols[a];
        for (let b = 0; b < a; b++) { const d = dot(v, cols[b]); for (let i = 0; i < D; i++) v[i] -= d * cols[b][i]; }
        const n = Math.sqrt(dot(v, v)) || 1;
        for (let i = 0; i < D; i++) v[i] /= n;
      }
      return cols;
    };
    orth(Q);
    for (let it = 0; it < iters; it++) Q = orth(Q.map(mul));
    const SQ = Q.map(mul);
    const T = Q.map((qi) => SQ.map((sqj) => dot(qi, sqj)));
    const e = jacobiEig(T);
    const vectors = e.vectors.map((c) => {
      const v = new Float64Array(D);
      for (let a = 0; a < k; a++) for (let i = 0; i < D; i++) v[i] += c[a] * Q[a][i];
      return fixSign(Array.from(v));
    });
    return { values: e.values, vectors };
  }

  /* ---------- correlated Gaussian sampler ---------- */
  function sample2(n, mean, sd, rho, seed) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      const a = gauss(r), b = gauss(r);
      out.push([mean[0] + sd[0] * a, mean[1] + sd[1] * (rho * a + Math.sqrt(1 - rho * rho) * b)]);
    }
    return out;
  }

  /* ---------- datasets (all synthetic, seeded) ---------- */
  // Iris-like petals: length and width in cm, strongly correlated.
  const petals = (n, seed) => sample2(n, [4.4, 1.4], [1.0, 0.5], 0.82, seed || 3);

  // Adults: height (cm) and weight (kg).
  function heightWeight(n, seed) {
    const r = rng(seed || 11), out = [];
    for (let i = 0; i < n; i++) {
      const h = 170 + 9 * gauss(r);
      out.push([h, -88 + 0.92 * h + 8.5 * gauss(r)]);
    }
    return out;
  }

  // Points in 3-D that mostly live on a tilted plane: three groups inside the plane, a little noise off it.
  function sheet3d(n, seed) {
    const r = rng(seed || 21);
    const u = norm([0.78, 0.42, 0.46]);
    let v = [-0.35, 0.86, -0.2];
    const d = dot(v, u); v = norm(v.map((x, i) => x - d * u[i]));
    const centres = [[-2.1, -0.6], [1.9, -1.0], [0.3, 1.6]];
    const X = [], g = [];
    for (let i = 0; i < n; i++) {
      const k = i % 3, a = centres[k][0] + 0.75 * gauss(r), b = centres[k][1] + 0.6 * gauss(r);
      X.push([0, 1, 2].map((j) => a * u[j] + b * v[j] + 0.28 * gauss(r)));
      g.push(k);
    }
    return { X, g };
  }
  function norm(v) { const n = Math.sqrt(dot(v, v)); return v.map((x) => x / n); }

  // Toy cartoon faces on a size x size grid. Each face is set by a handful of hidden knobs.
  function faces(n, size, seed) {
    const r = rng(seed || 5), out = [];
    const sig = (t) => 1 / (1 + Math.exp(-t));
    for (let k = 0; k < n; k++) {
      const p = {
        hw: 0.66 + 0.05 * gauss(r),            // head width
        hh: 0.84 + 0.05 * gauss(r),            // head height
        skin: 0.74 + 0.07 * gauss(r),          // overall brightness
        light: 0.28 * gauss(r),                // left/right lighting
        eyeY: -0.16 + 0.05 * gauss(r),         // eye height
        eyeX: 0.3 + 0.04 * gauss(r),           // eye spacing
        smile: 0.26 * gauss(r),                // mouth curvature (+ smile, - frown)
        hair: -0.5 + 0.12 * gauss(r),          // hairline
      };
      const img = new Float64Array(size * size), ss = 3;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let acc = 0;
          for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
            const u = -1 + (2 * (x + (sx + 0.5) / ss)) / size, v = -1 + (2 * (y + (sy + 0.5) / ss)) / size;
            const rr = Math.sqrt((u / p.hw) ** 2 + (v / p.hh) ** 2);
            const head = sig((1 - rr) / 0.05);
            let val = p.skin * (1 + p.light * u);
            const hairM = sig((p.hair - v) / 0.05) * sig((1.04 - rr) / 0.05);
            val = val * (1 - hairM) + 0.22 * hairM;
            const eye = Math.exp(-(((Math.abs(u) - p.eyeX) / 0.09) ** 2 + ((v - p.eyeY) / 0.075) ** 2));
            const mw = 0.3, my = 0.42 + p.smile * (1 - (u / mw) ** 2) - p.smile * 0.5;
            const mouth = Math.exp(-(((v - my) / 0.065) ** 2)) * sig((mw - Math.abs(u)) / 0.04);
            val -= 0.62 * eye + 0.7 * mouth;
            acc += 0.12 * (1 - head) + head * val;
          }
          img[y * size + x] = Math.min(1, Math.max(0, acc / (ss * ss) + 0.025 * gauss(r)));
        }
      }
      out.push(img);
    }
    return out;
  }

  // Covariance of image rows (Float64Arrays), returned as a flat D*D matrix, plus the mean.
  function imageCov(X) {
    const N = X.length, D = X[0].length, m = new Float64Array(D);
    for (const x of X) for (let i = 0; i < D; i++) m[i] += x[i] / N;
    const S = new Float64Array(D * D), c = new Float64Array(D);
    for (const x of X) {
      for (let i = 0; i < D; i++) c[i] = x[i] - m[i];
      for (let i = 0; i < D; i++) { const ci = c[i], o = i * D; for (let j = i; j < D; j++) S[o + j] += ci * c[j]; }
    }
    for (let i = 0; i < D; i++) for (let j = i; j < D; j++) { S[i * D + j] /= N; S[j * D + i] = S[i * D + j]; }
    let trace = 0;
    for (let i = 0; i < D; i++) trace += S[i * D + i];
    return { mean: m, S, trace };
  }

  window.PCA = { rng, gauss, meanOf, covOf, dot, matVec, eig2, jacobiEig, topEig, petals, heightWeight, sheet3d, faces, imageCov, fixSign };
})();

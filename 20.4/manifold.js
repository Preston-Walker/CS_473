/* Manifold-learning toolkit for the 20.4 companion page.
   Plain JavaScript, no dependencies. Exposes window.ML (or module.exports under Node).
   Matrices are row-major Float64Array of size N*N unless noted. */
(function (root) {
  'use strict';

  /* ================= random numbers ================= */
  function rng(seed) {
    let a = seed >>> 0;
    const f = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.normal = () => {
      let u = 0;
      while (u === 0) u = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * f());
    };
    return f;
  }

  /* ================= datasets ================= */
  // Arc length of the spiral (t cos t, t sin t) from 0 to t.
  const spiralArc = (t) => 0.5 * (t * Math.sqrt(1 + t * t) + Math.asinh(t));
  const T0 = 1.5 * Math.PI, T1 = 4.5 * Math.PI;

  // Swiss roll: a rolled-up sheet. truth = [arc length along the roll, height].
  function swissRoll(n, noise, seed) {
    const r = rng(seed || 1), X = [], truth = [], t = [];
    for (let i = 0; i < n; i++) {
      // sample uniformly by area so the outer turns are as dense as the inner ones
      const tt = Math.sqrt(T0 * T0 + (T1 * T1 - T0 * T0) * r()), h = 18 * r();
      X.push([tt * Math.cos(tt) + noise * r.normal(), h + noise * r.normal(), tt * Math.sin(tt) + noise * r.normal()]);
      truth.push([spiralArc(tt), h]);
      t.push((tt - T0) / (T1 - T0));
    }
    return { X, truth, color: t, name: 'swiss' };
  }

  // S-curve: a sheet bent into an S. truth = [position along the S, depth].
  function sCurve(n, noise, seed) {
    const r = rng(seed || 2), X = [], truth = [], color = [];
    for (let i = 0; i < n; i++) {
      const u = r(), tt = 3 * Math.PI * (u - 0.5), d = 4 * r();
      X.push([Math.sin(tt) * 5 + noise * r.normal(), d * 5 + noise * r.normal(), Math.sign(tt) * (Math.cos(tt) - 1) * 5 + noise * r.normal()]);
      truth.push([tt * 5, d * 5]);
      color.push(u);
    }
    return { X, truth, color, name: 'scurve' };
  }

  // Two concentric rings in 2-D (downtown core + ring of suburbs).
  function rings(n, noise, seed) {
    const r = rng(seed || 3), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const outer = i % 3 !== 0, a = 2 * Math.PI * r(), rad = outer ? 2.6 : 0.9;
      X.push([rad * Math.cos(a) + noise * r.normal(), rad * Math.sin(a) + noise * r.normal()]);
      y.push(outer ? 1 : 0);
    }
    return { X, y };
  }

  // A crumpled necklace: beads spaced evenly along a 2-D spiral.
  function necklace(n, spacing) {
    const X = [], color = [];
    let th = 1.2;
    const a = 0.35;
    for (let i = 0; i < n; i++) {
      const rr = a * th;
      X.push([rr * Math.cos(th), rr * Math.sin(th)]);
      color.push(i / (n - 1));
      th += spacing / Math.sqrt(rr * rr + a * a);
    }
    return { X, color };
  }

  /* ---- cities (latitude, longitude) ---- */
  const US_CITIES = [
    ['Seattle', 47.61, -122.33], ['San Francisco', 37.77, -122.42], ['Los Angeles', 34.05, -118.24],
    ['Phoenix', 33.45, -112.07], ['Provo', 40.23, -111.66], ['Denver', 39.74, -104.99],
    ['Dallas', 32.78, -96.8], ['Houston', 29.76, -95.37], ['Kansas City', 39.1, -94.58],
    ['Minneapolis', 44.98, -93.27], ['Chicago', 41.88, -87.63], ['New Orleans', 29.95, -90.07],
    ['Atlanta', 33.75, -84.39], ['Miami', 25.76, -80.19], ['New York', 40.71, -74.01], ['Boston', 42.36, -71.06],
  ];
  const WORLD_CITIES = [
    ['London', 51.51, -0.13], ['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24], ['Mexico City', 19.43, -99.13],
    ['São Paulo', -23.55, -46.63], ['Buenos Aires', -34.6, -58.38], ['Reykjavík', 64.15, -21.94], ['Lagos', 6.52, 3.38],
    ['Cairo', 30.04, 31.24], ['Cape Town', -33.92, 18.42], ['Moscow', 55.76, 37.62], ['Mumbai', 19.08, 72.88],
    ['Singapore', 1.35, 103.82], ['Beijing', 39.9, 116.41], ['Tokyo', 35.68, 139.69], ['Sydney', -33.87, 151.21],
    ['Honolulu', 21.31, -157.86], ['Anchorage', 61.22, -149.9],
  ];
  function greatCircleKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dlat = (b[1] - a[1]) * rad, dlon = (b[2] - a[2]) * rad;
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function cityDistances(list) {
    const N = list.length, D = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) D[i * N + j] = greatCircleKm(list[i], list[j]);
    return D;
  }

  /* ---- handwritten-style digits ---- */
  function arc(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  }
  const PI = Math.PI;
  // Each digit is a list of polylines in the unit square (x right, y down).
  const DIGIT_STROKES = [
    [arc(0.5, 0.5, 0.27, 0.38, 0, 2 * PI, 24)],
    [[[0.36, 0.26], [0.53, 0.12], [0.53, 0.88]]],
    [arc(0.5, 0.33, 0.24, 0.21, PI * 1.05, PI * 2.25, 12).concat([[0.24, 0.88], [0.78, 0.88]])],
    [arc(0.48, 0.3, 0.22, 0.18, PI * 1.1, PI * 2.5, 12), arc(0.48, 0.67, 0.25, 0.21, PI * 1.5, PI * 2.85, 12)],
    [[[0.64, 0.88], [0.64, 0.12], [0.22, 0.64], [0.8, 0.64]]],
    [[[0.74, 0.12], [0.34, 0.12], [0.3, 0.45]].concat(arc(0.48, 0.64, 0.26, 0.23, PI * 1.2, PI * 2.85, 14))],
    [arc(0.62, 0.55, 0.36, 0.43, PI * 1.45, PI * 0.95, 10).concat(arc(0.5, 0.66, 0.24, 0.2, PI, PI * 3, 16))],
    [[[0.22, 0.12], [0.78, 0.12], [0.42, 0.88]]],
    [arc(0.5, 0.3, 0.2, 0.18, 0, 2 * PI, 18), arc(0.5, 0.68, 0.25, 0.2, 0, 2 * PI, 18)],
    [arc(0.5, 0.34, 0.24, 0.2, 0, 2 * PI, 16).concat(arc(0.38, 0.45, 0.36, 0.43, 0, PI * 0.55, 10))],
  ];
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    let t = L ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - ax - t * vx, dy = py - ay - t * vy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  // Render a digit to a size×size image. opts: rot, scale, shear, dx, dy, width, jitter (array of strokes), noise, r.
  function renderDigit(d, size, opts) {
    const o = Object.assign({ rot: 0, scale: 1, shear: 0, dx: 0, dy: 0, width: 0.075, noise: 0 }, opts || {});
    const strokes = o.strokes || DIGIT_STROKES[d];
    const c = Math.cos(o.rot), s = Math.sin(o.rot), img = new Float64Array(size * size);
    for (let yy = 0; yy < size; yy++) {
      for (let xx = 0; xx < size; xx++) {
        // pixel centre -> template coordinates (inverse affine about the centre)
        let px = (xx + 0.5) / size - 0.5 - o.dx, py = (yy + 0.5) / size - 0.5 - o.dy;
        let qx = (c * px + s * py) / o.scale, qy = (-s * px + c * py) / o.scale;
        qx -= o.shear * qy;
        qx += 0.5; qy += 0.5;
        let best = 9;
        for (const st of strokes) for (let k = 0; k + 1 < st.length; k++) {
          const dd = segDist(qx, qy, st[k][0], st[k][1], st[k + 1][0], st[k + 1][1]);
          if (dd < best) best = dd;
        }
        const soft = 0.9 / size;
        let v = 1 - (best - o.width) / soft;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        if (o.noise && o.r) v = Math.min(1, Math.max(0, v + o.noise * o.r.normal()));
        img[yy * size + xx] = v;
      }
    }
    return img;
  }
  function digits(perClass, seed, size) {
    size = size || 16;
    const r = rng(seed || 7), X = [], y = [];
    for (let i = 0; i < perClass; i++) {
      for (let d = 0; d < 10; d++) {
        const jit = 0.035;
        const strokes = DIGIT_STROKES[d].map((st) => {
          const bx = jit * r.normal(), by = jit * r.normal();
          return st.map((p) => [p[0] + bx * 0.5 + jit * 0.5 * r.normal() * 0.4, p[1] + by * 0.5 + jit * 0.5 * r.normal() * 0.4]);
        });
        X.push(renderDigit(d, size, {
          strokes, rot: 0.2 * r.normal(), scale: 0.9 + 0.12 * r(), shear: 0.25 * r.normal(),
          dx: 0.04 * r.normal(), dy: 0.04 * r.normal(), width: 0.05 + 0.05 * r(), noise: 0.06, r,
        }));
        y.push(d);
      }
    }
    return { X, y, size };
  }

  /* ================= linear algebra ================= */
  function sqDist(X) {
    const N = X.length, D = X[0].length, out = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      const a = X[i];
      for (let j = i + 1; j < N; j++) {
        const b = X[j];
        let s = 0;
        for (let k = 0; k < D; k++) { const d = a[k] - b[k]; s += d * d; }
        out[i * N + j] = out[j * N + i] = s;
      }
    }
    return out;
  }

  // Jacobi eigen-decomposition of a small symmetric matrix (array of arrays). Sorted descending.
  function jacobi(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = [];
    for (let i = 0; i < n; i++) { V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const idx = [...Array(n).keys()].sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((row) => row[i])) };
  }

  // Lanczos with full re-orthogonalisation: top-k (algebraically largest) eigenpairs of a symmetric operator.
  function lanczosTop(matvec, N, k, m, seed) {
    m = Math.min(N, m || Math.max(60, 3 * k + 30));
    const r = rng(seed || 11), Q = [], alpha = [], beta = [];
    let q = new Float64Array(N);
    for (let i = 0; i < N; i++) q[i] = r() - 0.5;
    let nq = Math.hypot(...q); for (let i = 0; i < N; i++) q[i] /= nq;
    let bPrev = 0, qPrev = null;
    for (let j = 0; j < m; j++) {
      Q.push(q);
      const w = matvec(q);
      let a = 0; for (let i = 0; i < N; i++) a += w[i] * q[i];
      alpha.push(a);
      for (let i = 0; i < N; i++) w[i] -= a * q[i] + (qPrev ? bPrev * qPrev[i] : 0);
      for (let pass = 0; pass < 2; pass++) for (const v of Q) {
        let d = 0; for (let i = 0; i < N; i++) d += w[i] * v[i];
        for (let i = 0; i < N; i++) w[i] -= d * v[i];
      }
      let b = 0; for (let i = 0; i < N; i++) b += w[i] * w[i];
      b = Math.sqrt(b);
      if (j === m - 1) break;
      if (b < 1e-10) { // invariant subspace: restart with a fresh orthogonal vector
        for (let i = 0; i < N; i++) w[i] = r() - 0.5;
        for (const v of Q) { let d = 0; for (let i = 0; i < N; i++) d += w[i] * v[i]; for (let i = 0; i < N; i++) w[i] -= d * v[i]; }
        let nn = 0; for (let i = 0; i < N; i++) nn += w[i] * w[i];
        nn = Math.sqrt(nn); for (let i = 0; i < N; i++) w[i] /= nn;
        b = 0;
      } else for (let i = 0; i < N; i++) w[i] /= b;
      beta.push(b); qPrev = q; bPrev = b; q = w;
    }
    const M = Q.length, T = [];
    for (let i = 0; i < M; i++) { T.push(new Array(M).fill(0)); T[i][i] = alpha[i]; if (i > 0) { T[i][i - 1] = T[i - 1][i] = beta[i - 1]; } }
    const e = jacobi(T), values = [], vectors = [];
    for (let c = 0; c < k; c++) {
      const s = e.vectors[c], v = new Float64Array(N);
      for (let j = 0; j < M; j++) { const sj = s[j], qj = Q[j]; for (let i = 0; i < N; i++) v[i] += sj * qj[i]; }
      values.push(e.values[c]); vectors.push(v);
    }
    return { values, vectors };
  }
  const denseMatvec = (A, N) => (x) => {
    const y = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; const o = i * N; for (let j = 0; j < N; j++) s += A[o + j] * x[j]; y[i] = s; }
    return y;
  };
  function topEig(A, N, k) { return lanczosTop(denseMatvec(A, N), N, k); }

  // Cholesky factorisation (lower) in place of a copy; returns L or null if not PD.
  function cholesky(A, N) {
    const L = new Float64Array(A);
    for (let j = 0; j < N; j++) {
      let s = L[j * N + j];
      for (let k = 0; k < j; k++) s -= L[j * N + k] * L[j * N + k];
      if (s <= 0) return null;
      const d = Math.sqrt(s); L[j * N + j] = d;
      for (let i = j + 1; i < N; i++) {
        let t = L[i * N + j];
        const oi = i * N, oj = j * N;
        for (let k = 0; k < j; k++) t -= L[oi + k] * L[oj + k];
        L[oi + j] = t / d;
      }
    }
    return L;
  }
  function cholSolve(L, N, b) {
    const y = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = b[i]; const o = i * N; for (let k = 0; k < i; k++) s -= L[o + k] * y[k]; y[i] = s / L[o + i]; }
    for (let i = N - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < N; k++) s -= L[k * N + i] * y[k]; y[i] = s / L[i * N + i]; }
    return y;
  }
  // Smallest-k eigenpairs of a symmetric PSD matrix via shift-invert Lanczos.
  function bottomEig(A, N, k, sigma) {
    let tr = 0; for (let i = 0; i < N; i++) tr += A[i * N + i];
    sigma = sigma || Math.max(1e-9, 1e-6 * tr / N);
    let L = null;
    for (let tries = 0; tries < 8 && !L; tries++) {
      const B = new Float64Array(A);
      for (let i = 0; i < N; i++) B[i * N + i] += sigma;
      L = cholesky(B, N);
      if (!L) sigma *= 10;
    }
    const e = lanczosTop((x) => cholSolve(L, N, x), N, k);
    return { values: e.values.map((mu) => 1 / mu - sigma), vectors: e.vectors };
  }

  /* ================= neighbourhood graphs ================= */
  function knn(D2, N, k) {
    const nb = [];
    for (let i = 0; i < N; i++) {
      const idx = [];
      for (let j = 0; j < N; j++) if (j !== i) idx.push(j);
      idx.sort((a, b) => D2[i * N + a] - D2[i * N + b]);
      nb.push(idx.slice(0, k));
    }
    return nb;
  }
  // Symmetric adjacency list {j, w=distance} from a kNN list.
  function symGraph(nb, D2, N) {
    const adj = Array.from({ length: N }, () => new Map());
    for (let i = 0; i < N; i++) for (const j of nb[i]) {
      const d = Math.sqrt(D2[i * N + j]);
      adj[i].set(j, d); adj[j].set(i, d);
    }
    return adj.map((m) => [...m.entries()].map(([j, w]) => ({ j, w })));
  }
  function components(adj) {
    const N = adj.length, comp = new Int32Array(N).fill(-1);
    let c = 0;
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue;
      const st = [s]; comp[s] = c;
      while (st.length) { const u = st.pop(); for (const e of adj[u]) if (comp[e.j] < 0) { comp[e.j] = c; st.push(e.j); } }
      c++;
    }
    return { comp, count: c };
  }
  // Dijkstra from one source; returns distances and predecessor array.
  function dijkstra(adj, s) {
    const N = adj.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = [], push = (d, v) => {
      heap.push([d, v]); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    }, pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    dist[s] = 0; push(0, s);
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      for (const e of adj[u]) { const nd = d + e.w; if (nd < dist[e.j]) { dist[e.j] = nd; prev[e.j] = u; push(nd, e.j); } }
    }
    return { dist, prev };
  }
  function geodesics(adj) {
    const N = adj.length, G = new Float64Array(N * N);
    let maxFinite = 0, disconnected = false;
    for (let s = 0; s < N; s++) {
      const { dist } = dijkstra(adj, s);
      for (let j = 0; j < N; j++) { G[s * N + j] = dist[j]; if (isFinite(dist[j])) maxFinite = Math.max(maxFinite, dist[j]); else disconnected = true; }
    }
    if (disconnected) for (let i = 0; i < N * N; i++) if (!isFinite(G[i])) G[i] = maxFinite * 1.5;
    return { G, disconnected };
  }

  /* ================= embeddings ================= */
  // Double centring: B = -1/2 J D2 J.
  function doubleCenter(D2, N) {
    const rm = new Float64Array(N); let all = 0;
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += D2[i * N + j]; rm[i] = s / N; all += s; }
    all /= N * N;
    const B = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i * N + j] = -0.5 * (D2[i * N + j] - rm[i] - rm[j] + all);
    return B;
  }
  const toRows = (vecs, vals, N, L) => {
    const Y = [];
    for (let i = 0; i < N; i++) { const r = []; for (let c = 0; c < L; c++) r.push(vecs[c][i] * Math.sqrt(Math.max(0, vals[c]))); Y.push(r); }
    return Y;
  };
  function classicalMDS(D2, N, L, extra) {
    const B = doubleCenter(D2, N);
    const e = topEig(B, N, Math.max(L, extra || L));
    return { Y: toRows(e.vectors, e.values, N, L), values: e.values, B };
  }
  // All eigenvalues of a small symmetric matrix (for the city demo where N is tiny).
  function smallEig(A, N) {
    const rows = []; for (let i = 0; i < N; i++) rows.push(Array.from(A.subarray(i * N, i * N + N)));
    return jacobi(rows);
  }
  function stress(Y, D, N) { // Kruskal stress-1 against target distances D (not squared)
    let num = 0, den = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const d = Math.hypot(Y[i][0] - Y[j][0], Y[i][1] - Y[j][1]), t = D[i * N + j];
      num += (d - t) ** 2; den += t * t;
    }
    return Math.sqrt(num / den);
  }
  // One SMACOF (Guttman transform) step for metric MDS with unit weights.
  function smacofStep(Y, D, N) {
    const out = Y.map(() => [0, 0]);
    for (let i = 0; i < N; i++) {
      let bx = 0, by = 0, bii = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const d = Math.hypot(Y[i][0] - Y[j][0], Y[i][1] - Y[j][1]);
        const b = d > 1e-12 ? -D[i * N + j] / d : 0;
        bii -= b; bx += b * Y[j][0]; by += b * Y[j][1];
      }
      out[i][0] = (bx + bii * Y[i][0]) / N; out[i][1] = (by + bii * Y[i][1]) / N;
    }
    return out;
  }
  // One gradient step on the Sammon stress (weights 1/d_ij), with a diagonal Newton-style step.
  function sammonStep(Y, D, N, lr) {
    let c = 0; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) c += D[i * N + j];
    const out = Y.map((y) => y.slice());
    for (let i = 0; i < N; i++) {
      let g0 = 0, g1 = 0, h0 = 0, h1 = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const t = Math.max(D[i * N + j], 1e-9), dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
        const d = Math.max(Math.hypot(dx, dy), 1e-9), q = (t - d) / (t * d);
        g0 += q * dx; g1 += q * dy;
        const h = (1 / (t * d)) * ((t - d) - ((dx * dx) / d) * (1 + (t - d) / d));
        const h2 = (1 / (t * d)) * ((t - d) - ((dy * dy) / d) * (1 + (t - d) / d));
        h0 += h; h1 += h2;
      }
      out[i][0] = Y[i][0] + (lr || 0.3) * g0 / Math.max(Math.abs(h0), 1e-9);
      out[i][1] = Y[i][1] + (lr || 0.3) * g1 / Math.max(Math.abs(h1), 1e-9);
    }
    return out;
  }
  function sammonStress(Y, D, N) {
    let c = 0, s = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const t = D[i * N + j]; if (t <= 0) continue;
      const d = Math.hypot(Y[i][0] - Y[j][0], Y[i][1] - Y[j][1]);
      c += t; s += (t - d) ** 2 / t;
    }
    return s / c;
  }

  function pca(X, L) {
    const N = X.length, D = X[0].length, mu = new Float64Array(D);
    for (const x of X) for (let k = 0; k < D; k++) mu[k] += x[k] / N;
    // Gram-matrix route (N may be smaller than D for images).
    if (D > N) {
      const G = new Float64Array(N * N);
      for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
        let s = 0; for (let k = 0; k < D; k++) s += (X[i][k] - mu[k]) * (X[j][k] - mu[k]);
        G[i * N + j] = G[j * N + i] = s;
      }
      const e = topEig(G, N, L);
      return { Y: toRows(e.vectors, e.values, N, L), values: e.values.map((v) => v / N) };
    }
    const S = [];
    for (let a = 0; a < D; a++) { S.push(new Array(D).fill(0)); }
    for (const x of X) for (let a = 0; a < D; a++) for (let b = a; b < D; b++) S[a][b] += (x[a] - mu[a]) * (x[b] - mu[b]) / N;
    for (let a = 0; a < D; a++) for (let b = 0; b < a; b++) S[a][b] = S[b][a];
    const e = jacobi(S);
    const Y = X.map((x) => { const r = []; for (let c = 0; c < L; c++) { let s = 0; for (let k = 0; k < D; k++) s += (x[k] - mu[k]) * e.vectors[c][k]; r.push(s); } return r; });
    return { Y, values: e.values };
  }

  function isomap(X, k, L, D2in) {
    const N = X.length, D2 = D2in || sqDist(X), nb = knn(D2, N, k), adj = symGraph(nb, D2, N);
    const { G, disconnected } = geodesics(adj);
    const G2 = new Float64Array(N * N); for (let i = 0; i < N * N; i++) G2[i] = G[i] * G[i];
    const m = classicalMDS(G2, N, L);
    return { Y: m.Y, G, adj, nb, disconnected, components: components(adj).count };
  }

  // Kernel PCA. kernel: 'linear' | 'rbf' | 'poly'
  function kernelPCA(X, kernel, param, L, D2in) {
    const N = X.length, K = new Float64Array(N * N);
    const D2 = kernel === 'rbf' ? (D2in || sqDist(X)) : null;
    for (let i = 0; i < N; i++) for (let j = i; j < N; j++) {
      let v;
      if (kernel === 'rbf') v = Math.exp(-param * D2[i * N + j]);
      else {
        let s = 0; for (let k = 0; k < X[i].length; k++) s += X[i][k] * X[j][k];
        v = kernel === 'poly' ? Math.pow(1 + s, param) : s;
      }
      K[i * N + j] = K[j * N + i] = v;
    }
    // centre in feature space: Kc = J K J  (same as double centring of -2K)
    const rm = new Float64Array(N); let all = 0;
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += K[i * N + j]; rm[i] = s / N; all += s; }
    all /= N * N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) K[i * N + j] = K[i * N + j] - rm[i] - rm[j] + all;
    let trace = 0; for (let i = 0; i < N; i++) trace += K[i * N + i];
    const e = topEig(K, N, L);
    return { Y: toRows(e.vectors, e.values, N, L), values: e.values, trace };
  }

  // Locally linear embedding.
  function lleWeights(X, nb, reg) {
    const N = X.length, D = X[0].length, W = [];
    for (let i = 0; i < N; i++) {
      const k = nb[i].length, Z = nb[i].map((j) => X[j].map((v, d) => v - X[i][d]));
      const C = [];
      for (let a = 0; a < k; a++) { C.push(new Array(k).fill(0)); for (let b = 0; b < k; b++) { let s = 0; for (let d = 0; d < D; d++) s += Z[a][d] * Z[b][d]; C[a][b] = s; } }
      let tr = 0; for (let a = 0; a < k; a++) tr += C[a][a];
      for (let a = 0; a < k; a++) C[a][a] += reg * (tr > 0 ? tr : 1);
      // solve C w = 1 by Gaussian elimination with partial pivoting
      const A = C.map((r) => r.concat([1]));
      for (let c = 0; c < k; c++) {
        let p = c; for (let rI = c + 1; rI < k; rI++) if (Math.abs(A[rI][c]) > Math.abs(A[p][c])) p = rI;
        [A[c], A[p]] = [A[p], A[c]];
        for (let rI = c + 1; rI < k; rI++) { const f = A[rI][c] / A[c][c]; for (let cc = c; cc <= k; cc++) A[rI][cc] -= f * A[c][cc]; }
      }
      const w = new Array(k).fill(0);
      for (let rI = k - 1; rI >= 0; rI--) { let s = A[rI][k]; for (let cc = rI + 1; cc < k; cc++) s -= A[rI][cc] * w[cc]; w[rI] = s / A[rI][rI]; }
      const sum = w.reduce((a, b) => a + b, 0);
      W.push(w.map((v) => v / sum));
    }
    return W;
  }
  function lle(X, k, L, reg, D2in) {
    const N = X.length, D2 = D2in || sqDist(X), nb = knn(D2, N, k), W = lleWeights(X, nb, reg == null ? 1e-3 : reg);
    const M = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      M[i * N + i] += 1;
      nb[i].forEach((j, a) => {
        M[i * N + j] -= W[i][a]; M[j * N + i] -= W[i][a];
        nb[i].forEach((l, b) => { M[j * N + l] += W[i][a] * W[i][b]; });
      });
    }
    const e = bottomEig(M, N, L + 1);
    // e.vectors are sorted by descending 1/(λ+σ), i.e. ascending λ. Skip the constant one.
    const Y = [];
    for (let i = 0; i < N; i++) { const r = []; for (let c = 1; c <= L; c++) r.push(e.vectors[c][i] * Math.sqrt(N)); Y.push(r); }
    return { Y, W, nb, values: e.values };
  }

  // Laplacian eigenmaps with heat-kernel weights. t = kernel width as a multiple of the median edge length² (Infinity → 0/1 weights).
  function laplacianEigenmaps(X, k, L, t, D2in, extra) {
    const N = X.length, D2 = D2in || sqDist(X), nb = knn(D2, N, k);
    const Wm = new Float64Array(N * N);
    const edges = []; for (let i = 0; i < N; i++) for (const j of nb[i]) edges.push(D2[i * N + j]);
    edges.sort((a, b) => a - b);
    const med = edges[edges.length >> 1] || 1;
    for (let i = 0; i < N; i++) for (const j of nb[i]) {
      const w = isFinite(t) ? Math.exp(-D2[i * N + j] / (t * med)) : 1;
      Wm[i * N + j] = Wm[j * N + i] = w;
    }
    const deg = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += Wm[i * N + j]; deg[i] = s; }
    const Ls = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const v = Wm[i * N + j] / Math.sqrt(deg[i] * deg[j] || 1);
      Ls[i * N + j] = (i === j ? 1 : 0) - v;
    }
    const nv = Math.max(L, extra || 0) + 1;
    const e = bottomEig(Ls, N, nv, 1e-6);
    const vecs = e.vectors.map((u) => u.map((v, i) => v / Math.sqrt(deg[i] || 1)));
    // scale each to unit RMS for display
    for (const v of vecs) { let s = 0; for (const a of v) s += a * a; s = Math.sqrt(s / N) || 1; for (let i = 0; i < N; i++) v[i] /= s; }
    const Y = [];
    for (let i = 0; i < N; i++) { const r = []; for (let c = 1; c <= L; c++) r.push(vecs[c][i]); Y.push(r); }
    return { Y, vectors: vecs, values: e.values, nb, Wm };
  }

  /* ================= t-SNE ================= */
  // Conditional probabilities with per-point bandwidth chosen by binary search on perplexity.
  function tsneP(D2, N, perplexity) {
    const P = new Float64Array(N * N), target = Math.log(perplexity), sig = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let beta = 1, lo = -Infinity, hi = Infinity;
      // scale-aware initial beta
      let mean = 0; for (let j = 0; j < N; j++) mean += D2[i * N + j]; mean /= N;
      beta = 1 / (mean || 1);
      const row = new Float64Array(N);
      for (let it = 0; it < 60; it++) {
        let sum = 0, H = 0;
        let mn = Infinity; for (let j = 0; j < N; j++) if (j !== i && D2[i * N + j] < mn) mn = D2[i * N + j];
        for (let j = 0; j < N; j++) { const v = j === i ? 0 : Math.exp(-beta * (D2[i * N + j] - mn)); row[j] = v; sum += v; }
        for (let j = 0; j < N; j++) { const p = row[j] / sum; if (p > 1e-12) H -= p * Math.log(p); }
        if (Math.abs(H - target) < 1e-5) break;
        if (H > target) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; }
        else { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
      }
      let sum = 0; for (let j = 0; j < N; j++) sum += row[j];
      for (let j = 0; j < N; j++) P[i * N + j] = row[j] / sum;
      sig[i] = Math.sqrt(1 / (2 * beta));
    }
    const S = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) S[i * N + j] = Math.max((P[i * N + j] + P[j * N + i]) / (2 * N), 1e-100);
    return { P: S, sigma: sig };
  }
  class TSNE {
    constructor(D2, N, opts) {
      this.N = N; this.o = Object.assign({ perplexity: 30, kernel: 't', seed: 1, exaggeration: 4, exagIters: 100, lr: null }, opts);
      this.P = tsneP(D2, N, Math.min(this.o.perplexity, (N - 1) / 3)).P;
      const r = rng(this.o.seed);
      this.Y = []; for (let i = 0; i < N; i++) this.Y.push([1e-2 * r.normal(), 1e-2 * r.normal()]);
      this.V = this.Y.map(() => [0, 0]); this.gains = this.Y.map(() => [1, 1]);
      this.iter = 0; this.kl = NaN;
      this.lr = this.o.lr || Math.max(10, N / 12);
      if (this.o.kernel === 'gauss') this.lr *= 0.25;
    }
    step() {
      const N = this.N, Y = this.Y, P = this.P, t = this.o.kernel === 't';
      const ex = this.iter < this.o.exagIters ? this.o.exaggeration : 1;
      const Q = new Float64Array(N * N); let Z = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1], d2 = dx * dx + dy * dy;
        const q = t ? 1 / (1 + d2) : Math.exp(-d2);
        Q[i * N + j] = Q[j * N + i] = q; Z += 2 * q;
      }
      let kl = 0;
      const mom = this.iter < 250 ? 0.5 : 0.8;
      let mx = 0, my = 0;
      for (let i = 0; i < N; i++) {
        let gx = 0, gy = 0;
        for (let j = 0; j < N; j++) {
          if (j === i) continue;
          const q = Q[i * N + j], qn = Math.max(q / Z, 1e-100), p = P[i * N + j];
          if (i < j && this.iter % 10 === 0) kl += 2 * p * Math.log(p / qn);
          const m = t ? 4 * (ex * p - qn) * q : 4 * (ex * p - qn);
          gx += m * (Y[i][0] - Y[j][0]); gy += m * (Y[i][1] - Y[j][1]);
        }
        const g = [gx, gy];
        for (let d = 0; d < 2; d++) {
          const sameSign = Math.sign(g[d]) === Math.sign(this.V[i][d]);
          this.gains[i][d] = Math.max(0.01, sameSign ? this.gains[i][d] * 0.8 : this.gains[i][d] + 0.2);
          this.V[i][d] = mom * this.V[i][d] - this.lr * this.gains[i][d] * g[d];
        }
      }
      for (let i = 0; i < N; i++) { Y[i][0] += this.V[i][0]; Y[i][1] += this.V[i][1]; mx += Y[i][0]; my += Y[i][1]; }
      mx /= N; my /= N;
      for (let i = 0; i < N; i++) { Y[i][0] -= mx; Y[i][1] -= my; }
      if (this.iter % 10 === 0) this.kl = kl;
      this.iter++;
    }
  }

  /* ================= MVU-style unfolding (illustrative physics, not the SDP) ================= */
  // Keeps every link at its rest length while pushing all points away from the centroid.
  class Unfolder {
    constructor(X, links) {
      this.X = X.map((p) => p.slice()); this.links = links;
      this.rest = links.map(([a, b]) => Math.hypot(...X[a].map((v, d) => v - X[b][d])));
      this.iter = 0;
    }
    step(push) {
      const X = this.X, N = X.length, D = X[0].length, mu = new Array(D).fill(0);
      for (const p of X) for (let d = 0; d < D; d++) mu[d] += p[d] / N;
      for (const p of X) for (let d = 0; d < D; d++) p[d] += push * (p[d] - mu[d]);
      for (let pass = 0; pass < (this.links.length ? 60 : 0); pass++) {
        this.links.forEach(([a, b], e) => {
          const pa = X[a], pb = X[b]; let L = 0;
          for (let d = 0; d < D; d++) L += (pa[d] - pb[d]) ** 2;
          L = Math.sqrt(L) || 1e-9;
          const f = (L - this.rest[e]) / L / 2;
          for (let d = 0; d < D; d++) { const c = f * (pa[d] - pb[d]); pa[d] -= c; pb[d] += c; }
        });
      }
      this.iter++;
    }
    spread() {
      const X = this.X, N = X.length, D = X[0].length, mu = new Array(D).fill(0);
      for (const p of X) for (let d = 0; d < D; d++) mu[d] += p[d] / N;
      let s = 0; for (const p of X) for (let d = 0; d < D; d++) s += (p[d] - mu[d]) ** 2;
      return s / N;
    }
    maxViolation() {
      let m = 0;
      this.links.forEach(([a, b], e) => { const L = Math.hypot(...this.X[a].map((v, d) => v - this.X[b][d])); m = Math.max(m, Math.abs(L - this.rest[e]) / this.rest[e]); });
      return m;
    }
  }

  /* ================= helpers ================= */
  // Align 2-D embedding Y to reference R by translation, uniform scale, rotation or reflection.
  function procrustes(Y, R) {
    const N = Y.length; let ym = [0, 0], rm = [0, 0];
    for (let i = 0; i < N; i++) { ym[0] += Y[i][0] / N; ym[1] += Y[i][1] / N; rm[0] += R[i][0] / N; rm[1] += R[i][1] / N; }
    let m11 = 0, m12 = 0, m21 = 0, m22 = 0, yy = 0;
    for (let i = 0; i < N; i++) {
      const a0 = Y[i][0] - ym[0], a1 = Y[i][1] - ym[1], b0 = R[i][0] - rm[0], b1 = R[i][1] - rm[1];
      m11 += a0 * b0; m12 += a0 * b1; m21 += a1 * b0; m22 += a1 * b1; yy += a0 * a0 + a1 * a1;
    }
    const tr = Math.atan2(m21 - m12, m11 + m22), vr = Math.hypot(m21 - m12, m11 + m22);
    const tf = Math.atan2(m21 + m12, m11 - m22), vf = Math.hypot(m21 + m12, m11 - m22);
    let Q;
    if (vr >= vf) { const c = Math.cos(tr), s = Math.sin(tr); Q = [[c, -s], [s, c]]; }
    else { const c = Math.cos(tf), s = Math.sin(tf); Q = [[c, s], [s, -c]]; }
    // Y_aligned = s * (Y - ym) Q + rm  with row vectors; Q chosen to maximise tr(Q^T M) where M = Yc^T Rc
    const sc = Math.max(vr, vf) / (yy || 1);
    return Y.map((p) => {
      const a0 = p[0] - ym[0], a1 = p[1] - ym[1];
      return [sc * (a0 * Q[0][0] + a1 * Q[1][0]) + rm[0], sc * (a0 * Q[0][1] + a1 * Q[1][1]) + rm[1]];
    });
  }
  // Fraction of each point's k nearest neighbours (in X space via D2) that remain among its k nearest in Y.
  function trustworthiness(D2, Y, k) {
    const N = Y.length, nbX = knn(D2, N, k), DY = sqDist(Y), nbY = knn(DY, N, k);
    let hit = 0;
    for (let i = 0; i < N; i++) { const s = new Set(nbY[i]); for (const j of nbX[i]) if (s.has(j)) hit++; }
    return hit / (N * k);
  }

  const ML = {
    rng, swissRoll, sCurve, rings, necklace, spiralArc, T0, T1,
    US_CITIES, WORLD_CITIES, cityDistances, DIGIT_STROKES, renderDigit, digits,
    sqDist, jacobi, lanczosTop, topEig, bottomEig, cholesky, smallEig,
    knn, symGraph, components, dijkstra, geodesics,
    doubleCenter, classicalMDS, stress, smacofStep, sammonStep, sammonStress,
    pca, isomap, kernelPCA, lle, lleWeights, laplacianEigenmaps, tsneP, TSNE, Unfolder,
    procrustes, trustworthiness,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ML; else root.ML = ML;
})(typeof window !== 'undefined' ? window : globalThis);

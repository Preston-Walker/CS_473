'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fmt = (x, n = 3) => Number(x).toFixed(n);
  const mean = rows => rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const cafe = [1, 1, 1, 0, 0, 1, 0, 0].map((y, i) => ({wait: i + 1, party: i % 3 + 1, y, id: i + 1}));
  const bikes = [12, 18, 20, 22, 44, 46, 50, 52].map((y, i) => ({temp: 10 + 2 * i, y}));
  const classFeatures = ['wait', 'party'];
  const names = {wait: 'Wait', party: 'Party', temp: 'Temperature'};
  function cost(rows, metric = 'gini') {
    if (!rows.length) return 0;
    const p = mean(rows);
    if (metric === 'mse') return rows.reduce((s, r) => s + (r.y - p) ** 2, 0) / rows.length;
    if (metric === 'entropy') return [p, 1 - p].reduce((s, v) => s - (v ? v * Math.log2(v) : 0), 0);
    return 2 * p * (1 - p);
  }
  function candidates(rows, features, metric = 'gini', minLeaf = 1) {
    const out = [];
    for (const feature of features) {
      const values = [...new Set(rows.map(r => r[feature]))].sort((a, b) => a - b);
      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2;
        const left = rows.filter(r => r[feature] <= threshold);
        const right = rows.filter(r => r[feature] > threshold);
        if (left.length < minLeaf || right.length < minLeaf) continue;
        const score = (left.length * cost(left, metric) + right.length * cost(right, metric)) / rows.length;
        out.push({feature, threshold, left, right, score});
      }
    }
    return out;
  }
  function bestSplit(rows, features, metric) {
    return candidates(rows, features, metric).reduce((best, s) => !best || s.score < best.score - 1e-10 ? s : best, null);
  }
  function fitTree(rows, features, metric, maxDepth, depth = 0) {
    const node = {rows, value: mean(rows), depth};
    if (depth >= maxDepth || cost(rows, metric) < 1e-10) return node;
    const split = bestSplit(rows, features, metric);
    if (!split || cost(rows, metric) - split.score <= 1e-10) return node;
    node.feature = split.feature; node.threshold = split.threshold;
    node.left = fitTree(split.left, features, metric, maxDepth, depth + 1);
    node.right = fitTree(split.right, features, metric, maxDepth, depth + 1);
    return node;
  }
  function predict(tree, row) {
    return tree.left ? predict(row[tree.feature] <= tree.threshold ? tree.left : tree.right, row) : tree.value;
  }
  const countLeaves = t => t.left ? countLeaves(t.left) + countLeaves(t.right) : 1;
  const text = (x, y, s, opts = '') => `<text x="${x}" y="${y}" fill="#667165" font-size="11" ${opts}>${s}</text>`;
  const line = (x1, y1, x2, y2, color = '#d7dccc', extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
  const circle = (x, y, r, color, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${extra}/>`;
  function axes({w, h, xmin, xmax, ymin, ymax, xticks, yticks, xlabel, ylabel}) {
    const m = {left: 57, right: 24, top: 29, bottom: 46};
    const x = v => m.left + (v - xmin) / (xmax - xmin) * (w - m.left - m.right);
    const y = v => h - m.bottom - (v - ymin) / (ymax - ymin) * (h - m.top - m.bottom);
    let svg = '';
    for (const v of yticks) svg += line(m.left, y(v), w - m.right, y(v), '#e8ebdf') + text(m.left - 9, y(v) + 4, v, 'text-anchor="end"');
    for (const v of xticks) svg += text(x(v), h - m.bottom + 20, v, 'text-anchor="middle"');
    svg += text((m.left + w - m.right) / 2, h - 5, xlabel, 'text-anchor="middle"');
    svg += text(m.left, 15, ylabel);
    return {svg, x, y, m};
  }
  function path(points, color, width = 2, dash = '') {
    return `<path d="${points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  }
  function symbols(rows) {
    return rows.map(r => `<span class="${r.y ? 'buyer' : 'nonbuyer'}">${r.y ? '●' : '×'}</span>`).join('');
  }
  $('cafe-data').querySelector('tbody').innerHTML = cafe.map(r => `<tr><td>${String(r.id).padStart(2, '0')}</td><td>${r.wait}</td><td>${r.party}</td><td class="${r.y ? 'buyer' : 'nonbuyer'}">${r.y ? '● Yes' : '× No'}</td></tr>`).join('');

  function renderRegions() {
    const t = +$('region-threshold').value;
    $('region-value').value = t;
    const a = axes({w: 620, h: 260, xmin: 0, xmax: 9, ymin: .5, ymax: 3.5, xticks: [0, 3.5, 6, 9], yticks: [1, 2, 3], xlabel: 'Wait (minutes)', ylabel: 'Party size'});
    const {x, y} = a;
    let s = `<rect x="${x(0)}" y="${y(3.5)}" width="${x(3.5) - x(0)}" height="${y(.5) - y(3.5)}" fill="#dce8d6"/><rect x="${x(3.5)}" y="${y(t)}" width="${x(9) - x(3.5)}" height="${y(.5) - y(t)}" fill="#f0e0d2"/><rect x="${x(3.5)}" y="${y(3.5)}" width="${x(9) - x(3.5)}" height="${y(t) - y(3.5)}" fill="#e3e7d5"/>`;
    s += a.svg + line(x(3.5), y(.5), x(3.5), y(3.5), '#244e40', 'stroke-width="2"') + line(x(3.5), y(t), x(9), y(t), '#ae592e', 'stroke-width="2"');
    s += text(x(1.6), y(2), 'R₁', 'text-anchor="middle"') + text(x(6.3), (y(t) + y(.5)) / 2, 'R₂', 'text-anchor="middle"') + text(x(6.3), (y(3.5) + y(t)) / 2, 'R₃', 'text-anchor="middle"');
    $('regions').innerHTML = s;
  }
  $('region-threshold').addEventListener('input', renderRegions); renderRegions();

  function renderClassification() {
    const metric = $('class-cost').value, feature = $('class-feature').value;
    const all = candidates(cafe, classFeatures, metric), available = all.filter(s => s.feature === feature);
    $('class-threshold').max = available.length - 1;
    const idx = Math.min(+$('class-threshold').value, available.length - 1);
    $('class-threshold').value = idx;
    const selected = available[idx], best = bestSplit(cafe, classFeatures, metric);
    $('class-threshold-value').value = selected.threshold;
    const max = feature === 'wait' ? 9 : 3.6, x = v => 45 + v / max * 760;
    let s = `<rect x="45" y="20" width="${x(selected.threshold) - 45}" height="105" rx="5" fill="#edf2e5"/><rect x="${x(selected.threshold)}" y="20" width="${805 - x(selected.threshold)}" height="105" rx="5" fill="#f4e9de"/>`;
    s += line(x(selected.threshold), 16, x(selected.threshold), 128, '#244e40', 'stroke-width="2" stroke-dasharray="5 4"');
    const groups = {};
    cafe.forEach(r => { const n = groups[r[feature]] || 0; groups[r[feature]] = n + 1; const yy = feature === 'party' ? 44 + 27 * n : 77;
      s += r.y ? circle(x(r[feature]), yy, 9, '#244e40') : `<path d="M${x(r[feature]) - 6} ${yy - 6}l12 12m0 -12l-12 12" stroke="#ae592e" stroke-width="3"/>`;
      s += text(x(r[feature]) + (feature === 'party' ? 17 : 0), feature === 'party' ? yy + 4 : 107, r.id, 'text-anchor="middle"');
    });
    for (const v of feature === 'wait' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3]) s += text(x(v), 147, v, 'text-anchor="middle"');
    s += text(425, 174, feature === 'wait' ? 'Wait time (minutes) · small labels identify training visits' : 'Party size (people) · stacked marks are individual visits', 'text-anchor="middle"');
    $('class-plot').innerHTML = s;
    for (const [side, rows] of [['left', selected.left], ['right', selected.right]]) {
      const p = mean(rows), label = metric === 'gini' ? 'Gini' : 'Entropy';
      const calculation = metric === 'gini' ? `1 − (${fmt(p, 2)})² − (${fmt(1 - p, 2)})²` : `−[${fmt(p, 2)} log₂ ${fmt(p, 2)} + ${fmt(1 - p, 2)} log₂ ${fmt(1 - p, 2)}]`;
      $('class-' + side).innerHTML = `<h4>${side === 'left' ? 'LEFT · ≤' : 'RIGHT · >'} ${selected.threshold}</h4><div class="symbols">${symbols(rows)}</div><p>${rows.length} visits · ${rows.filter(r => r.y).length} yes / ${rows.filter(r => !r.y).length} no</p><p>p̂(yes) = ${rows.filter(r => r.y).length}/${rows.length} = ${fmt(p, 2)}</p><p>${label} = ${fmt(cost(rows, metric))}</p><p class="caption">${calculation}${metric === 'entropy' ? '; 0 log 0 = 0' : ''}</p>`;
    }
    const isBest = Math.abs(selected.score - best.score) < 1e-9;
    $('class-score').innerHTML = `<div class="math">Q = (${selected.left.length}/8) × ${fmt(cost(selected.left, metric))} + (${selected.right.length}/8) × ${fmt(cost(selected.right, metric))} = <strong>${fmt(selected.score)}</strong></div><p>Parent cost ${fmt(cost(cafe, metric))} − split cost ${fmt(selected.score)} = <strong>${fmt(cost(cafe, metric) - selected.score)} gain</strong>. ${isBest ? 'This is a best-scoring split.' : `Best available: ${names[best.feature].toLowerCase()} ≤ ${best.threshold}, with Q = ${fmt(best.score)}.`}</p>`;
    const maxScore = Math.max(...all.map(a => a.score), .01);
    $('candidate-scores').innerHTML = all.map(a => `<button class="candidate ${a === selected ? 'selected' : ''} ${Math.abs(a.score - best.score) < 1e-9 ? 'best' : ''}" data-feature="${a.feature}" data-threshold="${a.threshold}" aria-label="Try ${names[a.feature]} at most ${a.threshold}, cost ${fmt(a.score)}" aria-pressed="${a === selected}"><span>${names[a.feature]} ≤ ${a.threshold}${Math.abs(a.score - best.score) < 1e-9 ? ' ★' : ''}</span><span class="bar-track"><span class="bar" style="display:block;width:${a.score / maxScore * 100}%"></span></span><span>${fmt(a.score)}</span></button>`).join('');
  }
  function selectCandidate(feature, threshold) {
    $('class-feature').value = feature;
    const options = candidates(cafe, [feature], $('class-cost').value);
    $('class-threshold').max = options.length - 1;
    $('class-threshold').value = options.findIndex(a => a.threshold === threshold);
    renderClassification();
  }
  ['class-feature', 'class-cost'].forEach(id => $(id).addEventListener('change', renderClassification));
  $('class-threshold').addEventListener('input', renderClassification);
  $('best-split').addEventListener('click', () => { const best = bestSplit(cafe, classFeatures, $('class-cost').value); selectCandidate(best.feature, best.threshold); });
  $('candidate-scores').addEventListener('click', e => { const b = e.target.closest('button'); if (b) selectCandidate(b.dataset.feature, +b.dataset.threshold); });
  renderClassification();

  let treeDepth = 0;
  function renderTree() {
    const tree = fitTree(cafe, classFeatures, 'gini', treeDepth);
    const row = {wait: +$('predict-wait').value, party: +$('predict-party').value};
    $('predict-wait-value').value = row.wait;
    const route = new Set(), decisions = [];
    let node = tree;
    while (node) { route.add(node); if (!node.left) break; const goLeft = row[node.feature] <= node.threshold; decisions.push(`${names[node.feature]} ${row[node.feature]} ${goLeft ? '≤' : '>'} ${node.threshold}`); node = goLeft ? node.left : node.right; }
    const leaves = countLeaves(tree), coords = new Map(); let cursor = 0;
    function position(n) { let xx; if (n.left) { position(n.left); position(n.right); xx = (coords.get(n.left).x + coords.get(n.right).x) / 2; } else { xx = 100 + (cursor++ + .5) * 650 / leaves; } coords.set(n, {x: xx, y: 48 + n.depth * 120}); }
    position(tree); let s = '';
    function draw(n) {
      const p = coords.get(n);
      if (n.left) for (const [child, label] of [[n.left, 'yes'], [n.right, 'no']]) { const q = coords.get(child), active = route.has(n) && route.has(child); s += path([[p.x, p.y + 29], [p.x, p.y + 57], [q.x, p.y + 57], [q.x, q.y - 25]], active ? '#ae592e' : '#aab99f', active ? 3 : 1.5) + text((p.x + q.x) / 2, p.y + 50, label, 'text-anchor="middle"'); }
      const active = route.has(n), fill = n.left ? '#244e40' : n.value >= .5 ? '#dce8d6' : '#f0e0d2';
      s += `<rect x="${p.x - 92}" y="${p.y - 25}" width="184" height="61" rx="9" fill="${fill}" stroke="${active ? '#ae592e' : '#bbc7b2'}" stroke-width="${active ? 3 : 1}"/>`;
      s += `<text x="${p.x}" y="${p.y - 2}" text-anchor="middle" fill="${n.left ? '#fffef9' : '#244e40'}" font-size="12">${n.left ? `${names[n.feature]} ≤ ${n.threshold}?` : `Predict ${n.value >= .5 ? 'YES' : 'NO'}`}</text>`;
      s += `<text x="${p.x}" y="${p.y + 19}" text-anchor="middle" fill="${n.left ? '#dce8d6' : '#667165'}" font-size="10">${n.rows.length} visits · ${n.rows.filter(r => r.y).length} yes / ${n.rows.filter(r => !r.y).length} no</text>`;
      if (n.left) { draw(n.left); draw(n.right); }
    }
    draw(tree);
    $('tree-plot').setAttribute('viewBox', treeDepth === 0 ? '265 0 320 120' : `0 0 850 ${treeDepth === 1 ? 250 : 370}`);
    $('tree-plot').classList.toggle('wide-tree', treeDepth > 0);
    $('tree-plot').innerHTML = s;
    $('grow-level').value = `Depth ${treeDepth}`;
    $('grow-back').disabled = treeDepth === 0; $('grow-next').disabled = treeDepth === 2;
    const mistakes = cafe.filter(r => (predict(tree, r) >= .5 ? 1 : 0) !== r.y).length;
    $('grow-description').innerHTML = [
      '<strong>Start:</strong> one leaf, 4 yes / 4 no. The estimate is p̂(yes) = 0.50. This demo breaks a prediction tie toward yes.',
      '<strong>First question:</strong> wait ≤ 3.5. The left child is pure and stops. The right child still mixes 1 yes with 4 no. Now search using only those 5 visits.',
      '<strong>Second question:</strong> party size ≤ 2.5 inside the right child. This separates its 4 non-buyers from its 1 buyer. All leaves are pure, so growth stops. A different feature can be best deeper in the tree.'
    ][treeDepth] + ` <strong>${leaves} ${leaves === 1 ? 'leaf' : 'leaves'} · ${mistakes}/8 training mistakes.</strong>`;
    $('predict-result').innerHTML = `${decisions.length ? decisions.join(' → ') + ' → ' : ''}<strong>${node.value >= .5 ? 'Predict yes' : 'Predict no'}</strong> · p̂(yes) = ${fmt(node.value, 2)} (${node.rows.filter(r => r.y).length}/${node.rows.length} visits in this leaf).`;
  }
  $('grow-next').addEventListener('click', () => { treeDepth = Math.min(2, treeDepth + 1); renderTree(); });
  $('grow-back').addEventListener('click', () => { treeDepth = Math.max(0, treeDepth - 1); renderTree(); });
  $('predict-wait').addEventListener('input', renderTree); $('predict-party').addEventListener('change', renderTree); renderTree();

  function renderRegression() {
    const all = candidates(bikes, ['temp'], 'mse'), selected = all[+$('reg-threshold').value];
    $('reg-threshold-value').value = selected.threshold;
    const a = axes({w: 850, h: 330, xmin: 8, xmax: 26, ymin: 0, ymax: 60, xticks: [10, 14, 18, 22, 26], yticks: [0, 20, 40, 60], xlabel: 'Temperature (°C)', ylabel: 'Daily rentals'});
    const {x, y} = a;
    let s = a.svg + line(x(selected.threshold), y(0), x(selected.threshold), y(60), '#829977', 'stroke-dasharray="5 4"');
    for (const [rows, lo, hi, color] of [[selected.left, 8, selected.threshold, '#244e40'], [selected.right, selected.threshold, 26, '#ae592e']]) {
      const avg = mean(rows);
      s += line(x(lo), y(avg), x(hi), y(avg), color, 'stroke-width="3"');
      rows.forEach(r => { s += line(x(r.temp), y(r.y), x(r.temp), y(avg), color, 'stroke-width="1.5" stroke-dasharray="3 3"') + circle(x(r.temp), y(r.y), 5, color, 'stroke="#fffef9" stroke-width="1.5"'); });
      s += text(x((lo + hi) / 2), y(avg) - 12, `mean = ${fmt(avg, 1)}`, 'text-anchor="middle"');
    }
    $('reg-plot').innerHTML = s;
    $('reg-stats').innerHTML = [selected.left, selected.right].map((rows, i) => `<div class="child ${i ? 'right' : 'left'}"><h4>${i ? 'WARMER' : 'COOLER'} GROUP · ${rows.length} DAYS</h4><p>Counts: ${rows.map(r => r.y).join(', ')}</p><p>Mean = ${rows.reduce((s, r) => s + r.y, 0)} / ${rows.length} = <strong>${fmt(mean(rows), 2)}</strong></p><p>SSE = ${fmt(cost(rows, 'mse') * rows.length, 2)} · MSE = ${fmt(cost(rows, 'mse'), 2)}</p></div>`).join('');
    $('reg-score').innerHTML = `<div class="math">Q = (${selected.left.length}/8) × ${fmt(cost(selected.left, 'mse'), 2)} + (${selected.right.length}/8) × ${fmt(cost(selected.right, 'mse'), 2)} = <strong>${fmt(selected.score, 2)}</strong></div><p>Before splitting: MSE = ${fmt(cost(bikes, 'mse'), 2)}. Reduction = <strong>${fmt(cost(bikes, 'mse') - selected.score, 2)}</strong> rentals².</p>`;
    $('reg-data').innerHTML = `<table><thead><tr><th>Temperature (°C)</th><th>Rentals</th></tr></thead><tbody>${bikes.map(r => `<tr><td>${r.temp}</td><td>${r.y}</td></tr>`).join('')}</tbody></table><table><thead><tr><th>Candidate threshold (°C)</th><th>Weighted child MSE</th></tr></thead><tbody>${all.map(c => `<tr><td>${c.threshold}</td><td>${fmt(c.score, 2)}${Math.abs(c.score - bestSplit(bikes, ['temp'], 'mse').score) < 1e-9 ? ' ★ best' : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  $('reg-threshold').addEventListener('input', renderRegression);
  $('reg-best').addEventListener('click', () => { const all = candidates(bikes, ['temp'], 'mse'), best = bestSplit(bikes, ['temp'], 'mse'); $('reg-threshold').value = all.findIndex(a => a.threshold === best.threshold); renderRegression(); }); renderRegression();

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let z = Math.imul(seed ^ seed >>> 15, 1 | seed); z ^= z + Math.imul(z ^ z >>> 7, 61 | z); return ((z ^ z >>> 14) >>> 0) / 4294967296; }; }
  const rand = rng(47318);
  const trueRentals = x => x <= 16 ? 18 : x <= 23 ? 42 : 30;
  const noisyData = n => Array.from({length: n}, () => { const temp = 8 + 22 * rand(); const noise = 9 * (rand() + rand() + rand() - 1.5); return {temp, y: trueRentals(temp) + noise}; });
  const train = noisyData(24), validation = noisyData(48);
  const depthModels = Array.from({length: 8}, (_, d) => fitTree(train, ['temp'], 'mse', d));
  const error = (model, data) => data.reduce((s, r) => s + (r.y - predict(model, r)) ** 2, 0) / data.length;
  const errors = depthModels.map((model, d) => ({d, train: error(model, train), validation: error(model, validation)}));
  const chosenDepth = errors.reduce((a, b) => b.validation < a.validation ? b : a).d;
  function renderDepth() {
    const d = +$('depth').value, model = depthModels[d]; $('depth-value').value = d;
    const a = axes({w: 440, h: 285, xmin: 7, xmax: 31, ymin: 0, ymax: 60, xticks: [10, 15, 20, 25, 30], yticks: [0, 20, 40, 60], xlabel: 'Temperature (°C)', ylabel: 'Rentals · training days'});
    let s = a.svg;
    train.forEach(r => { s += circle(a.x(r.temp), a.y(r.y), 3, '#79936c'); });
    function leafSegments(t, lo, hi) { return t.left ? [...leafSegments(t.left, lo, t.threshold), ...leafSegments(t.right, t.threshold, hi)] : [{lo, hi, value: t.value}]; }
    const segments = leafSegments(model, 7, 31), pts = [];
    segments.forEach(seg => { pts.push([a.x(seg.lo), a.y(seg.value)], [a.x(seg.hi), a.y(seg.value)]); });
    s += path(pts, '#244e40', 2.5); $('depth-fit').innerHTML = s;
    const top = Math.ceil(Math.max(...errors.flatMap(e => [e.train, e.validation])) / 50) * 50;
    const b = axes({w: 440, h: 285, xmin: 0, xmax: 7, ymin: 0, ymax: top, xticks: [0, 1, 2, 3, 4, 5, 6, 7], yticks: [0, top / 2, top], xlabel: 'Maximum depth', ylabel: 'MSE (rentals²)'});
    let chart = b.svg + line(b.x(d), b.y(0), b.x(d), b.y(top), '#94a28c', 'stroke-dasharray="4 4"');
    for (const [key, color] of [['train', '#244e40'], ['validation', '#ae592e']]) { chart += path(errors.map(e => [b.x(e.d), b.y(e[key])]), color, 2); chart += circle(b.x(d), b.y(errors[d][key]), 5, color); }
    chart += text(286, 24, '● train', 'style="fill:#244e40"') + text(346, 24, '● validation', 'style="fill:#ae592e"');
    $('depth-errors').innerHTML = chart;
    $('depth-score').innerHTML = `<strong>Depth ${d} · ${countLeaves(model)} leaves</strong> · training MSE ${fmt(errors[d].train, 1)} · validation MSE ${fmt(errors[d].validation, 1)}.<br>Lowest validation error in this run: <strong>depth ${chosenDepth}</strong>. ${d > chosenDepth ? 'Extra depth is fitting more training detail without improving the best validation score.' : d < chosenDepth ? 'There is room to improve this fit before the best validation depth.' : 'This is the depth selected by this validation set.'}`;
  }
  $('depth').addEventListener('input', renderDepth); renderDepth();

  const forecasts = [20, 30, 40]; let lastWeight = [1, 1, 1];
  $('weight-controls').innerHTML = forecasts.map((f, i) => `<label for="weight-${i}">Model ${i + 1}: ${f} rentals<input type="range" id="weight-${i}" min="0" max="100" value="50"><output id="weight-label-${i}"></output></label>`).join('');
  function renderWeights(event) {
    const raw = forecasts.map((_, i) => +$('weight-' + i).value);
    let sum = raw.reduce((s, v) => s + v, 0);
    if (!sum) { const i = event ? +event.target.id.split('-')[1] : 0; raw[i] = 1; $('weight-' + i).value = 1; sum = 1; }
    const weights = raw.map(v => v / sum); lastWeight = weights;
    weights.forEach((w, i) => { $('weight-label-' + i).value = `Normalized weight: ${fmt(w, 2)} (${fmt(w * 100, 1)}%)`; });
    const result = weights.reduce((s, w, i) => s + w * forecasts[i], 0);
    const x = v => 50 + (v - 10) / 40 * 750;
    let s = line(x(10), 80, x(50), 80, '#becab3', 'stroke-width="2"');
    [10, 20, 30, 40, 50].forEach(v => { s += text(x(v), 145, v, 'text-anchor="middle"'); });
    forecasts.forEach((f, i) => { s += circle(x(f), 80, 6 + weights[i] * 17, '#b4c7a9', 'stroke="#244e40"') + text(x(f), 43, `Model ${i + 1}`, 'text-anchor="middle"'); });
    s += `<path d="M${x(result)} 92l-8 14h16z" fill="#ae592e"/>` + text(x(result), 125, `ensemble ${fmt(result, 1)}`, 'text-anchor="middle" style="fill:#ae592e"');
    $('ensemble-plot').innerHTML = s;
    $('ensemble-score').innerHTML = `<strong>${weights.map((w, i) => `${fmt(w, 2)} × ${forecasts[i]}`).join(' + ')} ≈ ${fmt(result, 2)} rentals.</strong><br>Weights shown rounded; the calculation uses full precision. Equal weights give (20 + 30 + 40)/3 = 30 rentals.`;
  }
  forecasts.forEach((_, i) => $('weight-' + i).addEventListener('input', renderWeights));
  $('equal-weights').addEventListener('click', () => { forecasts.forEach((_, i) => { $('weight-' + i).value = 50; }); renderWeights(); }); renderWeights();

  function binomial(n, p) {
    const probs = [(1 - p) ** n];
    for (let k = 0; k < n; k++) probs.push(probs[k] * (n - k) / (k + 1) * p / (1 - p));
    return probs;
  }
  function majorityAccuracy(n, p) { return binomial(n, p).slice(Math.floor(n / 2) + 1).reduce((s, v) => s + v, 0); }
  function renderVotes() {
    const n = +$('voters').value, p = +$('accuracy').value / 100;
    $('accuracy-value').value = `${Math.round(p * 100)}%`;
    const probs = binomial(n, p), ymax = Math.ceil(Math.max(...probs) * 10) / 10;
    const a = axes({w: 850, h: 235, xmin: -.6, xmax: n + .6, ymin: 0, ymax, xticks: n <= 11 ? Array.from({length: n + 1}, (_, k) => k) : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(n * .75), n], yticks: [0, ymax / 2, ymax], xlabel: `Number of correct votes out of ${n}`, ylabel: 'Probability'});
    let s = a.svg;
    probs.forEach((prob, k) => { const bw = Math.max(2, (a.x(1) - a.x(0)) * .72); s += `<rect x="${a.x(k) - bw / 2}" y="${a.y(prob)}" width="${bw}" height="${a.y(0) - a.y(prob)}" rx="2" fill="${k > n / 2 ? '#63815a' : '#d5b395'}"><title>${k} correct: ${fmt(prob * 100, 3)}%</title></rect>`; });
    s += line(a.x(n / 2), a.y(0), a.x(n / 2), a.y(ymax), '#244e40', 'stroke-dasharray="4 4"');
    $('vote-plot').innerHTML = s;
    const accuracy = majorityAccuracy(n, p);
    $('vote-score').innerHTML = `<strong>One model: ${fmt(p * 100, 1)}% accuracy → ${n}-model majority: ${fmt(accuracy * 100, 2)}%.</strong><br>${n === 1 ? 'One voter is just the original model.' : p > .5 ? 'Independent voters above chance help each other. Green bars add up to the correct-majority probability.' : p === .5 ? 'At chance, adding independent voters stays at chance.' : 'Below-chance independent voters reinforce the wrong answer. More voters can hurt.'}`;
  }
  $('accuracy').addEventListener('input', renderVotes); $('voters').addEventListener('change', renderVotes); renderVotes();

  function renderVariance() {
    const rho = +$('rho').value / 100;
    $('rho-value').value = fmt(rho, 2);
    const a = axes({w: 850, h: 220, xmin: 1, xmax: 50, ymin: 0, ymax: 1, xticks: [1, 10, 20, 30, 40, 50], yticks: [0, .25, .5, .75, 1], xlabel: 'Number of models M', ylabel: 'Variance of the average (σ² = 1)'});
    let s = a.svg + line(a.x(1), a.y(rho), a.x(50), a.y(rho), '#ae592e', 'stroke-dasharray="5 5"');
    s += path(Array.from({length: 50}, (_, i) => [a.x(i + 1), a.y(rho + (1 - rho) / (i + 1))]), '#244e40', 3);
    s += text(a.x(49), Math.max(18, a.y(rho) - 10), `limit = ρ = ${fmt(rho, 2)}`, 'text-anchor="end" style="fill:#ae592e"');
    $('variance-plot').innerHTML = s;
    $('variance-score').innerHTML = `At M = 20: variance = ${fmt(rho, 2)} + (1 − ${fmt(rho, 2)})/20 = <strong>${fmt(rho + (1 - rho) / 20)}</strong>, compared with 1 for a single model. As M grows, the shared-error part approaches <strong>${fmt(rho, 2)}</strong>.`;
  }
  $('rho').addEventListener('input', renderVariance); renderVariance();

  const questions = [
    {q: '1. A node has 3 buyers and 1 non-buyer. What is its Gini impurity?', options: ['0.25', '0.375', '0.75'], answer: 1, why: '1 − (3/4)² − (1/4)² = 0.375. This is different from its majority-prediction error, 1/4.'},
    {q: '2. Left: 2 rows, cost 0. Right: 6 rows, cost 0.5. What is Q?', options: ['0.25', '0.5', '0.375'], answer: 2, why: '(2/8) × 0 + (6/8) × 0.5 = 0.375. Weight each child by its share of the rows.'},
    {q: '3. A regression leaf contains rental counts 10, 20, and 30. What does it predict?', options: ['20 for any input reaching it', 'A line from 10 to 30', '30, the largest observation'], answer: 0, why: 'The mean is 20. A standard regression tree predicts that same constant throughout this leaf.'},
    {q: '4. Training error keeps falling but validation error rises. What should guide the depth?', options: ['Smallest training error', 'Validation or cross-validation error', 'Always use the deepest tree'], answer: 1, why: 'Validation estimates performance on new examples. Tune depth there, then report performance using a separate test set.'},
    {q: '5. You duplicate an identical model 100 times. What happens to average error variance?', options: ['It falls by 100×', 'It becomes zero', 'It stays the same'], answer: 2, why: 'Identical errors have correlation 1. The average equals the original prediction; more copies add no diversity.'},
    {q: '6. What predictions should train the stacking combiner?', options: ['Held-out or out-of-fold predictions', 'Each model’s predictions on its own training rows', 'The final test-set labels'], answer: 0, why: 'Use predictions from examples unseen by that base model. Keep the final test set out of both base-model and combiner training.'},
    {q: '7. How are Bayes model averaging weights chosen?', options: ['Always 1/M', 'Posterior model probabilities', 'Any signed coefficients'], answer: 1, why: 'BMA uses p(m | D), based on model priors and evidence. Predictive stacking learns a combination for a different purpose.'}
  ];
  $('quiz').innerHTML = questions.map((q, i) => `<div class="quiz-card" role="group" aria-labelledby="question-${i}"><h3 id="question-${i}">${q.q}</h3><div class="quiz-options">${q.options.map((o, j) => `<button data-q="${i}" data-a="${j}" aria-pressed="false">${o}</button>`).join('')}</div><p id="feedback-${i}" class="feedback" aria-live="polite"></p></div>`).join('');
  $('quiz').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.q, a = +b.dataset.a, q = questions[i];
    b.closest('.quiz-options').querySelectorAll('button').forEach(btn => { btn.className = ''; btn.setAttribute('aria-pressed', 'false'); });
    b.className = a === q.answer ? 'correct' : 'wrong'; b.setAttribute('aria-pressed', 'true');
    $('feedback-' + i).textContent = `${a === q.answer ? 'Correct.' : 'Try again.'} ${q.why}`;
  });
  // Preserve readable chart labels on phones; only the chart scrolls, not the page.
  document.querySelectorAll('.lesson svg').forEach(svg => {
    const wrapper = document.createElement('div'); wrapper.className = 'plot-scroll';
    wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', svg.getAttribute('aria-label') + '. Scroll horizontally on small screens.');
    svg.parentNode.insertBefore(wrapper, svg); wrapper.appendChild(svg);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('.lesson-nav a').forEach(a => { const active = a.hash === '#' + entry.target.id; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    }, {rootMargin: '-15% 0px -65% 0px'});
    document.querySelectorAll('.lesson').forEach(s => observer.observe(s));
  }
  window.TreesLab = {cafe, bikes, cost, candidates, bestSplit, fitTree, predict, countLeaves, binomial, majorityAccuracy, train, validation, errors, chosenDepth, getWeights: () => lastWeight};
})();

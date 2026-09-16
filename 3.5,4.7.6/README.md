# The Bias–Variance Tradeoff

An interactive visualization companion to Section 3.5 (sampling distribution of an estimator)
and Section 4.7.6 (the bias–variance tradeoff) from Murphy's *Probabilistic Machine Learning:
An Introduction* — the classic decomposition `MSE(θ̂) = Bias²(θ̂) + Var(θ̂)`, and its regression
form `E[(y − f̂(x))²] = σ² + Bias²(f̂(x)) + Var(f̂(x))`.

The page has three parts:

1. **An archery-target intuition builder.** Before any regression math, two sliders ("how far
   off-center the archer aims" / "how shaky the archer's hand is") let you directly manipulate
   bias and variance as separate, independent quantities and see the difference: bias shifts
   where the *average* arrow lands; variance controls how much any *one* arrow scatters around
   that average.
2. **A real prediction problem.** Predicting **monthly apartment rent** from **square footage**
   by fitting a polynomial of adjustable degree to a small random sample of listings (a "month's
   survey"). Drag the vertical line to pick a target square footage; the plot annotates the exact
   same bias/variance vocabulary from step 1 — a swarm of individual predictions at that point,
   a tick for the truth, a tick for the average prediction, and the gap between them labeled
   "bias" — plus a numeric breakdown cross-checked against a direct Monte-Carlo estimate of
   `E[(pred − truth)²]`.
3. **The complexity tradeoff.** A chart sweeping polynomial degree 1–9, plotting `Bias²`,
   `Variance`, and their sum averaged across the whole market. Because variance can explode by
   orders of magnitude at high degree with little data, this chart uses a **log-scale y-axis** so
   the low-degree region isn't crushed flat — and correctly marks the degree with the lowest
   expected error as the "sweet spot".

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX for the
equations) for GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

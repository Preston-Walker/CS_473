# The Bias–Variance Tradeoff

An interactive visualization companion to Section 3.5 (sampling distribution of an estimator)
and Section 4.7.6 (the bias–variance tradeoff) from Murphy's *Probabilistic Machine Learning:
An Introduction* — the classic decomposition `MSE(θ̂) = Bias²(θ̂) + Var(θ̂)`, and its regression
form `E[(y − f̂(x))²] = σ² + Bias²(f̂(x)) + Var(f̂(x))`.

The abstract decomposition is grounded in a concrete story: predicting **monthly apartment rent**
from **square footage** by fitting a polynomial of adjustable degree to a small random sample of
listings (a "month's survey"). A low-degree fit is too rigid to bend with the market's true
diminishing-returns shape (high bias, low variance); a high-degree fit happily chases the noise
in whichever apartments got surveyed (low bias, high variance).

Drag the vertical line on the main plot to pick a target square footage and watch the numeric
bias²/variance/MSE breakdown update live, alongside a Monte-Carlo check that the direct estimate
of `E[(pred − truth)²]` matches `Bias² + Variance`. The right-hand chart sweeps polynomial degree
1–9 and marks the "sweet spot" that minimizes expected test error.

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX for the
equations) for GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

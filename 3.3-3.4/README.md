# MVN Marginals & Conditionals

An interactive visualization of Section 3.2.3 ("Marginals and conditionals of an MVN") from
Murphy's *Probabilistic Machine Learning: An Introduction* — Equations 3.26–3.28.

Drag the horizontal line across the joint density plot to set an observed value `y2 = c` and
watch the conditional distribution `p(y1 | y2 = c)` update live, alongside a numeric check that
all three equivalent expressions for the conditional mean and both expressions for the
conditional covariance agree.

Built as a single static `index.html` (no build step) for GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

# ROC Curves, Read as Bayesian Decisions

An interactive visualization companion to §5.1.3.2 of Murphy's *Probabilistic Machine Learning: An
Introduction*, connecting the ROC curve back to the utility/cost framework introduced earlier in the
Bayesian decision theory chapter.

The story: a screening test produces a continuous risk score, and a doctor must pick a threshold `t` —
refer for follow-up if score > t. The page has four linked parts:

1. **The story.** Two overlapping score distributions (healthy vs. diseased patients, modeled as
   equal-variance Gaussians). Drag the threshold line directly on the density plot, or use the sliders,
   and watch the four outcome regions (TP, FP, TN, FN) reshape live.
2. **The confusion matrix and its rates.** A live 2×2 table (counts per 1000 patients screened) plus
   `TPR` (sensitivity/recall), `FNR` (miss rate), `FPR` (fall-out), and `TNR` (specificity), each defined
   and tied back to the current threshold with a plain-English readout.
3. **Utility, brought back.** Sliders for the cost of a false negative (a missed diagnosis), the cost of
   a false positive (an unnecessary follow-up), and the disease's prevalence. The page computes the
   expected cost per patient at the current threshold and the closed-form Bayes-optimal threshold
   `t* = μ0 + σ·(d'/2 + ln K / d')`, where `K = (1-π)L_FP / (π L_FN)` is the likelihood-ratio cutoff — with
   a button to jump straight to it and see the (often large) cost savings.
4. **The ROC curve itself.** Sweeping every possible threshold traces the ROC curve; the current
   threshold and the Bayes-optimal threshold are both marked as points on it, along with an iso-cost
   line (slope `K`) tangent at the optimum — the classic geometric picture of how cost and prevalence
   pick a point on a curve that only the test's own quality can reshape. AUC is reported with its
   probabilistic interpretation. The point can be dragged directly on the curve, and it stays in sync
   with the threshold slider and density plot.

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX for the equations)
for GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

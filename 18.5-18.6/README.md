# Reading the Ensemble

A short, interactive companion to Kevin P. Murphy's *Probabilistic Machine Learning: An Introduction*, sections 18.5.5–18.6 (gradient boosting, XGBoost, and interpreting tree ensembles).

Published at https://preston-walker.github.io/CS_473/18.5-18.6/

1. **Gradient boosting** (§18.5.5–18.5.5.1): house prices with five typo listings. Switch between squared, absolute and Huber loss, add trees, and see the pseudo-residuals each new tree is fit to.
2. **XGBoost** (§18.5.5.2): a split calculator for one spam-filter split. Adjust λ and γ to see the closed-form leaf weights w* = −G/(H+λ) and the split gain decide whether to split.
3. **Feature importance** (§18.6.1): a 200-tree boosted spam filter on nine spambase-style features (plus a noise column). Gain-based importance by number of trees, with an optional near-duplicate feature that splits the credit.
4. **Partial dependence** (§18.6.2): one-feature plots with individual-email (ICE) curves and a "set every email to this value" slider, plus a two-feature heat map that shows the “!” × “hp” interaction.
5. **Recap**: comparison table and self-check questions.

All data are synthetic and seeded, and everything runs in plain JavaScript with no dependencies. Files: `index.html`, `style.css`, `ml.js` (boosting, XGBoost-style trees, importance, partial dependence), `app.js` (demos). Open `index.html` directly or run `python -m http.server` in this folder.

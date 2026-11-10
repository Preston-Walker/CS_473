# Crowds and Coaches

A short, interactive companion to Kevin P. Murphy's *Probabilistic Machine Learning: An Introduction*, sections 18.4–18.5.4 (random forests and boosting).

Published at https://preston-walker.github.io/CS_473/18.4-18.5/

1. **Grow a forest** (§18.3–18.4): loan-approval map; add bootstrapped trees and watch the averaged boundary settle. Toggle bagging vs. random forest.
2. **Random features** (§18.4): eight-feature loan data. Slide m_try to see each tree's first question diversify, tree correlation ρ fall, and forest accuracy rise. Includes the ρσ² + (1−ρ)σ²/M variance-floor plot.
3. **The boosting idea** (§18.5–18.5.1): additive model and forward stagewise fitting with shrinkage.
4. **Fit the residuals** (§18.5.2): least-squares boosting on bike-share rentals vs. temperature; step through trees, change ν and tree depth, and watch train/test error.
5. **AdaBoost** (§18.5.3): spam filter with stumps; dot size shows each email's weight. Add mislabeled emails to see exponential loss fixate on them.
6. **LogitBoost** (§18.5.4): exponential vs. log loss curves and the Newton-step update; compare in the same spam lab.
7. **Recap**: comparison table and self-check questions.

All data are synthetic and seeded, and everything runs in plain JavaScript with no dependencies. Files: `index.html`, `style.css`, `ml.js` (trees, forests, boosting), `app.js` (demos). Open `index.html` directly or run `python -m http.server` in this folder.

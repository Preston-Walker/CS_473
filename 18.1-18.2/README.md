# One question at a time

A visual, interactive study companion to Kevin P. Murphy’s *Probabilistic Machine Learning: An Introduction*, sections 18.1–18.2. Equation numbers follow the author’s April 18, 2025 online version, whose printed chapter pages begin at 603 (pagination differs from the 2022 edition).

Published at https://preston-walker.github.io/CS_473/18.1-18.2/

Seven lessons follow the equations with original explanations and synthetic examples:

1. Tree regions, routing, and leaf predictions (18.1–18.3); interactive 2D region diagram.
2. Café classification: class proportions, Gini, entropy, weighted split costs, and exhaustive feature/threshold search (18.5, 18.7–18.9).
3. Grow an actual greedy tree one level at a time, then trace a new visit through it; training objective (18.4) and XOR limitation.
4. Bike-rental regression: leaf means, MSE, SSE, residual plots, and all candidate scores (18.3, 18.6).
5. Depth control with real training/validation fits, pruning, surrogate splits, categorical inputs, soft trees, and practical tradeoffs (§18.1.3–18.1.5).
6. Averaging, hard/soft voting, exact binomial majority accuracy, diversity/correlation, stacking, and BMA (18.10–18.14). The error-correlation variance formula is labeled supplementary intuition.
7. Seven feedback questions and a notation reference.

All calculations run locally in plain JavaScript. No dependencies, external fonts, analytics, build step, or network calls are needed. Open `index.html` directly, or from this directory run:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000. Files: `index.html`, `style.css`, `app.js`, and this README. Native HTML equations remain readable offline. SVG plots resize for mobile, controls have labels, and reduced-motion and print styles are included.

The café data have two features. Ties in split scores use feature order followed by the lower threshold. Classification prediction ties choose yes. Numeric candidate thresholds are midpoints of consecutive unique values, equivalent on the training data to the lower-observed-value convention in the book. Invalid empty-child splits are omitted. The overfitting demonstration uses fixed-seed, separately generated training and validation sets, not prewritten error curves.

Source: [author’s book page](https://probml.github.io/pml-book/book1.html) and its linked online PDF. All diagrams, examples, and explanations are original; no textbook pages or figures are distributed.

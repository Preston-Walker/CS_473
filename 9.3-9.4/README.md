# Generative vs Discriminative Classifiers

An interactive companion to §9.4 of Murphy's *Probabilistic Machine Learning: An Introduction*. It explains
what each kind of classifier learns. Then it goes through the chapter's advantages one at a time. Each one
gets real-world examples of where it matters and a live demo that shows the effect.

| Section | Advantage | Demo |
|---|---|---|
| The big idea | — | Salmon vs sea bass: a Gaussian generative classifier (QDA) and logistic regression fit side by side. Click to add fish. The generative model can invent new fish and flag outliers. |
| 9.3.4 | Generative–discriminative pair | Same σ(wᵀx+b) form, different objective (joint vs conditional likelihood) |
| 9.4.1 | Better predictive accuracy | A 1-D version of Fig 9.8: lumpy class densities but a simple S-curve posterior. One Gaussian per class misfits it. |
| 9.4.1 | Feature preprocessing | Two moons with polynomial features: logistic regression improves while Gaussian naive Bayes gets worse *and* more confident |
| 9.4.1 | Calibration | Spam clues with disguised duplicates: a reliability diagram for naive Bayes vs logistic regression |
| 9.4.2 | Easy to fit | Closed-form averages vs an animated gradient-descent loop |
| 9.4.3 | Missing features | Broken lightness sensor: marginalization vs mean imputation, against the simulator's truth |
| 9.4.2 | Fit classes separately | Adding trout: no old Gaussian changes, but every softmax weight moves |
| 9.4.2 | Unlabeled data | 4 labels + 300 unlabeled points: semi-supervised EM vs labeled-only models |
| 9.4.2 | Spurious features | Causal diagram of the chest X-ray "portable scanner" shortcut, at the training hospital and at a new one |

There is also an 8-question "which would you pick?" quiz and a cheat sheet.

All data are simulated from fixed seeds. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

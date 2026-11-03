# Sparse Vector Machines

A plain-language companion to §17.3.5–17.4 of Murphy's *Probabilistic Machine Learning: An Introduction*. It finishes
the SVM story and then compares SVMs with sparse vector machines (L1VM, RVM) and with the kernel methods from earlier
sections. Each subsection gets a one-sentence version, a real-world example, the key equation with an English
translation, an interactive demo, and a short list of takeaways.

| Section | Idea | Real-world example | Demo |
|---|---|---|---|
| Intro | Who does each method need to remember? | 40 days of bike rentals | k-NN, GP, kernel ridge, SVR, L1VM and RVM fit to the same data, showing which training days each one keeps |
| 17.3.5 | Platt scaling: turn SVM scores into probabilities | A credit-card fraud alarm | Fit σ(a·f + b) by hand or by maximum likelihood, and compare the probability map with the true one |
| 17.3.6 | SVM vs. logistic regression: hinge loss vs. log loss | Two teachers grading | Loss curves with a margin slider, and dot sizes showing each student's pull on the boundary |
| 17.3.7 | Multi-class SVMs: one-vs-rest and one-vs-one | A recycling sorter | Three rules side by side, showing the "nobody", "conflict" and tie regions |
| 17.3.8 | Choosing C and γ by cross-validation | A vineyard deciding when to pick | A live 7×7 grid search with 5-fold CV, compared with accuracy on new data |
| 17.3.9 | Kernel ridge regression: accurate but dense | A bike-rental shop | λ and kernel-width sliders, the sum-of-bumps view, and a stem plot of all 40 weights |
| 17.3.10 | SVM regression: the ε-insensitive tube | Staffing the bike shop | Widen the tube and watch the support vectors disappear |
| 17.4–17.4.1 | Sparse vector machines: L1VM and RVM | A realtor picking "comps" | An L1VM λ slider, plus an animation of the RVM pruning basis functions round by round, with error bars |
| 17.4.2 | Sparse vs. dense kernel methods | Same bike data | L2VM, L1VM, RVM and SVR side by side for N = 20 to 120, with a scorecard table |

It ends with a 13-question quiz and a cheat sheet.

All data are simulated from fixed seeds. Every model is trained in the browser in plain JavaScript: SVMs by SMO, SVR
and L1VM by coordinate descent, kernel ridge and L2VM by Cholesky solves, and the RVM by Tipping's re-estimation
updates. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

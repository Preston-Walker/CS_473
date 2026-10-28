# Support Vector Machines

A plain-language companion to §17.3.1–17.3.4 of Murphy's *Probabilistic Machine Learning: An Introduction*. Each
subsection gets a one-sentence version, a real-world example, the key equation with an English translation, an
interactive demo, and a short list of takeaways.

| Section | Idea | Real-world example | Demo |
|---|---|---|---|
| 17.3.1 | Large margin classifiers: draw the widest road | A bank sorting loan applicants by income and debt | Drag your own line and compare its road width with the SVM's, then test both on 40 new applicants |
| 17.3.2 | The dual problem: only the support vectors matter | A fence between two farms depends only on the closest buildings | Delete points and see that removing an α = 0 point changes nothing, while removing a support vector moves the road. Shows w = Σ αₙyₙxₙ live |
| 17.3.3 | Soft margin: allow a few mistakes for a fee C | A spam filter and one oddball family newsletter | Slide C from lenient to strict, toggle the outlier, and hover points to see αₙ and ξₙ |
| 17.3.4 | The kernel trick: bend the road | A thermostat's comfort range, and a pizza delivery zone | Lift 1D temperatures with a squared feature, then train linear, quadratic and RBF SVMs on a circular delivery zone |

It ends with an 11-question quiz and a cheat sheet.

All data are simulated from fixed seeds. The SVMs are trained in the browser by a small SMO solver written in plain
JavaScript. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

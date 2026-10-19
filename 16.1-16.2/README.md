# Deep Metric Learning

An interactive companion to §16.1–16.2 of Murphy's *Probabilistic Machine Learning: An Introduction*. It starts
with why nearest-neighbor methods need a learned distance. Then it goes through each family of metric-learning
model in the chapter, with a live demo for each one.

| Section | Topic | Demo |
|---|---|---|
| 16.1 → 16.2 | Why learn a distance? | One noisy feature ruins Euclidean 5-NN (53%). A slider sets a diagonal Mahalanobis metric and brings it back to 98%. |
| 16.2.1 | LMNN, NCA, LCA | Gradient descent on a full 2×2 **W**, with NCA soft-neighbor links or LMNN target neighbors, impostors and margin perimeter |
| 16.2.2 | Embedding networks | Unit-sphere normalization and ‖ê − ê′‖² = 2(1 − cos) |
| 16.2.3–16.2.5 | Network gallery | Wiring diagrams for Siamese, triplet, N-pair, classification and Proxy-NCA networks, with their losses and costs |
| 16.2.4.1 | Siamese / contrastive | Loss curves and pull/push "spring" forces versus distance and margin |
| 16.2.4.2, 16.2.5.1 | Triplet + mining | Drag anchor, positive and negative across the hard / semi-hard / easy zones; take gradient steps |
| 16.2.4.3 | N-pair | Normalized embeddings on a circle: the softmax over negatives versus a single triplet |
| 16.2.5 | Speed-ups | Number of terms per epoch for pairs, triplets and proxies as N and C vary |
| Lab | Training playground | A 2→32→32→2 MLP trained live (Adam, hand-written backprop) with contrastive, triplet (random / semi-hard / batch-hard), N-pair, Proxy-NCA or softmax losses. Includes a normalization toggle, a held-out class (open-set Recall@1) and a curve of active triplets. |
| 16.2.6 | Tricks | Normalization, batch construction, class-disjoint evaluation, the "metric learning reality check" |

It ends with an 8-question quiz and a cheat sheet.

All data are simulated from fixed seeds. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

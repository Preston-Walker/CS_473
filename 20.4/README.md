# Unrolling the Data

An interactive companion to Kevin P. Murphy's *Probabilistic Machine Learning: An Introduction*, §20.4 (manifold learning). It is an intuitive tour of every algorithm in the section, built around real-world examples, to read before the denser textbook treatment.

Published at https://preston-walker.github.io/CS_473/20.4/

1. **Manifolds (§20.4.1)**: Earth, a hiking trail and a rolled-up rug. Lab A: drag two beads on a rolled rug and compare crow-flies with along-the-rug (geodesic) distance.
2. **Manifold hypothesis (§20.4.2)**: Lab B rotates a 24×24 digit; its 72 rotations trace a closed loop in ℝ⁵⁷⁶ (shown via 3 PCs), next to a random point of pixel space.
3. **The menu (§20.4.3)**: global vs. local, eigen vs. gradient.
4. **MDS (§20.4.4)**: Lab C rebuilds a map of US (or world) cities from great-circle distances alone. It covers classical, metric (SMACOF) and Sammon MDS, measurement noise, and eigenvalues that reveal the globe's curvature.
5. **Isomap (§20.4.5)**: Lab D uses a K-NN graph, shortest paths and MDS to unroll a 600-point swiss roll. Raise K or noise to see short-circuit edges fold it.
6. **Kernel PCA (§20.4.6)**: Lab E separates a downtown core from a suburbs ring with linear, polynomial and RBF kernels.
7. **MVU (§20.4.7)**: Lab F pulls a crumpled necklace taut by locking neighbour distances while maximising spread. The SDP formulation is shown alongside.
8. **LLE (§20.4.8)**: Lab G lets you click a point on an S-curve to see its reconstruction weights ("recipe"), then shows the embedding.
9. **Laplacian eigenmaps (§20.4.9)**: Lab H colours the roll by Laplacian eigenvectors (fundamental vs. overtones) and shows the embedding.
10. **t-SNE & UMAP (§20.4.10)**: Lab I runs live t-SNE on 500 synthetic handwritten digits, with perplexity, Gaussian vs. Student-t, and a PCA contrast. A crowding-problem chart and reading cautions follow.
11. **Compare**: Lab J runs PCA, Isomap, kernel PCA, LLE, Laplacian eigenmaps and t-SNE on the swiss roll, the S-curve and the digits, scoring each by neighbours kept. A summary table follows.
12. **Self-check** questions.

All data are synthetic and seeded except the city coordinates. Everything runs in plain JavaScript with no dependencies. Files: `index.html`, `style.css`, `manifold.js` (data generators, Lanczos and shift-invert eigensolvers, Dijkstra, MDS/SMACOF/Sammon, Isomap, kernel PCA, LLE, Laplacian eigenmaps, exact t-SNE, an MVU-style unfolder), and `app.js` (the demos). Open `index.html` directly or run `python -m http.server` in this folder.

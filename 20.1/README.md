# Finding the Best Shadow

An interactive companion to Kevin P. Murphy's *Probabilistic Machine Learning: An Introduction*, §20.1 (principal components analysis). It shows visually what the PCA projection directions are and how they are found.

Published at https://preston-walker.github.io/CS_473/20.1/

1. **The idea**: encoder, decoder and reconstruction error.
2. **Find the line yourself**: rotate a projection line through 120 petal measurements and watch variance kept and reconstruction error trade off; they always sum to the total variance (Pythagoras).
3. **Why eigenvectors?**: drag a unit vector **v** and see where the covariance matrix sends it. Power iteration swings it onto the top eigenvector. Includes the Lagrangian derivation.
4. **The recipe**: step-through animation: centre, covariance, eigendecomposition, rotate into PC coordinates, drop a dimension, reconstruct. NumPy code for both eigendecomposition and SVD routes.
5. **3-D → 2-D**: a rotatable 3-D cloud flattened onto its best plane, with an edge-on view and the resulting 2-D codes.
6. **Eigenfaces**: 400 toy 20×20 faces. Rebuild a face from L components, walk along individual eigenfaces, and see the first 12.
7. **How many components?**: scree plot, fraction of variance explained, and train vs. held-out reconstruction error.
8. **Units matter**: height/weight PCA under different units, with and without standardisation.
9. **Self-check** questions and limitations.

All data are synthetic and seeded, and everything runs in plain JavaScript with no dependencies. Files: `index.html`, `style.css`, `pca.js` (Jacobi eigensolver, subspace iteration with Rayleigh–Ritz for the 400×400 face covariance, data generators), `app.js` (demos). Open `index.html` directly or run `python -m http.server` in this folder.

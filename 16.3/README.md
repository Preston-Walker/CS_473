# Kernel Density Estimation

An interactive companion to §16.3 of Murphy's *Probabilistic Machine Learning: An Introduction*. It starts with the
density kernels themselves and builds up to the Parzen window estimator. Then it uses that estimator for
classification (KNN) and regression (Nadaraya–Watson, LOESS), with a live demo for each step.

| Section | Topic | Demo |
|---|---|---|
| 16.3.1 | Density kernels | Gallery of the Gaussian, boxcar, Epanechnikov, tri-cube and triangle kernels, with a bandwidth slider and a "same standard deviation" toggle. A table gives each kernel's support, smoothness and efficiency. |
| 16.3.2 | Parzen window estimator | Click to add, drag to move, or remove data points and watch the bumps sum into p̂(x). Includes a histogram overlay with an adjustable bin origin. |
| 16.3.3 | Choosing the bandwidth | Five true densities (bimodal, Gaussian, skewed, spike + broad, uniform). Shows the LOO log-likelihood and ISE for every h, Silverman's rule, 20 resamples to show variance, and the best ISE for each kernel. |
| 16.3.2 (2D) | KDE in two dimensions | Paint points and see the product-kernel density as a heatmap with contours |
| 16.3.4 | KDE → KNN | Parzen (fixed h) versus balloon (fixed K) posterior maps, with the 0/0 region hatched and the arithmetic shown for a query point |
| 16.3.5 | Kernel regression | Nadaraya–Watson with a ±2 sd band and LOESS (local linear). Drag the query point to see its weights and the boundary bias. |

It ends with a 9-question quiz and a cheat sheet.

All data are simulated from fixed seeds. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

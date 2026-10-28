# Mercer Kernels

An interactive companion to §17.1–17.2 of Murphy's *Probabilistic Machine Learning: An Introduction*. It starts with the
condition that makes a similarity function a valid (Mercer) kernel and shows how kernels are generated: from features, from
eigendecompositions, from a standard zoo, and from closure rules. Then it puts kernels to work in Gaussian-process regression,
with a live demo for each step.

| Section | Topic | Demo |
|---|---|---|
| 17.1 | Mercer kernels | Gram matrix lab: drag points and see the Gram matrix, its eigenvalues, a sample from N(0, K), and the "bad direction" c when the matrix is indefinite. Includes valid kernels and impostors (boxcar, Epanechnikov, e^{-\|r\|³}, tanh). |
| 17.1.1 | Mercer's theorem | The quadratic kernel's hidden 3D feature space (rotatable), with φ(x)ᵀφ(x′) = (xᵀx′)² checked live, and a feature-count vs. kernel-cost calculator |
| 17.1.1 | Features → kernel | Taylor features, Gaussian bumps and random Fourier features all converging to the SE kernel, with random functions from the same weights |
| 17.1.1 | Kernel → features | Eigendecomposition of SE, Matérn ½, periodic and linear kernels: the spectrum, eigen-features, and rank-M reconstruction |
| 17.1.2 | Kernel zoo | SE, Matérn ½/3⁄2/5⁄2, rational quadratic, periodic, cosine, linear and polynomial, each with GP prior samples |
| 17.1.2 | ARD | A 2D random function with one length-scale per input |
| 17.1.2 | New kernels from old | Closure rules, and a step-by-step derivation of SE from the linear kernel (exp, then an envelope), with the PSD check at each step |
| 17.1.2 | Sums and products | Kernel composer with presets (Lin×Lin, SE×Per, Lin+Per, Lin×Per, SE+SE): slice, full kernel heatmap and samples |
| 17.1.2 | Structured inputs | k-spectrum string kernel with shared substrings and a normalized word Gram matrix |
| 17.2 | GP regression | Click-to-add playground: noise-free vs. noisy, posterior samples, fit by marginal likelihood, and GP equivalent-kernel weights vs. Nadaraya–Watson |
| 17.2.6 | Learning the kernel | Log marginal likelihood surface with two optima, and the data-fit vs. complexity split |
| Application | Forecasting | Build a Lin + SE + Per×SE + SE kernel for a simulated seasonal series, see the per-component decomposition, and score the 4-year forecast |

It ends with a short tour of the rest of §17.2, a 12-question quiz and a cheat sheet.

All data are simulated from fixed seeds. It is a single static `index.html` (KaTeX is the only dependency) and supports light and dark mode.

## Run locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder.

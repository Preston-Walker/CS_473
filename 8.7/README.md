# EM, One Step at a Time

An interactive companion to §8.7 (bound optimization) of Murphy's *Probabilistic Machine Learning: An
Introduction*. It builds the EM algorithm in the same order as the chapter: first the general MM idea,
then the lower bound, then the E step and the M step, then EM for Gaussian mixtures and its two classic
pitfalls.

The running story: two orchards' apples got dumped into one bin. **Hillside** grows small apples and
**Valley** grows big ones. You weigh every apple but don't know which orchard it came from (the latent
variable `z_n`). You want each orchard's mean, spread and share (`θ`), plus a guess for every apple.

| Subsection | Equation(s) | Demo |
|---|---|---|
| The story | — | Dot plot of the bin with a "peek at the truth" toggle, the chicken-and-egg problem, and a story-to-math table |
| 8.7.1 General algorithm (MM) | `Q ≤ LL`, `Q(θᵗ,θᵗ)=LL(θᵗ)`, the monotonicity chain | The real LL(μ_V) curve with EM's actual lower bound redrawn at each step; click to choose a start, then step or run; the inequality chain is filled in live |
| 8.7.2 EM | `LL = Σ log Σ_z p(y,z|θ)` | Why the log of a sum is the obstacle |
| 8.7.2.1 Lower bound | Jensen, the ELBO | One apple on the log curve: the q(H) slider moves the chord, and the gap equals the KL to the posterior |
| 8.7.2.2 E step | `L = log p(y) − KL(q ‖ p(z|y))`, `q* = posterior` | Recipe sliders, apples colored by (frozen) responsibility, and a scoreboard of LL vs. ELBO with a magnified gap bar |
| 8.7.2.3 M step | expected complete-data log likelihood | Seesaw view: each apple weighted by its responsibility, with the balance point = new mean; apply M, one full iteration, or run to convergence |
| 8.7.3.1–2 GMM E/M | `r_nk`, weighted `μ_k`, `Σ_k`, `π_k` | (equations, tied back to the demos) |
| 8.7.3.3 Example | — | 2-D EM (weight × sweetness) with 1σ/2σ ellipses, draggable starting centers, and an LL trace that never decreases |
| 8.7.3.4 MAP | singularity, `Σ̂ = (S̆ + S_k)/(ν̆ + r_k + D + 2)` | MLE and MAP side by side from a start on a single giant apple: MLE's σ collapses to 0, MAP's levels off |
| 8.7.3.5 Nonconvexity | label switching, `K!` modes | LL heat map over (μ_H, μ_V); click to run EM from any point, with random restarts and a diagonal (saddle) start |

A one-line-per-equation cheat sheet is at the bottom.

Notes:
- Log likelihoods are in nats.
- The apples are simulated from a fixed seed. The examples are the page's own, not the book's.
- The MAP demo uses a flat prior on the means and the book's default pseudo-scatter `S̆ = s²/K^{1/D}`,
  `ν̆ = D + 2`, in 1-D.

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX) for GitHub Pages.
It supports light and dark mode.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

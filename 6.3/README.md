# Mutual Information, Intuitively

An interactive companion to §6.3 of Murphy's *Probabilistic Machine Learning: An Introduction*. It walks
through every major equation in the section, giving the intuition first, then the equation read term by
term, then something to play with.

The running story: you try to guess what your roommate carries out the door (`Y`: nothing, jacket,
umbrella) and you glance at the weather (`X`: sunny, cloudy, rainy). Mutual information is how many
yes/no questions that glance saves you.

| Subsection | Equation(s) | Demo |
|---|---|---|
| 6.3.1 Definition | `I(X;Y) = KL(p(x,y) ‖ p(x)p(y))`, pointwise MI | Editable 3×3 joint table next to its "independent" version and a signed per-cell contribution map; hovering a cell explains its PMI in words |
| 6.3.2 Interpretation | `I = H(X) − H(X|Y) = H(Y) − H(Y|X) = H(X)+H(Y)−H(X,Y)` | Information diagram (the Venn figure as aligned bars), with all four identities evaluated live |
| 6.3.3 Example | the definition's sum, term by term | Full arithmetic table for the current joint, cross-checked against the entropy identity |
| 6.3.4 Conditional MI | `I(X;Y|Z)`, chain rule | Common-cause (conditioning removes dependence) vs. XOR referee (conditioning creates it), with per-slice tables and both chain-rule orders |
| 6.3.5 Generalized correlation | `I = −½ log(1 − ρ²)` | ρ slider with Gaussian scatter and the MI curve |
| 6.3.6 Normalized MI | `0 ≤ I ≤ min(H(X),H(Y))`, NMI | NMI tiles for the roommate table |
| 6.3.7 MIC | `max_G I(G) / log min(Gx,Gy)` | Line, parabola, circle, sine and X-shape scatter plots with a hoverable characteristic matrix and grid overlay, comparing Pearson ρ with MIC |
| 6.3.8 Data processing inequality | `X→Y→Z ⇒ I(X;Y) ≥ I(X;Z)` | Telephone game with a 4-letter message, two noisy hops and a post-processing function |
| 6.3.9 Sufficient statistics | `I(θ; s(D)) = I(θ; D)` | Coin-bias example with exact MI (all 2ⁿ sequences enumerated) for several candidate statistics |
| 6.3.10 Fano's inequality | `P_e ≥ (H(Y|X) − 1) / log|Y|` | Noisy K-class sensor plotted against the book's bound and the sharp bound |

A one-line-per-equation cheat sheet is at the bottom.

Notes:
- All values are in bits (log₂).
- The MIC demo places grid lines at quantiles instead of optimizing them, so its values slightly
  underestimate true MIC.
- The examples are the page's own, not the book's.

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX) for GitHub Pages.
It supports light and dark mode.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

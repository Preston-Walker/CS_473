# Forward vs. Reverse KL: The Mail Carrier and the Food Truck

An interactive visualization companion to §6.2.6 of Murphy's *Probabilistic Machine Learning: An
Introduction*, turning the textbook's bimodal contour figure (a single Gaussian `q` fit to a two-mode `p`)
into something you can drag around and optimize live.

The story: a valley has two towns separated by a lake, so where people live is a two-humped distribution
`p`. Two businesses each get one van that can only work a single Gaussian-shaped patch `q`:

- **The mail carrier** must reach every resident, so it is graded at every resident's door. That is
  forward KL, `KL(p‖q) = E_p[log p/q]`, which is zero-avoiding and mass-covering. It stretches one big
  oval over both towns and the lake.
- **The food truck** loses money wherever it parks with no customers, so it is graded wherever it goes.
  That is reverse KL, `KL(q‖p) = E_q[log q/p]`, which is zero-forcing and mode-seeking. It locks onto
  one town, and which town depends on where it started.

The page has four parts:

1. **The story**, with a table mapping each story element to its math.
2. **The valley map**, a live contour plot with `p` in blue and `q` in orange. You can drag either town
   or the van, change the town sizes and population split, or set `q`'s widths and tilt by hand. Each
   button runs Adam gradient descent on one of the two KL directions, animated step by step with a loss
   trace. Finished runs leave dashed "ghost" ovals, so the single forward-KL answer (moment matching)
   and the several reverse-KL local minima can be compared side by side. An optional heat map shows the
   signed KL integrand, `p·log(p/q)` or `q·log(q/p)`, which marks where each business gets penalized.
   Live tiles report both KL values, the share of residents inside `q`'s 2σ oval, and the share of van
   time spent where almost nobody lives. Presets and a guided tour cover the textbook figure, far-apart
   towns, merging towns, and a lopsided city plus village where reverse KL gets stuck on the worse mode.
3. **Why**: both divergences written out, with a comparison table (inclusive/exclusive,
   M-projection/I-projection).
4. **Where it shows up in ML**: maximum likelihood is forward KL (which explains hedging and blurry
   samples), and variational inference is reverse KL (which explains overconfident, single-mode
   posteriors and the mode-collapse flavor of failure).

The KL values are computed accurately rather than on a coarse grid. `KL(q‖p)` uses the closed-form
Gaussian entropy plus 2-D Gauss–Hermite quadrature under `q`. `KL(p‖q)` is closed form in `q`, with
`H(p)` from quadrature. The optimizer works on `(μ, log σx, log σy, atanh ρ)` using finite-difference
gradients, and it preconditions the mean step by Σ.

Built as a single static `index.html` (no build step, no dependencies beyond KaTeX for the equations)
for GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

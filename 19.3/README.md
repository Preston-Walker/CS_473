# Who Gives the Answers?

An interactive companion to Kevin P. Murphy's *Probabilistic Machine Learning: An Introduction*, §19.3 (semi-supervised learning). It sets supervised, unsupervised and semi-supervised learning side by side, with extra depth on unsupervised learning.

Published at https://preston-walker.github.io/CS_473/19.3/

1. **The label question**: what separates the three kinds of learning, and why labels are the expensive part.
2. **Same data, three ways**: 300 help-desk tickets on two interlocking arcs. Slide the label budget to compare a nearest-neighbor classifier (labeled only), k-means (no labels) and label propagation (labeled + unlabeled), with accuracy and labeling cost.
3. **Unsupervised toolkit**: k-means customer segmentation with step-through and an elbow plot; nearest-neighbor anomaly detection on card transactions with a hidden-fraud reveal; PCA on two exam scores with a draggable projection direction.
4. **Real-world sorter**: 12 scenarios to classify as supervised, unsupervised or semi-supervised, each with an explanation.
5. **Pros & cons**: cards and a comparison table.
6. **Decision guide**: three questions lead to a suggested approach. Includes notes on self-supervised and reinforcement learning.
7. **Self-check** questions.

All data are synthetic and seeded, and everything runs in plain JavaScript with no dependencies. Files: `index.html`, `style.css`, `ml.js` (k-NN, label propagation with class-mass normalization, k-means++, k-NN outlier scores, 2-D PCA), `app.js` (demos). Open `index.html` directly or run `python -m http.server` in this folder.

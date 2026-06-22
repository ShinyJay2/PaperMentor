# Sample paper excerpt: Expected risk minimization

This is a compact public-domain-style excerpt for testing PaperMentor behavior. It is not copied from a real paper.

We consider supervised learning with input space $\mathcal{X}$, label space $\mathcal{Y}$, and data distribution $\mathcal{D}$ over $\mathcal{X}\times\mathcal{Y}$. A predictor is a function $f:\mathcal{X}\to\mathcal{Y}$. Given a loss function $\ell:\mathcal{Y}\times\mathcal{Y}\to\mathbb{R}_{\ge 0}$, the population risk is

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right].
$$

Because $\mathcal{D}$ is unknown, the learner minimizes the empirical risk over a sample $S=\{(x_i,y_i)\}_{i=1}^n$:

$$
\widehat{\mathcal{R}}_S(f)=\frac{1}{n}\sum_{i=1}^{n}\ell(f(x_i),y_i).
$$

The method is useful only when a low empirical risk also implies a low population risk. This requires assumptions that connect the sample $S$ to the unknown distribution $\mathcal{D}$.

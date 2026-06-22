# Sample output: derivation trace

Start with the population objective:

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
$$

Move to the sample-based objective:

$$
\widehat{\mathcal{R}}_S(f)=\frac{1}{n}\sum_{i=1}^{n}\ell(f(x_i),y_i)
$$

## Transition

- **What changed:** the unknown distribution-level expectation was replaced by an average over observed examples.
- **Operation:** approximate an expectation using a finite-sample mean.
- **Property used:** if samples are representative draws from $\mathcal{D}$, the sample average estimates the distributional expectation.
- **Substitution:** replace a generic draw $(x,y)$ with indexed sample elements $(x_i,y_i)$.
- **Cancellation:** none.
- **Assumption invoked:** the sample $S$ must be related to $\mathcal{D}$, typically by an i.i.d. sampling assumption.
- **Why valid:** it is not automatically valid from notation alone; it becomes valid only under a sampling/generalization assumption.

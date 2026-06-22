# Sample output: equation card

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
$$

- $\mathcal{R}$ — risk functional: it maps a predictor to its expected loss.
- $f$ — predictor being evaluated.
- $(x,y)$ — one input-label pair.
- $(x,y)\sim\mathcal{D}$ — the pair is sampled from the data distribution.
- $\mathbb{E}_{(x,y)\sim\mathcal{D}}$ — expectation over repeated draws from $\mathcal{D}$.
- $\ell$ — loss function.
- $f(x)$ — predicted label for input $x$.
- $y$ — true label.
- $\ell(f(x),y)$ — penalty for predicting $f(x)$ when the true label is $y$.

In words: $\mathcal{R}(f)$ is the average loss predictor $f$ would incur if evaluated on fresh examples from the true distribution.

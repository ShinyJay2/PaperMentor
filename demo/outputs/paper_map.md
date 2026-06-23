# Sample output: paper map

## Problem

The excerpt asks how to choose a predictor when the true data distribution is unknown.

## Objects

- $\mathcal{X}$ — input space.
- $\mathcal{Y}$ — label space.
- $\mathcal{D}$ — unknown distribution over $\mathcal{X}\times\mathcal{Y}$.
- $f:\mathcal{X}\to\mathcal{Y}$ — predictor.
- $\ell:\mathcal{Y}\times\mathcal{Y}\to\mathbb{R}_{\ge 0}$ — nonnegative loss.
- $S=\{(x_i,y_i)\}_{i=1}^n$ — observed sample.

## Figure map

No figure is present in the excerpt. If the full paper included a method or system diagram, PaperMentor would explain its components, flow, what to observe, and which equations or claims it supports.

## Core equations

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
$$

$$
\widehat{\mathcal{R}}_S(f)=\frac{1}{n}\sum_{i=1}^{n}\ell(f(x_i),y_i)
$$

## CLI-only likely confusion points

- Why expectation becomes an average.
- Why low empirical risk may not imply low population risk.
- Which assumption links $S$ back to $\mathcal{D}$.

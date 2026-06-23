# TurboQuant-style prerequisite ladder example

User target: understand a quantization problem definition with

$$
Q:\mathbb{R}^d\to\{0,1\}^B,
\qquad
Q^{-1}:\{0,1\}^B\to\mathbb{R}^d
$$

and expected MSE / inner-product distortion.

## Reader starting point

Assume the reader is new to quantization and may not know what a bit is.

## Ladder

### 1. Bit

- **Tier:** primitive vocabulary
- **Why needed here:** the output of $Q$ is a string of $B$ bits.
- **Minimal explanation:** a bit is one binary choice, either `0` or `1`.
- **Concrete example:** with 3 bits you can write $2^3=8$ patterns: `000` through `111`.
- **Notation introduced:** $B$ bits.
- **Diagnostic check:** how many patterns can 4 bits represent?

### 2. Binary string

- **Tier:** primitive vocabulary
- **Why needed here:** the quantized object lives in $\{0,1\}^B$.
- **Minimal explanation:** a binary string is a fixed-length sequence of bits.
- **Concrete example:** `01101010` is an 8-bit binary string.
- **Notation introduced:** $\{0,1\}^B$.
- **Diagnostic check:** what does $\{0,1\}^8$ contain?

### 3. Real vector

- **Tier:** primitive vocabulary
- **Why needed here:** the input is $x\in\mathbb{R}^d$.
- **Minimal explanation:** a vector is an array of real numbers.
- **Concrete example:** $x=[1.2,3.5,-0.7]\in\mathbb{R}^3$.
- **Notation introduced:** $\mathbb{R}^d$.
- **Diagnostic check:** if a vector has 1536 coordinates, what is $d$?

### 4. Quantization map

- **Tier:** notation decoding
- **Why needed here:** the paper defines $Q$ as the encoder.
- **Minimal explanation:** $Q:\mathbb{R}^d\to\{0,1\}^B$ means “take a real vector and output a $B$-bit code.”
- **Concrete example:** $[1.2,3.4]$ might become `01101010`.
- **Notation introduced:** $Q:\mathbb{R}^d\to\{0,1\}^B$.
- **Diagnostic check:** what is the input and output type of $Q$?

### 5. Dequantization

- **Tier:** core concept
- **Why needed here:** the paper needs a reconstructed vector to measure error.
- **Minimal explanation:** $Q^{-1}$ is not a perfect inverse; it is a decoder that maps a code back to an approximate vector.
- **Concrete example:** `0110` might decode to $\hat{x}=[1.21,3.38]$.
- **Notation introduced:** $Q^{-1}:\{0,1\}^B\to\mathbb{R}^d$.
- **Diagnostic check:** why is $Q^{-1}$ only approximate?

### 6. Lossy compression

- **Tier:** core concept
- **Why needed here:** the paper says $Q$ is not a bijection.
- **Minimal explanation:** many real vectors must share the same finite bit string, so exact recovery is impossible.
- **Concrete example:** $1.01$, $1.02$, and $1.03$ might all be stored as the same low-bit code.
- **Notation introduced:** bijection / not bijective.
- **Diagnostic check:** why can two different vectors decode to the same approximation?

### 7. MSE distortion

- **Tier:** metric layer
- **Why needed here:** Eq. (1) measures vector reconstruction quality.
- **Minimal explanation:** MSE squares the coordinate-wise reconstruction error and sums/averages it.
- **Concrete example:** if $x=[1,2]$ and $\hat{x}=[1.1,1.9]$, then $\|x-\hat{x}\|_2^2=0.02$.
- **Notation introduced:** $\|x-Q^{-1}(Q(x))\|_2^2$.
- **Diagnostic check:** what does smaller MSE mean?

### 8. Inner product

- **Tier:** metric layer
- **Why needed here:** Eq. (2) measures similarity preservation.
- **Minimal explanation:** an inner product multiplies matching coordinates and adds them.
- **Concrete example:** $\langle[1,2],[3,4]\rangle=1\cdot3+2\cdot4=11$.
- **Notation introduced:** $\langle y,x\rangle$.
- **Diagnostic check:** why might vector databases care more about inner product than exact reconstruction?

### 9. Randomized quantizer and expectation

- **Tier:** probability layer
- **Why needed here:** the paper allows $Q(x)$ to be random, so distortion is analyzed on average.
- **Minimal explanation:** the same value can round differently on different runs, but with controlled probabilities.
- **Concrete example:** $3.4$ might round to $3$ with probability $0.6$ and $4$ with probability $0.4$.
- **Notation introduced:** $\mathbb{E}_Q[\cdot]$.
- **Diagnostic check:** what randomness does the expectation average over?

### 10. Unbiased inner-product estimator

- **Tier:** probability layer
- **Why needed here:** the paper requires the inner product to be correct on average.
- **Minimal explanation:** individual estimates may be high or low, but the average equals the true value.
- **Concrete example:** estimates $90$, $110$, $95$, and $105$ average to $100$.
- **Notation introduced:** $\mathbb{E}_Q[\langle y,Q^{-1}(Q(x))\rangle]=\langle y,x\rangle$.
- **Diagnostic check:** what does “correct on average” mean?

### 11. Worst-case efficient quantizer

- **Tier:** paper-specific objective
- **Why needed here:** the final goal is an algorithm that works for arbitrary vectors at a chosen bit-width.
- **Minimal explanation:** `Quant` stores compact bit strings and `DeQuant` reconstructs approximate vectors when needed.
- **Concrete example:** given $n$ embedding vectors, store $Q(x_1),\ldots,Q(x_n)$ and reconstruct $Q^{-1}(Q(x_i))$ for search or analysis.
- **Notation introduced:** `Quant`, `DeQuant`, $b=B/d$.
- **Diagnostic check:** what tradeoff does the paper optimize?

## One-sentence reconstruction

The paragraph asks for efficient randomized encoders $Q$ and decoders $Q^{-1}$ that compress $d$-dimensional real vectors into $B$ bits, minimize reconstruction and inner-product distortion in expectation for worst-case inputs, and keep inner-product estimates unbiased.

## Next advanced prerequisites

Norms, stochastic rounding, rate-distortion theory, Johnson-Lindenstrauss, product quantization, entropy, and vector-search similarity metrics.

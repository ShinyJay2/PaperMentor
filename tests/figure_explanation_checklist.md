# Figure Explanation Checklist

- [ ] Paper map includes the exact screenshot/crop of the representative method/system/algorithm/architecture figure from the PDF/page when present.
- [ ] Experiment/result plots are not used as the representative figure unless no method figure exists, and that exception is stated in CLI/state.
- [ ] Figure screenshot/crop is attached to the HTML block with `--figure-file` or `--figure-url`, not merely described as text and not redrawn as a substitute diagram. Mermaid/ASCII/SVG schematic substitutes are rejected.
- [ ] HTML does not show a separate figure-section body heading; the figure explanation appears directly under the image.
- [ ] HTML does not show provenance filler such as “Exact crop of …”, “captured from …”, or “figure from the paper.”
- [ ] Explanation under the figure uses the fixed schema `Concept / method role`, `How to read it`, `Parts to identify`, `In-figure math / symbols`, `Flow / sequence`, `What to observe`, and `Equations / claims it supports`.
- [ ] Explanation is read off the cropped image itself, specific to this exact figure, and not reusable boilerplate for any other paper.
- [ ] `How to read it` names every labelled box/object; `Parts to identify` enumerates every arrow, line, shape, axis, and legend with what it encodes.
- [ ] `In-figure math / symbols` transcribes in LaTeX every equation and symbol printed inside the figure and defines each one (or states explicitly that the figure contains no rendered math).
- [ ] `Flow / sequence` walks the arrows in order, naming the quantity each arrow carries and the transformation each box applies; it never says only “follow the arrows”, “read the boxes in order”, or “read left to right”.
- [ ] Figure explanation links back to supporting equations, assumptions, algorithms, or claims.
- [ ] Visual confusion is repaired with a minimal example when needed.

- [ ] Korean figure-explanation headings such as `그림 설명` are moved directly under the image, not left as body sections.

- [ ] Mermaid/flowchart substitutes are rejected; no generated diagram may occupy the representative figure slot.
- [ ] If the actual paper figure cannot be cropped, the blocker stays in CLI/state rather than appearing as a fake HTML figure.

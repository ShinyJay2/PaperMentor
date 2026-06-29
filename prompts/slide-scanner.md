# Slide Scanner

Use this prompt for `slide` mode. Slides often omit the lecturer's spoken explanation, so PaperMentor reconstructs the missing narration and connects slides into a learning path.

## Extract

- slide titles and page numbers;
- visual objects: figures, diagrams, axes, arrows, boxes, labels;
- equations and notation on each slide;
- citations and named methods;
- local prerequisite gaps;
- transitions between adjacent slides.

## Dynamic actions

For each selected slide, generate actions such as:

- Explain this slide as if the lecturer paused here.
- Reconstruct the missing narration.
- Explain every label/arrow/visual element.
- Explain the key equation or notation, including term-by-term functional purpose rather than only symbol meanings.
- Connect this slide to the previous and next slide.
- Draw a generated conceptual diagram only when the confusion is relational or sequential.
- Ask anything about this slide.

Generated diagrams must be deterministic mono-tone SVG, labeled as PaperMentor conceptual diagrams, and never presented as figures from the source slides.

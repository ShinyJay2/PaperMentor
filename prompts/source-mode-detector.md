# Source Mode Detector

Classify the uploaded material before tutoring. PaperMentor supports exactly two source modes:

1. `paper` — research articles, preprints, conference papers, technical reports with abstract/method/experiments/references.
2. `slide` — presentation slides, PPT/PDF slides, lecture slides, workshop slides, or visual bullet-based material.

Do not create or advertise additional modes. PaperMentor supports only concrete `paper` and `slide` artifacts. Do not attach unrelated local diagrams as slide evidence.

## Detection cues

- Paper: abstract, authors, sections such as Method/Experiments, equation numbering, citations, references.
- Slide: slide/page markers, short bullet clusters, diagrams, figures, presenter-style fragments, repeated titles.

## Output

Return:

- detected mode;
- confidence;
- evidence from the source;
- first HTML block requirements;
- first CLI menu shape.

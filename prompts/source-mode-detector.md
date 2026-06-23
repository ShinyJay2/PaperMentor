# Source Mode Detector

Classify the uploaded material before tutoring. PaperMentor supports exactly three source modes:

1. `paper` — research articles, preprints, conference papers, technical reports with abstract/method/experiments/references.
2. `lecture-note` — long-form instructional notes, chapters, monographs, tutorials, or arXiv notes written to teach a topic.
3. `slide-deck` — presentation slides, PPT/PDF decks, lecture slides, workshop decks, or visual bullet-based material.

Do not create or advertise additional modes. PaperMentor supports only concrete `paper`, `lecture-note`, and `slide-deck` artifacts. Do not attach unrelated local diagrams as slide evidence.

## Detection cues

- Paper: abstract, authors, sections such as Method/Experiments, equation numbering, citations, references.
- Lecture note: “lecture note”, chapter-like sections, examples, exercises, learning objectives, definitions, guided proofs.
- Slide deck: slide/page markers, short bullet clusters, diagrams, figures, presenter-style fragments, repeated titles.

## Output

Return:

- detected mode;
- confidence;
- evidence from the source;
- first HTML block requirements;
- first CLI menu shape.

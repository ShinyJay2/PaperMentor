import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'README.md','SKILL.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','install.sh','install.ps1','package.json','.npmignore','docs/ci/github-actions-ci.yml','.github/workflows/ci.yml','assets/papermentor-hero.svg','assets/papermentor-demo.svg','assets/social-preview.svg','assets/fonts/README.md','assets/fonts/satoshi/Satoshi-300.woff2','assets/fonts/satoshi/Satoshi-400.woff2','assets/fonts/satoshi/Satoshi-500.woff2','assets/fonts/satoshi/Satoshi-700.woff2','assets/fonts/satoshi/Satoshi-900.woff2','assets/fonts/pretendard/PretendardVariable.woff2','assets/mathjax/README.md','assets/mathjax/LICENSE.txt','assets/mathjax/tex-svg.js','scripts/papermentor-session.mjs',
  'prompts/paper-scanner.md','prompts/source-mode-detector.md','prompts/slide-scanner.md','prompts/slide-navigator.md','prompts/prerequisite-analyzer.md','prompts/section-navigator.md','prompts/equation-analyzer.md','prompts/derivation-tracer.md','prompts/dependency-tracer.md','prompts/proof-analyzer.md','prompts/method-analyzer.md','prompts/confusion-resolver.md','prompts/final-insight-extractor.md','prompts/visualization-planner.md',
  'skills/papermentor/SKILL.md','skills/papermentor/commands.md','skills/papermentor/examples.md',
  'templates/start_here.md','templates/slide_start_here.md','templates/paper_map.md','templates/prerequisite_ladder.md','templates/equation_card.md','templates/derivation_trace.md','templates/dependency_trace.md','templates/proof_walkthrough.md','templates/method_dissection.md','templates/confusion_response.md','templates/recursive_why.md','templates/final_insight.md','templates/visualization_card.md','templates/conceptual_diagram.md','templates/concept_ladder.md','templates/example_walkthrough.md','templates/slide_explanation.md','templates/missing_narration.md','templates/slide_transition.md','templates/interactive_console.md','templates/session_state.json','templates/reading_dashboard.md',
  'examples/korean_equation_explanation.md','examples/derivation_trace_example.md','examples/dependency_trace_example.md','examples/confusion_sign_magnitude_example.md','examples/final_insight_example.md','examples/interactive_session_example.md','examples/turboquant_prerequisite_ladder_example.md','examples/golden_quality_contracts.md',
  'tests/latex_quality_checklist.md','tests/atomic_equation_checklist.md','tests/derivation_trace_checklist.md','tests/dependency_trace_checklist.md','tests/no_handwave_checklist.md','tests/korean_support_checklist.md','tests/visualization_checklist.md','tests/figure_explanation_checklist.md','tests/report_rendering_checklist.md','tests/source_mode_checklist.md','tests/slide_mode_checklist.md','tests/prerequisite_depth_checklist.md',
  'demo/sample-paper.md','demo/sample-session.md','demo/report/index.html','demo/report/assets/drifting-method-demo.svg','demo/outputs/paper_map.md','demo/outputs/equation_card.md','demo/outputs/derivation_trace.md','demo/outputs/final_insight.md'
];

const failures = [];

function writeTinyPdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (Tiny Retrieval Method) Tj',
    '/F1 11 Tf 0 -24 Td (Ada Researcher) Tj',
    '/F1 12 Tf 0 -34 Td (Abstract) Tj',
    '0 -18 Td (This paper builds a retrieval encoder with a margin objective and a calibration metric.) Tj',
    '0 -32 Td (1. Introduction) Tj',
    '0 -18 Td (The method maps queries to vectors and compares them with document vectors.) Tj',
    '0 -32 Td (2. Method) Tj',
    '0 -18 Td (The encoder h: tokens -> vectors and Equation 1 defines a margin objective.) Tj',
    '0 -32 Td (Figure 1. Encoder pipeline.) Tj',
    '0 -18 Td (3. Evaluation) Tj',
    '0 -18 Td (Accuracy and calibration error evaluate retrieval quality.) Tj',
    'ET',
    '0.2 0.37 0.62 RG 72 452 420 74 re S',
    'BT /F1 12 Tf 92 492 Td (query) Tj 108 0 Td (encoder) Tj 128 0 Td (ranking score) Tj ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  writeFileSync(path, pdf);
}

function writeTinyPptxFixture(path) {
  const code = String.raw`
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[5])
slide.shapes.title.text = "Slide 1: Retrieval Encoder Pipeline"
left = Inches(0.9)
top = Inches(1.65)
for i, label in enumerate(["query", "encoder", "ranking score"]):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(i * 2.15), top, Inches(1.55), Inches(0.75))
    shape.text = label
    shape.text_frame.paragraphs[0].font.size = Pt(16)
tx = slide.shapes.add_textbox(Inches(0.9), Inches(3.0), Inches(6.2), Inches(0.6))
tx.text_frame.text = "Figure 1. The slide shows how tokens become retrieval scores."
slide2 = prs.slides.add_slide(prs.slide_layouts[5])
slide2.shapes.title.text = "Slide 2: Evaluation"
body = slide2.shapes.add_textbox(Inches(1), Inches(1.6), Inches(6), Inches(1.2))
body.text_frame.text = "Accuracy and calibration error test the retrieval model."
prs.save(sys.argv[1])
`;
  execFileSync('python3', ['-c', code, path], { stdio: 'pipe' });
}


function writeRepresentativeChoicePdfFixture(path) {
  const stream = [
    'BT',
    '/F1 18 Tf 72 740 Td (Representative Figure Choice) Tj',
    '/F1 12 Tf 0 -36 Td (Abstract) Tj',
    '0 -18 Td (This paper proposes a retrieval method with an encoder pipeline.) Tj',
    '0 -36 Td (Figure 1. Linear Evaluation. Accuracy results on a benchmark.) Tj',
    '0 -32 Td (1. Method) Tj',
    '0 -18 Td (The objective trains the encoder to score relevant documents higher.) Tj',
    '0 -36 Td (Figure 2. Overall method pipeline. The encoder maps queries to vectors and ranks documents.) Tj',
    'ET',
    '0.6 0.2 0.2 RG 72 610 260 32 re S',
    '0.2 0.37 0.62 RG 72 520 420 52 re S'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  writeFileSync(path, pdf);
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function markdownSection(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  const next = start === -1 ? -1 : markdown.indexOf('\n## ', start + 4);
  return start === -1 ? '' : markdown.slice(start, next === -1 ? undefined : next).trim();
}

for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) failures.push(`missing ${rel}`);
  else if (statSync(p).isFile() && readFileSync(p, 'utf8').trim().length < 40) failures.push(`too little content ${rel}`);
}

function parseFrontmatter(rel) {
  const text = readFileSync(join(root, rel), 'utf8');
  if (!text.startsWith('---\n')) {
    failures.push(`${rel} missing YAML frontmatter`);
    return {};
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    failures.push(`${rel} missing closing YAML frontmatter fence`);
    return {};
  }
  const block = text.slice(4, end).trim().split('\n');
  const parsed = {};
  for (const line of block) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (!match) failures.push(`${rel} invalid frontmatter line: ${line}`);
    else parsed[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  const keys = Object.keys(parsed).sort().join(',');
  if (keys !== 'description,name') failures.push(`${rel} frontmatter must contain only description,name; got ${keys}`);
  if (parsed.name !== 'papermentor') failures.push(`${rel} name must be papermentor`);
  if (!parsed.description || parsed.description.length < 80) failures.push(`${rel} description too short for reliable triggering`);
  return parsed;
}

for (const rel of ['SKILL.md', 'skills/papermentor/SKILL.md']) parseFrontmatter(rel);

const readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Claude Code', 'assets/papermentor-demo.svg', 'HTML-first reading room', 'Start in one command', 'preview-crops', 'Try the sample paper', 'Trace a derivation', 'Map a dependency chain', 'Plan a visualization', 'Product boundaries']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const sessionScript = readFileSync(join(root, 'scripts/papermentor-session.mjs'), 'utf8');
for (const phrase of ['Satoshi-400.woff2', 'PretendardVariable.woff2', '@font-face', 'copyBundledReportAssets', 'paper-figure', 'assets/mathjax/tex-svg.js', 'extractFigure', 'previewCrops', 'launchSession', 'inferMetadataFromText', 'pendingBlockPrompt', 'pdftoppm', 'soffice']) {
  if (!sessionScript.includes(phrase)) failures.push(`session renderer missing phrase: ${phrase}`);
}
for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
  if (sessionScript.includes(phrase)) failures.push(`session renderer should not rely on remote font CSS: ${phrase}`);
}

for (const phrase of ['auto crop could not locate Figure', 'boundedInteger', 'uniqueOutputPath', 'clearPendingPrompt', 'shellQuote', 'googleDriveDirectUrl', 'uc?export=download', 'docs.google.com/presentation']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing hardened flow phrase: ${phrase}`);
}
for (const phrase of ['renderPaletteScreen', 'pm <file-or-url>', 'pm open', 'pm ask "question"', 'Claude/Codex-style command palette']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing simplified palette phrase: ${phrase}`);
}
if (/mode\s*===\s*['"]paper['"][\s\S]{0,240}I-JEPA|I-JEPA[\s\S]{0,240}return\s*\[\s*['"`]## Preliminary ladder/.test(sessionScript)) {
  failures.push('session helper must not use a paper-specific I-JEPA preliminary ladder branch');
}
for (const phrase of ['Concept / method role', 'How to read it', 'Parts to identify', 'In-figure math / symbols', 'Equations / claims it supports']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing fixed figure explanation schema phrase: ${phrase}`);
}
for (const phrase of ['follow the visual objects and arrows before reading', 'First name each box/object, then read arrows in order', 'then follow the flow / sequence item in order']) {
  if (sessionScript.includes(phrase)) failures.push(`session helper still ships generic "move your eyes" figure meta-advice instead of a concrete reading: ${phrase}`);
}
if (!sessionScript.includes('Transcribe in LaTeX every equation')) failures.push('session helper figure scaffold should force in-figure math transcription, not generic advice');

// Source-derived explanations (figure reading, one-sentence model, preliminary ladder)
// must be authored by the model/prompt, never synthesised from text by the script.
for (const phrase of ['preliminaryLadderFromText', 'prerequisiteConceptSpecs', 'modePrimitiveLayer', 'detectNotationCandidates', 'abstractSnippet']) {
  if (sessionScript.includes(phrase)) failures.push(`session helper should not synthesise source-derived Start Here content: ${phrase}`);
}
if (!sessionScript.includes('preliminaryLadderScaffold') || !sessionScript.includes('Not built yet')) failures.push('session helper should ship a preliminary-ladder scaffold for the model to fill, not a synthesised ladder');


const mathjaxReadme = readFileSync(join(root, 'assets/mathjax/README.md'), 'utf8');
for (const phrase of ['MathJax v3.2.2', 'Apache License 2.0', 'SHA-256', 'LICENSE.txt']) {
  if (!mathjaxReadme.includes(phrase)) failures.push(`MathJax vendor README missing phrase: ${phrase}`);
}

const prerequisitePrompt = readFileSync(join(root, 'prompts/prerequisite-analyzer.md'), 'utf8');
for (const phrase of ['concrete example', 'one-sentence reconstruction', 'bit', 'binary string', 'unbiased estimator']) {
  if (!prerequisitePrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`prerequisite analyzer missing depth phrase: ${phrase}`);
}

const sectionNavPrompt = readFileSync(join(root, 'prompts/section-navigator.md'), 'utf8');
for (const phrase of ['weak position prior', '--choices', 'word-matching', 'Ask anything about']) {
  if (!sectionNavPrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`section navigator prompt missing phrase: ${phrase}`);
}

const slideNavPrompt = readFileSync(join(root, 'prompts/slide-navigator.md'), 'utf8');
for (const phrase of ['slide image', 'temporal', 'narration', 'build slides', '--choices']) {
  if (!slideNavPrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`slide navigator prompt missing phrase: ${phrase}`);
}

const turboExample = readFileSync(join(root, 'examples/turboquant_prerequisite_ladder_example.md'), 'utf8');
for (const phrase of ['bit', 'binary string', '$\\mathbb{R}^d$', '$\\{0,1\\}^B$', '$Q^{-1}', '$\\mathbb{E}_Q', 'unbiased', 'One-sentence reconstruction']) {
  if (!turboExample.includes(phrase)) failures.push(`TurboQuant ladder example missing phrase: ${phrase}`);
}

const publicDocs = ['README.md', 'SKILL.md', 'skills/papermentor/SKILL.md', 'templates/prerequisite_ladder.md', 'templates/concept_ladder.md', 'templates/start_here.md']
  .map((rel) => readFileSync(join(root, rel), 'utf8'))
  .join('\n');
for (const phrase of ['primitive vocabulary', 'concrete example', 'diagnostic check']) {
  if (!publicDocs.toLowerCase().includes(phrase)) failures.push(`public ladder docs missing phrase: ${phrase}`);
}

const skill = readFileSync(join(root, 'skills/papermentor/SKILL.md'), 'utf8');
for (const phrase of ['LaTeX', 'derivation', 'dependency', 'recursive why', 'Korean', 'visualization', 'conceptual diagram', 'mono-tone SVG', 'Reading Path', 'index.html', 'Satoshi', 'Pretendard', 'Report structure', 'HTML-first']) {
  if (!skill.toLowerCase().includes(phrase.toLowerCase())) failures.push(`skill missing policy phrase: ${phrase}`);
}

for (const rel of ['SKILL.md', 'README.md', 'skills/papermentor/commands.md', 'prompts/visualization-planner.md', 'tests/visualization_checklist.md']) {
  const text = readFileSync(join(root, rel), 'utf8').toLowerCase();
  for (const phrase of ['question', 'concept', 'visual encoding', 'what to observe', 'conclusion', 'limitation']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing visualization contract phrase: ${phrase}`);
  }
}

for (const rel of ['SKILL.md', 'skills/papermentor/SKILL.md', 'skills/papermentor/commands.md', 'prompts/paper-scanner.md', 'templates/paper_map.md', 'tests/figure_explanation_checklist.md']) {
  const text = readFileSync(join(root, rel), 'utf8').toLowerCase();
  for (const phrase of ['exact', 'crop', 'figure', 'method', 'algorithm', 'what to observe', 'mermaid']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing figure explanation phrase: ${phrase}`);
  }
  for (const phrase of ['concept / method role', 'how to read it', 'parts to identify', 'in-figure math / symbols', 'equations / claims it supports']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing fixed figure schema phrase: ${phrase}`);
  }
}

const commandCoverage = [
  ['scan', 'templates/paper_map.md', 'prompts/paper-scanner.md'],
  ['prerequisites', 'templates/prerequisite_ladder.md', 'prompts/prerequisite-analyzer.md'],
  ['equation', 'templates/equation_card.md', 'prompts/equation-analyzer.md'],
  ['derive', 'templates/derivation_trace.md', 'prompts/derivation-tracer.md'],
  ['dependencies', 'templates/dependency_trace.md', 'prompts/dependency-tracer.md'],
  ['proof', 'templates/proof_walkthrough.md', 'prompts/proof-analyzer.md'],
  ['method', 'templates/method_dissection.md', 'prompts/method-analyzer.md'],
  ['confusion', 'templates/confusion_response.md', 'prompts/confusion-resolver.md'],
  ['why', 'templates/recursive_why.md', 'prompts/confusion-resolver.md'],
  ['final-insight', 'templates/final_insight.md', 'prompts/final-insight-extractor.md'],
  ['visualize', 'templates/visualization_card.md', 'prompts/visualization-planner.md'],
  ['diagram', 'templates/conceptual_diagram.md', 'prompts/visualization-planner.md']
];
const commandsText = readFileSync(join(root, 'skills/papermentor/commands.md'), 'utf8');
for (const [command, template, prompt] of commandCoverage) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
  if (!existsSync(join(root, template))) failures.push(`missing template for ${command}: ${template}`);
  if (!existsSync(join(root, prompt))) failures.push(`missing prompt for ${command}: ${prompt}`);
}

for (const command of ['launch', 'start', 'analyze', 'tui', 'sections', 'section', 'mode', 'choose', 'run', 'diagram', 'preview-crops', 'extract-figure', 'render', 'state', 'pause', 'resume', 'turn', 'promote', 'doctor']) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
}

const packageJson = readJson(join(root, 'package.json'), {});
if (packageJson.bin?.papermentor !== 'scripts/papermentor-session.mjs') failures.push('package.json should expose a papermentor CLI bin');
if (packageJson.bin?.pm !== 'scripts/papermentor-session.mjs') failures.push('package.json should expose a pm palette CLI bin');
if (!packageJson.scripts?.launch?.includes('papermentor-session.mjs launch')) failures.push('package.json should expose npm run launch');
const npmIgnore = readFileSync(join(root, '.npmignore'), 'utf8');
for (const phrase of ['.papermentor/', '*.pdf', '*.ppt', '*.pptx', 'papermentor-skill-*.tgz']) {
  if (!npmIgnore.includes(phrase)) failures.push(`.npmignore should exclude local source/package artifact: ${phrase}`);
}

for (const rel of ['docs/ci/github-actions-ci.yml', '.github/workflows/ci.yml']) {
  const ci = readFileSync(join(root, rel), 'utf8');
  for (const phrase of ['poppler-utils', 'libreoffice', 'imagemagick', 'python3-pptx', 'npm test', 'npm pack --dry-run']) {
    if (!ci.includes(phrase)) failures.push(`${rel} missing phrase: ${phrase}`);
  }
}

const golden = readFileSync(join(root, 'examples/golden_quality_contracts.md'), 'utf8');
for (const phrase of ['Golden equation card', 'Golden derivation trace', 'Golden dependency trace', 'Golden confusion repair', 'Golden Korean explanation', 'Symbol table', 'Backward dependencies', 'Missing dependency', 'Reconnection to original text']) {
  if (!golden.includes(phrase)) failures.push(`golden quality contracts missing phrase: ${phrase}`);
}
const goldenContracts = {
  'Golden equation card': ['### Equation', '### Role', '### Symbol table', '### Reconstruction checkpoint', '| Symbol | Meaning | Domain / codomain | Notes |'],
  'Golden derivation trace': ['### Previous equation', '### Next equation', '**What changed:**', '**Operation applied:**', '**Property / theorem / definition used:**', '**Assumption invoked:**', '**Why valid:**'],
  'Golden dependency trace': ['### Backward dependencies', '### Forward dependencies', '### Missing dependency check', '### Recommended explanation order'],
  'Golden confusion repair': ['User question:', 'Paused location:', '### Direct answer', '### Missing dependency', '### Minimal example', '### Reconnection to original text', '### Resume point'],
  'Golden Korean explanation': ['사용자가 한국어로 질문하면', '$\\mathbb{E}$', '원래 논문 위치']
};
for (const [heading, requiredPhrases] of Object.entries(goldenContracts)) {
  const section = markdownSection(golden, heading);
  for (const phrase of requiredPhrases) {
    if (!section.includes(phrase)) failures.push(`${heading} contract missing structural phrase: ${phrase}`);
  }
}

for (const forbidden of ['Compare training-time drifting with inference-time diffusion', 'Explain Proposition 3.1 and why anti-symmetry gives zero drift', 'Connect implementation choices back to the drifting objective']) {
  if (sessionScript.includes(forbidden)) failures.push(`session helper retains paper-specific hardcoded action: ${forbidden}`);
}

function expectedInstalledResources() {
  return [
    'SKILL.md',
    'commands.md',
    'examples.md',
    ...required
      .filter((rel) => rel.startsWith('prompts/') || rel.startsWith('templates/') || rel.startsWith('examples/') || rel.startsWith('tests/') || rel.startsWith('scripts/') || rel.startsWith('assets/'))
  ];
}

function assertInstalledArtifact(dest, label) {
  const installedRequired = expectedInstalledResources();
  for (const rel of installedRequired) {
    if (!existsSync(join(dest, rel))) failures.push(`${label} installed artifact missing ${rel}`);
  }

  for (const dir of ['prompts', 'templates', 'examples', 'tests', 'scripts', 'assets']) {
    const sourceCount = required.filter((rel) => rel.startsWith(`${dir}/`)).length;
    const installedCount = installedRequired.filter((rel) => rel.startsWith(`${dir}/`)).length;
    if (sourceCount !== installedCount) failures.push(`${label} installed ${dir}/ expectation mismatch: ${installedCount} of ${sourceCount}`);
  }
}

function validateInstalledArtifact() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-validate-'));
  try {
    const codexHome = join(temp, '.codex');
    const binDir = join(temp, 'bin');
    execFileSync(join(root, 'install.sh'), ['codex'], { cwd: root, env: { ...process.env, CODEX_HOME: codexHome, PAPERMENTOR_BIN_DIR: binDir }, stdio: 'pipe' });
    assertInstalledArtifact(join(codexHome, 'skills', 'papermentor'), 'codex');
    const installedHelp = execFileSync('papermentor', ['--help'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedHelp.includes('pm <file-or-url>') || !installedHelp.includes('papermentor launch <paper-url-or-file>') || installedHelp.includes('node scripts/papermentor-session.mjs')) failures.push('installed CLI help should use papermentor/pm commands, not development node script paths');
    const installedPalette = execFileSync('pm', ['--help'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedPalette.includes('pm open') || !installedPalette.includes('pm ask')) failures.push('installed pm shortcut should expose simplified palette commands');
    const installedDoctor = execFileSync('papermentor', ['doctor', '--json'], { cwd: temp, env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` }, encoding: 'utf8' });
    if (!installedDoctor.includes('"status": "ok"') || !installedDoctor.includes('"python3-pptx"')) failures.push('installed papermentor doctor should run through the installed CLI shim');

    const claudeHome = join(temp, '.claude');
    execFileSync(join(root, 'install.sh'), ['claude'], { cwd: root, env: { ...process.env, CLAUDE_HOME: claudeHome, PAPERMENTOR_BIN_DIR: binDir }, stdio: 'pipe' });
    assertInstalledArtifact(join(claudeHome, 'skills', 'papermentor'), 'claude');
  } catch (error) {
    failures.push(`install smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateSessionHelper() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-session-'));
  try {
    const helpOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--help'], { cwd: temp, encoding: 'utf8' });
    if (!helpOutput.includes('pm <file-or-url>') || !helpOutput.includes('papermentor launch <paper-url-or-file>')) failures.push('start --help should print simplified help plus advanced pointer');
    if (existsSync(join(temp, '.papermentor'))) failures.push('start --help should not create a session directory');
    const paletteOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'menu', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    if (!paletteOutput.includes('✦ PaperMentor Skill') || !paletteOutput.includes('pm <file>') || !paletteOutput.includes('New reading room from file / URL')) failures.push('menu --snapshot should render the simplified command palette');
    const doctorOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'doctor'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor dependency doctor', 'pdftoppm', 'LibreOffice', 'ImageMagick', 'python3-pptx']) {
      if (!doctorOutput.includes(phrase)) failures.push(`doctor command should report local extraction dependency: ${phrase}`);
    }
    const doctorJson = JSON.parse(execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'doctor', '--json'], { cwd: temp, encoding: 'utf8' }));
    if (doctorJson.status !== 'ok' || doctorJson.checks?.length !== 4) failures.push('doctor --json should report four passing local extraction checks in validation environment');
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Bad Slug', '--slug', '../evil'], { cwd: temp, stdio: 'pipe' });
      failures.push('start should reject path-traversal session slugs');
    } catch {
      // expected
    }
    const figurePath = join(temp, 'exact-pdf-crop-fixture.svg');
    const mapPath = join(temp, 'map.md');
    const equationPath = join(temp, 'equation.md');
    const paperTextPath = join(temp, 'paper.txt');
    // This is a test fixture for attachment/copy/render behavior only. Product guidance rejects
    // Mermaid/redrawn schematics for real papers; real sessions must pass an actual PDF crop.
    writeFileSync(figurePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 280"><rect width="720" height="280" fill="#fbfaf6"/><rect x="26" y="24" width="668" height="210" rx="2" fill="#fff" stroke="#d8d0c3"/><text x="50" y="58" font-family="Times New Roman, serif" font-size="18" fill="#1f2937">Exact PDF crop fixture — replace with actual paper figure in real sessions</text><path d="M68 190 C150 88, 260 92, 338 170 S520 226, 626 112" fill="none" stroke="#222" stroke-width="2.5"/><circle cx="68" cy="190" r="4" fill="#222"/><circle cx="338" cy="170" r="4" fill="#222"/><circle cx="626" cy="112" r="4" fill="#222"/><line x1="68" y1="216" x2="626" y2="216" stroke="#222"/><line x1="68" y1="86" x2="68" y2="216" stroke="#222"/><text x="330" y="254" font-family="Times New Roman, serif" font-size="14" fill="#374151">Figure 1: fixture crop region</text></svg>');
    writeFileSync(mapPath, '## One-sentence paper model\n\nThe paper trains a generator by moving samples with a drifting field.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the training-time generator-to-drift-target loop rather than experiment results.\n- What it shows: the generator, generated samples, real samples, and the drift field.\n- Components: prior samples, generator, generated distribution, target distribution.\n- How to read it: three boxes — prior samples on the left, the generator $f$ in the middle, the data target on the right.\n- In-figure math / symbols: the pushforward $q=f_{\\#}p_{\\epsilon}$ labels the generator output and the drift field $V_{p,q}(x)$ labels the arrows.\n- Flow or sequence: sample, generate, drift, train.\n- What to observe: the field points generated samples toward data structure.\n- Equations or claims it supports: Eq. (6).\n\n## Preliminary ladder\n\n| Prerequisite | Minimal explanation | Used in |\n| --- | --- | --- |\n| Pushforward | $q=f_{\\#}p_{\\epsilon}$ is the generated distribution. | Eq. (1) |\n| Drift field | $V_{p,q}(x)$ moves samples during training. | Eq. (2) |\n\n## CLI-only likely confusion points\n\n- This should stay in CLI/state, not rendered HTML.\n');
    writeFileSync(equationPath, '- **Symbol:** $V_{p,q}$ is the drifting field.\n- **Checkpoint:** explain the update target.\n\n## Likely blockers\n\n- This should also stay in CLI/state, not rendered HTML.\n');
    writeFileSync(paperTextPath, '1. Introduction\nGenerative modeling learns a mapping f such that the pushforward distribution matches the data distribution. The paper proposes Drifting Models, a training-time drifting field, one-step inference, and a contrast with diffusion/flow models.\n\n2. Related Work\nDiffusion-/Flow-based Models. Sohl-Dickstein et al., 2015 and Lipman et al., 2022 formulate iterative mappings. Generative Adversarial Networks. Goodfellow et al., 2014 train a generator adversarially. Variational Autoencoders. Kingma & Welling, 2013 optimize ELBO.\n\n3. Drifting Models for Generation\nWe denote the pushforward distribution as q = f# p epsilon. (1) A sample drifts as xi+1 = xi + Vp,q(xi). (2) Proposition 3.1 uses an anti-symmetric drifting field. The training objective uses stopgrad. (6)\n');
    const launchTextPath = join(temp, 'launch-source.txt');
    writeFileSync(launchTextPath, `TurboQuant: Extreme Quantization for Vector Search
Jane Researcher John Vector

Abstract
This paper designs a quantization map Q from real-valued vectors into binary strings while preserving mean-squared error and inner-product estimates.

1. Introduction
Vector search systems need compact representations.

2. Problem Definition
The quantizer Q maps x in R^d to B bits. Equation (1) defines MSE and Equation (2) defines inner-product distortion.

3. Method
The method uses randomized quantization and unbiased inner-product estimates.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', launchTextPath, '--slug', 'launch-smoke', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const slideLaunchPath = join(temp, 'Lecture 09.md');
    writeFileSync(slideLaunchPath, `sungwoong kim © All rights Reserved. Lecture 09

Slide 1: Diffusion Models
- Why likelihood models are hard to sample from.

Slide 14: DDPM
- Forward noising process.

Slide 15: DDPM
- Reverse denoising model.

Slide 16: DDPM
- Training objective build.

Slide 17: Sampling
- How the reverse chain generates samples.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', slideLaunchPath, '--slug', 'slide-launch-smoke', '--mode', 'slide', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const slideLaunchState = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'state.json'), {});
    const slideLaunchCards = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'cards.json'), { cards: [] });
    const slidePendingPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'pending-prompt.md'), 'utf8');
    if (slideLaunchCards.cards?.length !== 1 || slideLaunchCards.cards?.[0]?.type !== 'reading-guide') failures.push('slide launch should render only the reading guide until the Start Here writer prompt is filled');
    if (slideLaunchState.readingPath?.find((item) => item.key === 'narration')?.status === 'current') failures.push('slide launch should not skip key-slide explanation and jump to narration');
    if (/rights reserved|copyright|©/i.test(slideLaunchState.title || '')) failures.push(`slide title inference should not promote copyright footers, got ${slideLaunchState.title}`);
    if (!slideLaunchState.paperSections?.includes('Slides 14–16 — DDPM')) failures.push(`slide build slides should fold repeated titles into one topic, got ${JSON.stringify(slideLaunchState.paperSections)}`);
    if (slideLaunchState.pendingBlockType !== 'start-here' || !slideLaunchState.startHerePending) failures.push('slide launch should mark Start Here as pending instead of rendering a scaffold');
    for (const phrase of ['Slide Start Here Writer Prompt', 'Topic timeline map', 'Do not output placeholder text', 'Do not use these field names', 'Topic role']) {
      if (!slidePendingPrompt.includes(phrase)) failures.push(`slide Start Here pending prompt missing phrase: ${phrase}`);
    }
    writeFileSync(join(temp, 'slide-start-here.md'), '## One-sentence orientation\n\nThese slides introduce diffusion model sampling.\n\n## Topic timeline map\n\nflow: Diffusion Models -> DDPM -> Sampling\n\n## Preliminary\n\nNo extra prerequisites.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'slide-launch-smoke', '--type', 'start-here', '--title', 'Start Here', '--body-file', join(temp, 'slide-start-here.md')], { cwd: temp, stdio: 'pipe' });
    const slideAfterStartHere = readJson(join(temp, '.papermentor', 'sessions', 'slide-launch-smoke', 'state.json'), {});
    if (!/Diffusion Models/.test(slideAfterStartHere.currentSection || '') || slideAfterStartHere.pendingBlockPrompt) failures.push('slide should enter the first meaningful topic and clear the Start Here prompt after Start Here is filled');
    const launchDir = join(temp, '.papermentor', 'sessions', 'launch-smoke');
    const launchState = readJson(join(launchDir, 'state.json'), {});
    const launchHtml = readFileSync(join(launchDir, 'index.html'), 'utf8');
    if (launchState.title !== 'TurboQuant: Extreme Quantization for Vector Search' || launchState.authors !== 'Jane Researcher, John Vector') failures.push('launch should infer title and authors from source text');
    if (!launchState.paperSections?.some((section) => section.includes('Problem Definition'))) failures.push('launch should detect source sections from one command');
    if (!launchHtml.includes('Jane Researcher, John Vector') || launchHtml.includes(launchTextPath)) failures.push('launch report should show authors and hide source paths');
    if (!launchHtml.includes('How to use this reading room') || !launchHtml.includes('One-sentence orientation') || !(launchHtml.indexOf('How to use this reading room') < launchHtml.indexOf('Start Here'))) failures.push('launch should create a reading guide block before Start Here');
    if (!launchHtml.includes('Preliminary') || !launchHtml.includes('List the prerequisites in order') || (launchHtml.match(/class="ladder-heading"/g) || []).length) failures.push('launch Start Here should ship a preliminary-ladder scaffold for the model to fill, not a script-synthesized ladder');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'launch-smoke', '--paper-text-file', launchTextPath], { cwd: temp, stdio: 'pipe' });
    const genericLaunchState = readJson(join(launchDir, 'state.json'), {});
    const genericLaunchActions = JSON.stringify(genericLaunchState.sectionActions || {});
    for (const forbidden of ['drifting', 'pushforward', 'stopgrad', 'anti-symmetric', 'diffusion-time', 'inference-time diffusion']) {
      if (launchHtml.toLowerCase().includes(forbidden) || genericLaunchActions.toLowerCase().includes(forbidden)) failures.push(`generic TurboQuant launch/analyze leaked Drifting-specific helper text: ${forbidden}`);
    }

    const noisySourcePath = join(temp, 'noisy-source.txt');
    writeFileSync(noisySourcePath, `Noisy OCR Robustness Fixture
Anonymous Copy

Abstract
This document has sparse OCR and no reliable method claim.

COPYRIGHT ALL RIGHTS RESERVED. This page intentionally blank.
Generated by Scanner 0.0. Downloaded from Example Conference Proceedings.
HEADER HEADER HEADER 12 12 12
1. Notes
The source gives too little technical evidence for confident concept extraction.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', noisySourcePath, '--slug', 'noisy-launch-smoke', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const noisyHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'noisy-launch-smoke', 'index.html'), 'utf8');
    const noisyLadderRows = (noisyHtml.match(/class="ladder-heading"/g) || []).length;
    if (noisyLadderRows !== 0 || !noisyHtml.includes('Preliminary')) failures.push(`noisy/malformed launch should ship a static ladder scaffold with no script-synthesized rows, got ${noisyLadderRows} ladder rows`);
    for (const forbidden of ['All Rights Reserved', 'Generated by Scanner', 'Example Conference Proceedings', 'page intentionally blank']) {
      if (noisyHtml.includes(`<h3 class="ladder-heading">`) && noisyHtml.includes(forbidden)) failures.push(`noisy/malformed launch should not promote boilerplate into concept ladder: ${forbidden}`);
    }

    const brokenMathPath = join(temp, 'broken-pdf-math.txt');
    writeFileSync(brokenMathPath, `Self-Supervised Learning from Images with a Joint-Embedding Predictive Architecture
Jane Vision

Abstract
Compared to generative methods that predict in pixel/token space, I-JEPA predicts abstract target representations and learns semantic features.

1. Method
The objective uses M_{i=1} fragments from PDF layout and broken text such as i = 1} {D}\\left and i = 1}\\sum _{j \\in B_i} \\lVert \\hat {\\vs }_{
The clean notation B_i and y_j identify target blocks and representations.
We evaluate I-JEPA with ViT-H and ViT-L encoders in a self-supervised setup.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', brokenMathPath, '--slug', 'broken-math-launch', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const brokenMathHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'broken-math-launch', 'index.html'), 'utf8');
    for (const forbidden of ['i is defined by', '{D}\\left', '\\lVert \\hat', 'M_{i=1}', 'vit-h']) {
      if (brokenMathHtml.includes(forbidden)) failures.push(`broken PDF math should not leak malformed notation/concept into Start Here: ${forbidden}`);
    }
    for (const expected of ['One-sentence orientation', 'Preliminary', 'List the prerequisites in order']) {
      if (!brokenMathHtml.includes(expected)) failures.push(`broken PDF launch should still ship the Start Here scaffold: ${expected}`);
    }

    const representativeChoicePdfPath = join(temp, 'representative-choice-paper.pdf');
    writeRepresentativeChoicePdfFixture(representativeChoicePdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', representativeChoicePdfPath, '--slug', 'representative-choice-pdf', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const representativeChoiceDir = join(temp, '.papermentor', 'sessions', 'representative-choice-pdf');
    const representativeChoiceState = readJson(join(representativeChoiceDir, 'state.json'), {});
    const representativeChoiceCards = readJson(join(representativeChoiceDir, 'cards.json'), { cards: [] });
    if (representativeChoiceState.representativeFigure?.label !== '2') failures.push(`representative figure selection should prefer method Figure 2 over evaluation Figure 1, got ${representativeChoiceState.representativeFigure?.label}`);
    const representativeChoiceStartCard = representativeChoiceCards.cards?.find((card) => card.type === 'start-here');
    if (!/Figure 2/.test(representativeChoiceStartCard?.figure?.caption || '')) failures.push('representative figure selection should pass the selected Figure 2 into Start Here extraction');
    if (representativeChoiceStartCard?.figure?.caption !== 'Figure 2. Representative method figure from the Method section.') failures.push('representative figure selection should use a semantic caption instead of raw PDF text');
    if (representativeChoiceStartCard?.figure?.caption?.includes('encoder maps queries')) failures.push('representative figure visible caption should not reuse raw pdftotext caption text');

    const realPdfPath = join(temp, 'tiny-method-paper.pdf');
    writeTinyPdfFixture(realPdfPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPdfPath, '--slug', 'real-pdf-launch', '--page', '1'], { cwd: temp, stdio: 'pipe' });
    const realPdfDir = join(temp, '.papermentor', 'sessions', 'real-pdf-launch');
    const realPdfState = readJson(join(realPdfDir, 'state.json'), {});
    const realPdfCards = readJson(join(realPdfDir, 'cards.json'), { cards: [] });
    const realPdfHtml = readFileSync(join(realPdfDir, 'index.html'), 'utf8');
    if (realPdfState.sourceMode !== 'paper') failures.push(`real PDF launch should detect paper mode, got ${realPdfState.sourceMode}`);
    if (!realPdfState.paperSections?.some((section) => section.includes('Method'))) failures.push('real PDF launch should detect Method section from extracted PDF text');
    if (!realPdfState.cropPreview || !existsSync(join(realPdfDir, 'crop-preview.html'))) failures.push('real PDF launch should write crop preview evidence');
    const realPdfStartCard = realPdfCards.cards?.find((card) => card.type === 'start-here');
    if (!realPdfStartCard?.figure?.src?.endsWith('.png')) failures.push('real PDF launch should attach a rendered/cropped PNG figure to Start Here');
    for (const phrase of ['Tiny Retrieval Method', 'Preliminary', 'List the prerequisites in order', 'Figure 1. Representative method figure.']) {
      if (!realPdfHtml.includes(phrase)) failures.push(`real PDF launch report missing ${phrase}`);
    }
    for (const forbidden of ['Drifting Models', 'pushforward distribution', 'anti-symmetric drifting field', 'stop-gradient target']) {
      if (realPdfHtml.includes(forbidden)) failures.push(`real PDF Start Here should not leak paper-specific helper concept: ${forbidden}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'real-pdf-launch', '--source', realPdfPath, '--page', '1', '--overwrite'], { cwd: temp, stdio: 'pipe' });
    const realPdfPreviews = readJson(join(realPdfDir, 'crop-previews.json'), { previews: [] });
    if (!realPdfPreviews.previews?.some((preview) => preview.label === 'Full page / slide')) failures.push('real PDF preview-crops should include full-page candidate');
    if (!realPdfPreviews.previews?.some((preview) => /Auto Figure/.test(preview.label))) failures.push('real PDF preview-crops should include auto Figure candidate');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'real-pdf-launch', '--source', realPdfPath, '--page', '1', '--auto', 'figure1', '--title', 'PDF method figure', '--body', '## Extracted visual explanation\n\n- **Question:** What does the retrieval pipeline show?\n- **Concept:** encoder scoring pipeline.\n- **What to observe:** query tokens become ranking scores.\n- **Conclusion:** the method figure anchors the objective explanation.'], { cwd: temp, stdio: 'pipe' });
    const realPdfAfterExtract = readJson(join(realPdfDir, 'cards.json'), { cards: [] });
    if (!realPdfAfterExtract.cards?.some((card) => card.title === 'PDF method figure' && card.figure?.src?.endsWith('.png'))) failures.push('real PDF extract-figure should append a PNG figure card');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPdfPath, '--slug', 'real-pdf-layout-fallback', '--page', '1', '--force-layout-crop', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const layoutFallbackDir = join(temp, '.papermentor', 'sessions', 'real-pdf-layout-fallback');
    const layoutFallbackState = readJson(join(layoutFallbackDir, 'state.json'), {});
    const layoutFallbackCards = readJson(join(layoutFallbackDir, 'cards.json'), { cards: [] });
    if (layoutFallbackState.figureExtractionWarning || layoutFallbackState.figureExtractionFallbackWarning) failures.push('layout fallback crop should avoid visible figure extraction warnings');
    const layoutFallbackStartCard = layoutFallbackCards.cards?.find((card) => card.type === 'start-here');
    if (!layoutFallbackStartCard?.figure?.src?.endsWith('.png')) failures.push('layout fallback crop should attach a Start Here PNG when bbox extraction is unavailable');

    const realPptxPath = join(temp, 'tiny-slide.pptx');
    writeTinyPptxFixture(realPptxPath);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', realPptxPath, '--slug', 'real-pptx-launch', '--mode', 'slide', '--page', '1'], { cwd: temp, stdio: 'pipe' });
    const realPptxDir = join(temp, '.papermentor', 'sessions', 'real-pptx-launch');
    const realPptxState = readJson(join(realPptxDir, 'state.json'), {});
    const realPptxCards = readJson(join(realPptxDir, 'cards.json'), { cards: [] });
    const realPptxHtml = readFileSync(join(realPptxDir, 'index.html'), 'utf8');
    const realPptxPendingPrompt = readFileSync(join(realPptxDir, 'pending-prompt.md'), 'utf8');
    if (realPptxState.sourceMode !== 'slide') failures.push(`real PPTX launch should preserve slide mode, got ${realPptxState.sourceMode}`);
    if (!realPptxState.cropPreview || !existsSync(join(realPptxDir, 'crop-preview.html'))) failures.push('real PPTX launch should write crop preview evidence');
    const realPptxStartCard = realPptxCards.cards?.find((card) => card.type === 'start-here');
    if (realPptxStartCard) failures.push('real PPTX launch should not render a Start Here scaffold before the writer prompt is filled');
    if (!realPptxHtml.includes('How to use this reading room') || realPptxHtml.includes('Not written yet') || realPptxHtml.includes('Topic role')) failures.push('real PPTX launch report should render only non-scaffold HTML before Start Here is filled');
    for (const phrase of ['Slide Start Here Writer Prompt', 'Topic timeline map', 'Do not output placeholder text', 'Do not use these field names']) {
      if (!realPptxPendingPrompt.includes(phrase)) failures.push(`real PPTX pending Start Here prompt missing phrase: ${phrase}`);
    }
    for (const forbidden of ['Drifting Models', 'pushforward distribution', 'anti-symmetric drifting field', 'stop-gradient target']) {
      if (realPptxHtml.includes(forbidden)) failures.push(`real PPTX Start Here should not leak paper-specific helper concept: ${forbidden}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'preview-crops', '--session', 'real-pptx-launch', '--source', realPptxPath, '--page', '1', '--overwrite'], { cwd: temp, stdio: 'pipe' });
    const realPptxPreviews = readJson(join(realPptxDir, 'crop-previews.json'), { previews: [] });
    if (!realPptxPreviews.previews?.some((preview) => preview.label === 'Full page / slide')) failures.push('real PPTX preview-crops should include full-slide candidate');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'real-pptx-launch', '--source', realPptxPath, '--page', '1', '--title', 'PPTX slide visual', '--body', '## Extracted visual explanation\n\n- **Question:** What does this slide show?\n- **Concept:** retrieval encoder pipeline.\n- **What to observe:** the slide flows from query to score.\n- **Conclusion:** this is source slide evidence, not a generated diagram.'], { cwd: temp, stdio: 'pipe' });
    const realPptxAfterExtract = readJson(join(realPptxDir, 'cards.json'), { cards: [] });
    if (!realPptxAfterExtract.cards?.some((card) => card.title === 'PPTX slide visual' && card.figure?.src?.endsWith('.png'))) failures.push('real PPTX extract-figure should append a PNG slide card');

    const goldenFiles = {
      equation: join(temp, 'golden-equation-card.md'),
      derivation: join(temp, 'golden-derivation-trace.md'),
      dependency: join(temp, 'golden-dependency-trace.md'),
      confusion: join(temp, 'golden-confusion-repair.md'),
      korean: join(temp, 'golden-korean-explanation.md')
    };
    writeFileSync(goldenFiles.equation, markdownSection(golden, 'Golden equation card'));
    writeFileSync(goldenFiles.derivation, markdownSection(golden, 'Golden derivation trace'));
    writeFileSync(goldenFiles.dependency, markdownSection(golden, 'Golden dependency trace'));
    writeFileSync(goldenFiles.confusion, markdownSection(golden, 'Golden confusion repair'));
    writeFileSync(goldenFiles.korean, markdownSection(golden, 'Golden Korean explanation'));
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Golden Quality Structural Smoke', '--slug', 'golden-quality-smoke'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'equation', '--title', 'Golden equation card', '--latex', '\\mathcal{R}(f)=\\mathbb{E}_{(x,y)\\sim\\mathcal{D}}[\\ell(f(x),y)]', '--body-file', goldenFiles.equation, '--choices', 'Trace derivation|Map dependencies'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'derivation', '--title', 'Golden derivation trace', '--body-file', goldenFiles.derivation], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'dependency', '--title', 'Golden dependency trace', '--body-file', goldenFiles.dependency], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'confusion', '--title', 'Golden confusion repair', '--user-question', 'Why is the expectation outside the loss?', '--body-file', goldenFiles.confusion], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'golden-quality-smoke', '--type', 'note', '--title', 'Golden Korean explanation', '--body-file', goldenFiles.korean], { cwd: temp, stdio: 'pipe' });
    const goldenDir = join(temp, '.papermentor', 'sessions', 'golden-quality-smoke');
    const goldenHtml = readFileSync(join(goldenDir, 'index.html'), 'utf8');
    const goldenCards = readJson(join(goldenDir, 'cards.json'), { cards: [] });
    if ((goldenHtml.match(/class="block"/g) || []).length !== 5) failures.push('golden quality generated report should render five structural blocks');
    if ((goldenHtml.match(/<table>/g) || []).length < 1 || !goldenHtml.includes('<th>Symbol</th>')) failures.push('golden quality generated report should render the equation symbol table as HTML table structure');
    if ((goldenHtml.match(/<ol>/g) || []).length < 1 || (goldenHtml.match(/<ul>/g) || []).length < 3) failures.push('golden quality generated report should render dependency and explanation lists structurally');
    for (const phrase of ['<h3>Equation</h3>', '<h3>Role</h3>', '<h3>Previous equation</h3>', '<h3>Next equation</h3>', '<h3>Backward dependencies</h3>', '<h3>Forward dependencies</h3>', '<h3>Direct answer</h3>', '<h3>Missing dependency</h3>', '<h3>Reconnection to original text</h3>', 'class="user-question"', '가능한 sample들에 대한 평균']) {
      if (!goldenHtml.includes(phrase)) failures.push(`golden quality generated report missing structural output: ${phrase}`);
    }
    const goldenTypes = (goldenCards.cards || []).map((card) => card.type).join('|');
    if (goldenTypes !== 'equation|derivation|dependency|confusion|note') failures.push(`golden quality cards should preserve ordered block types, got ${goldenTypes}`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Figure Failure Render', '--slug', 'figure-failure-render'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'figure-failure-render', '--type', 'start-here', '--title', 'Start Here', '--body', '## One-sentence orientation\n\nA paper shell.\n\n## Representative figure\n\nPaperMentor could not auto-attach the representative figure. Run crop preview and recrop manually.'], { cwd: temp, stdio: 'pipe' });
    const failureHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'figure-failure-render', 'index.html'), 'utf8');
    if (!failureHtml.includes('could not auto-attach the representative figure') || !failureHtml.includes('Run crop preview')) failures.push('renderer should keep visible auto-crop failure guidance when no figure is attached');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', figurePath, '--slug', 'figure-failure-launch', '--crop', '1,1,999999,999999', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const failureLaunchDir = join(temp, '.papermentor', 'sessions', 'figure-failure-launch');
    const failureLaunchHtml = readFileSync(join(failureLaunchDir, 'index.html'), 'utf8');
    const failureLaunchState = readJson(join(failureLaunchDir, 'state.json'), {});
    if (!failureLaunchHtml.includes('class="paper-figure"') || !failureLaunchHtml.includes('Full-page visual fallback')) failures.push('launch should attach a visual fallback after an extraction failure instead of rendering a broken recrop block');
    if (failureLaunchHtml.includes(temp) || failureLaunchHtml.includes(figurePath) || failureLaunchHtml.includes(String(failureLaunchState.figureExtractionWarning || '___never___'))) failures.push('launch extraction failure guidance should hide absolute paths and raw diagnostic messages from HTML');
    if (!failureLaunchHtml.includes('papermentor preview-crops')) failures.push('launch extraction fallback should point users to the installed preview-crops command');

    const spacedFigurePath = join(temp, 'source with spaces.svg');
    writeFileSync(spacedFigurePath, readFileSync(figurePath, 'utf8'));
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', spacedFigurePath, '--slug', 'spaced-source-failure', '--crop', '1,1,999999,999999', '--no-preview'], { cwd: temp, stdio: 'pipe' });
    const spacedFailureHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'spaced-source-failure', 'index.html'), 'utf8');
    if (!spacedFailureHtml.includes('class="paper-figure"') || spacedFailureHtml.includes('node scripts/papermentor-session.mjs')) failures.push('launch extraction fallback should render a figure and never show development script paths for sources with spaces');

    const serverScript = join(temp, 'serve-once.cjs');
    const portFile = join(temp, 'server-port.txt');
    writeFileSync(serverScript, `const http=require('http');const fs=require('fs');const file=process.argv[2];const portFile=process.argv[3];const server=http.createServer((req,res)=>{res.setHeader('content-type','text/plain');res.end(fs.readFileSync(file));});server.listen(0,'127.0.0.1',()=>fs.writeFileSync(portFile,String(server.address().port)));`);
    const server = spawn('node', [serverScript, launchTextPath, portFile], { cwd: temp, stdio: 'ignore' });
    try {
      for (let i = 0; i < 50 && !existsSync(portFile); i += 1) execFileSync('node', ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50)']);
      const port = readFileSync(portFile, 'utf8').trim();
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', `http://127.0.0.1:${port}/launch-source.txt`, '--slug', 'launch-url-smoke', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'launch', `http://127.0.0.1:${port}/launch-source.txt`, '--slug', 'launch-url-smoke-2', '--no-figure', '--no-preview'], { cwd: temp, stdio: 'pipe' });
      const sourceFiles = readdirSync(join(temp, '.papermentor', 'sources')).filter((name) => name.endsWith('.txt'));
      if (sourceFiles.length !== 1) failures.push(`URL launch should reuse deterministic source cache, got ${sourceFiles.join(',')}`);
      const urlHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'launch-url-smoke', 'index.html'), 'utf8');
      if (urlHtml.includes('127.0.0.1') || urlHtml.includes('/launch-source.txt')) failures.push('URL launch HTML should not expose source URL or cached source path');
    } finally {
      server.kill();
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Generative Modeling via Drifting', '--authors', 'Mingyang Deng, He Li, Tianhong Li, Yilun Du, Kaiming He', '--source', 'paper.pdf', '--sections', '1. Introduction|2. Related Work|3. Drifting Models for Generation', '--body-file', mapPath, '--figure-file', figurePath, '--figure-caption', 'Exact crop of Figure 1 from the paper.'], { cwd: temp, stdio: 'pipe' });
    let navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.paperSections?.length !== 3 || navState.nextChoices?.[2] !== '3. Drifting Models for Generation') failures.push('start should seed detected paper sections for the CLI navigator');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.currentSection !== '3. Drifting Models for Generation' || !navState.nextChoices?.some((choice) => choice.includes('Decode key equations'))) failures.push('section command should show section-local action choices');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'generative-modeling-via-drifting', '--mode', 'equations', '--items', 'Explain Eq. (1) pushforward symbol by symbol|Explain Eq. (6) training objective symbol by symbol'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.currentMode !== 'equations' || navState.detectedItems?.length !== 2 || !navState.nextChoices?.[0]?.includes('Eq. (1)')) failures.push('mode command should store dynamic section-local equation choices');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'generative-modeling-via-drifting', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    // Paper section menus are generic plumbing (no word-matching / scoring); the model
    // tailors them on entry by reading the section and re-running `section --choices`.
    for (const key of ['1-introduction', '2-related-work', '3-drifting-models-for-generation']) {
      const acts = navState.sectionActions?.[key] || [];
      if (!acts.some((c) => c.includes('Ask anything about')) || !acts.some((c) => c.includes('Decode key equations'))) failures.push(`analyze should seed a generic uniform section menu for ${key}`);
      if (acts.some((c) => /pushforward distribution|Sohl-Dickstein|Map equation dependencies|Unpack "/.test(c))) failures.push(`paper section menu must not be word-matched/scored: ${key}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3', '--choices', 'Explain Eq. (10): attraction minus repulsion|Ask anything about 3. Drifting Models for Generation'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.nextChoices?.[0] !== 'Explain Eq. (10): attraction minus repulsion') failures.push('section --choices should let the model set a tailored menu on entry (model-classified navigation)');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'generative-modeling-via-drifting', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const tuiSnapshot = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'generative-modeling-via-drifting', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor Skill', 'command palette', '↑/↓ move', 'Enter select', 'o open HTML', 'pm open']) {
      if (!tuiSnapshot.includes(phrase)) failures.push(`TUI snapshot missing phrase: ${phrase}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'generative-modeling-via-drifting', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.lastChoiceKind !== 'section' || navState.pendingBlockPrompt || existsSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'))) failures.push('run should select a section without writing a pending HTML prompt');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'generative-modeling-via-drifting', '--mode', 'equations', '--items', 'Explain Eq. (6) $(touch should-not-run) symbol by symbol|Ask anything about Eq. (6)'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'generative-modeling-via-drifting', '--index', '1'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const pendingPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'), 'utf8');
    if (!navState.pendingBlockPrompt || !pendingPrompt.includes('PaperMentor HTML Block Runner Prompt') || !pendingPrompt.includes('Template to follow')) failures.push('run command should write a pending HTML block-generation prompt for action choices');
    if (!pendingPrompt.includes("--title 'Explain Eq. (6) $(touch should-not-run) symbol by symbol'") || existsSync(join(temp, 'should-not-run'))) failures.push('runner prompt should shell-quote dynamic action titles without executing them');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'generative-modeling-via-drifting', '--source', figurePath, '--title', 'Representative method crop', '--caption', 'Figure 1. Method loop.', '--body', '## Extracted visual explanation\n\n- **Question:** What is the method loop?\n- **Concept:** generator-to-drift target.\n- **What to observe:** the generator is trained against a target.\n- **Conclusion:** this figure anchors the method explanation.'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.pendingBlockPrompt || existsSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'))) failures.push('adding a card should clear consumed pending runner prompt state');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'extract-figure', '--session', 'generative-modeling-via-drifting', '--source', figurePath, '--title', 'Representative method crop', '--caption', 'Figure 1. Method loop.', '--body', '## Extracted visual explanation\n\n- **Question:** What changed?\n- **Concept:** repeated crop.\n- **What to observe:** filename remains unique.\n- **Conclusion:** older cards are not overwritten.'], { cwd: temp, stdio: 'pipe' });
    const dir = join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting');
    for (const rel of ['index.html', 'state.json', 'cards.json', 'turns.jsonl', 'notes.md']) {
      if (!existsSync(join(dir, rel))) failures.push(`session helper missing ${rel}`);
    }
    const htmlFilesAfterFirst = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFilesAfterFirst.length !== 1 || htmlFilesAfterFirst[0] !== 'index.html') failures.push(`session helper should create exactly one HTML file, got ${htmlFilesAfterFirst.join(',')}`);
    let html = readFileSync(join(dir, 'index.html'), 'utf8');
    let cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if (!html.includes('Mingyang Deng, He Li, Tianhong Li, Yilun Du, Kaiming He')) failures.push('session title header should show paper authors');
    if (html.includes('paper.pdf') || html.includes('paper-source')) failures.push('session title header should not expose source file paths under the title');
    if ((html.match(/class="block"/g) || []).length < 1) failures.push('session helper should render at least one block after first card');
    if (!html.includes('assets/mathjax/tex-svg.js') || html.includes('cdn.jsdelivr.net/npm/mathjax')) failures.push('session HTML should use local bundled MathJax, not CDN');
    if (!existsSync(join(dir, 'assets', 'mathjax', 'tex-svg.js'))) failures.push('session should copy local MathJax bundle into report assets');
    for (const phrase of [`Main ${'method'} figure`, 'Figure explanation under image']) {
      if (html.includes(phrase)) failures.push(`session paper map should move the figure explanation under the image and remove the body heading: ${phrase}`);
    }
    if (!html.includes('class="paper-figure"') || !html.includes('<img src="assets/')) failures.push('session paper map should render the actual method figure image');
    if (!html.includes('fitPaperMentorStartFigure') || !html.includes('--papermentor-start-image-max-height') || !html.includes('--papermentor-start-figure-max-width')) failures.push('session report should include dynamic first-page figure fitting for PDF export');
    if (html.includes('loading="lazy"')) failures.push('session report figures should load eagerly for reliable browser screenshots and first-open rendering');
    if (!(html.indexOf('One-sentence paper model') < html.indexOf('class="paper-figure"') && html.indexOf('class="paper-figure"') < html.indexOf('Preliminary'))) failures.push('Start Here should render one-sentence model first, then representative figure, then preliminaries');
    for (const phrase of ['Figure 1', 'Concept / method role', 'How to read it', 'Parts to identify', 'In-figure math / symbols', 'Flow / sequence', 'What to observe', 'Equations / claims it supports']) {
      if (!html.includes(phrase)) failures.push(`session paper map should render figure explanation under image: ${phrase}`);
    }
    for (const phrase of ['Exact crop of Figure 1 from the paper.', 'Figure from the paper.']) {
      if (html.includes(phrase)) failures.push(`session paper map should suppress provenance-only figure captions: ${phrase}`);
    }
    for (const rel of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!existsSync(join(dir, rel))) failures.push(`session helper should copy bundled report font into session: ${rel}`);
    }
    for (const phrase of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!html.includes(phrase)) failures.push(`session HTML should load local bundled font: ${phrase}`);
    }
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
      if (html.includes(phrase)) failures.push(`session HTML should not depend on remote font CSS: ${phrase}`);
    }
    if (!cardData.cards?.[0]?.figure?.src?.startsWith('assets/')) failures.push('session card should persist copied figure asset metadata');
    if (!existsSync(join(dir, cardData.cards?.[0]?.figure?.src || 'missing'))) failures.push('session helper should copy figure file into session assets');
    cardData.cards[0].figure.caption = 'Exact crop of Figure 1 from the paper: legacy caption.';
    writeFileSync(join(dir, 'cards.json'), `${JSON.stringify(cardData, null, 2)}\n`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'status', '--session', 'generative-modeling-via-drifting'], { cwd: temp, stdio: 'pipe' });
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    if (html.includes('Exact crop of Figure 1 from the paper: legacy caption.')) failures.push('session renderer should suppress provenance-only captions already stored in legacy cards.json');
    const notes = readFileSync(join(dir, 'notes.md'), 'utf8');
    if (!notes.includes('![Start Here figure](assets/')) failures.push('session notes should include the attached figure link');
    if (notes.includes('Exact crop of Figure 1 from the paper.')) failures.push('session notes should suppress provenance-only figure captions');
    if (notes.includes('## Figure explanation under image')) failures.push('session notes should move the figure explanation under the image and remove the heading');
    const renderOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'render', '--session', 'generative-modeling-via-drifting'], { cwd: temp, encoding: 'utf8' });
    if (!renderOutput.includes('.papermentor/sessions/generative-modeling-via-drifting/index.html')) failures.push('render command should print the refreshed block document path');
    const stateOutput = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'state', '--session', 'generative-modeling-via-drifting'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor state', 'Location', 'Blocks in HTML', 'Source mode:']) {
      if (!stateOutput.includes(phrase)) failures.push(`state command should print Reading Console phrase: ${phrase}`);
    }
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'pause', '--session', 'generative-modeling-via-drifting', '--question', 'Why does Eq. (6) freeze the target branch?'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    const pausePrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md'), 'utf8');
    if (!navState.pausedReading?.location || !pausePrompt.includes('Answer interruption: Why does Eq. (6) freeze the target branch?')) failures.push('pause command should preserve reading location and write a pending interruption prompt');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'resume', '--session', 'generative-modeling-via-drifting', '--repaired', 'stop-gradient target branch'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (navState.pausedReading || existsSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'pending-prompt.md')) || !navState.currentFocus?.includes('Resumed from')) failures.push('resume command should restore the paused location and clear pending interruption state');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'generative-modeling-via-drifting', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'diagram', '--session', 'generative-modeling-via-drifting', '--kind', 'equation-dependency', '--nodes', 'Eq. (1) pushforward|Eq. (2) drift update|Eq. (6) training objective'], { cwd: temp, stdio: 'pipe' });
    let diagramHtml = readFileSync(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'index.html'), 'utf8');
    let diagramCards = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'cards.json'), { cards: [] });
    const diagramCard = diagramCards.cards?.find((card) => card.type === 'concept-diagram');
    if (!diagramCard?.figure?.src?.endsWith('.svg')) failures.push('diagram command should create a concept-diagram card with an SVG figure');
    if (diagramHtml.includes('mermaid')) failures.push('diagram command should not use Mermaid');
    for (const phrase of ['Conceptual diagram generated by PaperMentor', 'Not a figure from the paper', 'Question', 'Visual encoding', 'What to observe', 'Conclusion', 'Limitation']) {
      if (!diagramHtml.includes(phrase)) failures.push(`diagram block missing required phrase: ${phrase}`);
    }

    const badDiagramPath = join(temp, 'bad-mermaid.md');
    writeFileSync(badDiagramPath, `${'```'}${'mermaid'}\n${'flowchart'} ${'TD'}\nA-->B\n${'```'}\n`);
    try {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'paper-map', '--title', 'Bad diagram substitute', '--body-file', badDiagramPath], { cwd: temp, stdio: 'pipe' });
      failures.push('session helper should reject Mermaid/flowchart diagram substitutes in report bodies');
    } catch {
      // expected: representative figures must be actual crops/screenshots or prose, not Mermaid substitutes.
    }

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'turn', '--session', 'generative-modeling-via-drifting', '--role', 'user', '--text', '전체 흐름이 안 보여. Eq. (1)이 Eq. (6)이랑 어떻게 연결돼?', '--promote', '--reason', 'paper equation confusion'], { cwd: temp, stdio: 'pipe' });
    navState = readJson(join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting', 'state.json'), {});
    if (!navState.nextChoices?.some((choice) => choice.includes('Generate conceptual diagram'))) failures.push('turn logging should suggest visual repair when user confusion asks for flow/dependency');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'turn', '--session', 'generative-modeling-via-drifting', '--role', 'assistant', '--text', 'It freezes the drift target branch so the generator output moves toward a fixed target.', '--promote', '--saved-as', 'confusion-003'], { cwd: temp, stdio: 'pipe' });
    const turns = readFileSync(join(dir, 'turns.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    if (turns.length !== 2 || turns[0].promotion !== 'promote' || turns[1].savedAs !== 'confusion-003') failures.push('turns.jsonl should record promoted user/assistant turns with metadata');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'equation', '--title', 'Equation (6)', '--latex', '\mathcal{L}=\mathbb{E}\|x-\operatorname{stopgrad}(x+V_{p,q}(x))\|^2', '--user-question', 'Why is stopgrad used in Eq. (6)?', '--origin-turn', 'turn-001', '--promotion-reason', 'paper equation confusion', '--body-file', equationPath, '--choices', 'Trace derivation|Explain stopgrad'], { cwd: temp, stdio: 'pipe' });
    const htmlFiles = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFiles.length !== 1 || htmlFiles[0] !== 'index.html') failures.push(`session helper should keep exactly one HTML file, got ${htmlFiles.join(',')}`);
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((cardData.cards || []).length !== 5) failures.push('session helper should persist five cards after repeated extraction, diagram, and equation card');
    for (const requiredField of ['id', 'type', 'title', 'location', 'userQuestion', 'originTurn', 'promotionReason', 'body', 'choices', 'createdAt']) {
      if (!(requiredField in (cardData.cards?.[0] || {}))) failures.push(`session card should keep structured report field: ${requiredField}`);
    }
    if (!cardData.schema || !cardData.cards?.[0]?.figure?.src) failures.push('session cards.json should keep schema and figure asset data');
    const extractedFigureSrcs = (cardData.cards || []).filter((card) => card.title === 'Representative method crop').map((card) => card.figure?.src).filter(Boolean);
    if (new Set(extractedFigureSrcs).size !== extractedFigureSrcs.length) failures.push('repeated extract-figure calls should create unique asset filenames, not overwrite older cards');
    if (cardData.cards?.[4]?.userQuestion !== 'Why is stopgrad used in Eq. (6)?' || cardData.cards?.[4]?.originTurn !== 'turn-001') failures.push('promoted conversation cards should persist user question and origin turn metadata');
    if ((html.match(/class="block"/g) || []).length !== 5) failures.push('session helper should render five blocks after repeated extraction, diagram, and equation card');
    for (const phrase of ['MathJax', 'Generative Modeling via Drifting', 'Equation block — Eq. (6)', 'User question', 'Why is stopgrad used in Eq. (6)?', 'class="user-question"', 'class="paper-title"', 'class="block"', 'class="paper-figure"', 'data-index="1"', 'data-index="2"', 'data-index="3"', 'data-index="4"', 'data-index="5"']) {
      if (!html.includes(phrase)) failures.push(`session block document missing ${phrase}`);
    }
    for (const phrase of ['Reading Path', 'Choose next', 'class="sidebar"', 'class="topbar"', 'session-head', 'CLI-only likely confusion points', 'Likely blockers', 'This should stay in CLI/state', 'This should also stay in CLI/state', 'Block 01', 'Block 02', 'updated ']) {
      if (html.includes(phrase)) failures.push(`session block document should not render CLI-only content, timestamps, block badges, or dashboard chrome: ${phrase}`);
    }
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(html)) failures.push('session block document should not display ISO timestamps');

    const koreanMapPath = join(temp, 'korean-map.md');
    const koreanEquationPath = join(temp, 'korean-equation.md');
    writeFileSync(koreanMapPath, '## 이 논문이 하는 일\n\n이 논문은 생성 분포 $q_i$가 학습 중에 데이터 분포 $p_{\\mathrm{data}}$ 쪽으로 이동하도록 generator $f$를 훈련한다.\n\n## 그림 설명\n\n- 그림 / 위치: Figure 1, Drifting Model.\n- 무엇을 보여주는가: 주황색 생성 분포 $q_i$가 학습 반복마다 파란색 데이터 분포 $p_{\\mathrm{data}}$에 가까워지는 과정을 보여준다.\n- 보는 법: 왼쪽 prior, 가운데 generator $f$, 오른쪽 데이터 분포 $p_{\\mathrm{data}}$ 세 부분으로 읽는다.\n- 그림 속 수식 / 기호: 그림 안에 pushforward $q=f_{\\#}p_{\\mathrm{prior}}$와 화살표 위의 drift field $V_{p,q}(x)$가 적혀 있다.\n- 흐름 / 순서: prior에서 샘플을 뽑고 → $f$로 pushforward 분포를 만들고 → drift field로 이동 방향을 정하고 → $f$를 업데이트한다.\n- 관찰할 점: inference 때 반복 샘플러를 돌리는 것이 아니라, 학습 중 $f$ 자체가 반복적으로 바뀐다는 점이다.\n- 연결되는 수식 / 주장: $q=f_{\\#}p_{\\mathrm{prior}}$, 분포열 $\\{q_i\\}$, 그리고 drift가 0에 가까워지게 만드는 training objective.\n\n## 핵심 객체\n\n- $p_{\\mathrm{prior}}$ — 생성 전에 샘플링하는 source distribution.\n- $f$ — prior sample을 데이터 공간으로 보내는 generator.\n- $V_{p,q}(x)$ — 현재 샘플 $x$를 어느 방향으로 움직일지 알려주는 drift field.\n\n## 의존성 체인\n\n1. pushforward $q=f_{\\#}p_{\\mathrm{prior}}$를 이해한다.\n2. 학습을 분포열 $q_1,q_2,\\ldots$의 변화로 본다.\n3. drift field $V_{p,q}(x)$가 왜 필요한지 연결한다.\n');
    writeFileSync(koreanEquationPath, '## 수식이 하는 일\n\n이 블록은 training objective이 왜 등장하는지 설명한다. $V_{p,q}(x)$는 이동 목표를 만들고, $\\operatorname{stopgrad}$는 그 목표 쪽으로 gradient가 새지 않도록 고정한다.\n\n## 기호 역할\n\n- $x$ — 현재 generator가 만든 sample.\n- $V_{p,q}(x)$ — sample을 이동시키는 drift vector.\n- $\\|\\cdot\\|_2^2$ — 이동 목표와 현재 sample 사이의 제곱 거리.\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', '드리프팅을 통한 생성 모델링', '--source', 'https://arxiv.org/pdf/2602.04770', '--slug', 'korean-report'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'paper-map', '--title', '논문 지도', '--figure-file', figurePath, '--figure-caption', 'Figure 1. Drifting Model.', '--body-file', koreanMapPath, '--choices', '수식 (6) 설명|stopgrad 설명|의존성 추적'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'equation', '--title', 'Training objective — Eq. (6)', '--latex', '\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x+V_{p,q}(x))\\right\\|_2^2\\right]', '--body-file', koreanEquationPath, '--choices', '유도 추적|기호 설명'], { cwd: temp, stdio: 'pipe' });
    const koreanDir = join(temp, '.papermentor', 'sessions', 'korean-report');
    const koreanHtml = readFileSync(join(koreanDir, 'index.html'), 'utf8');
    const koreanCards = readJson(join(koreanDir, 'cards.json'), { cards: [] });
    const koreanNotes = readFileSync(join(koreanDir, 'notes.md'), 'utf8');
    for (const phrase of ['<html lang="ko">', 'Satoshi', 'Pretendard', 'assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2', ':lang(ko)', 'word-break:keep-all']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should load/apply report typography: ${phrase}`);
    }
    for (const rel of ['assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!existsSync(join(koreanDir, rel))) failures.push(`Korean report should have local bundled font asset: ${rel}`);
    }
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should not depend on remote font CSS: ${phrase}`);
    }
    const awkwardObjective = '학습' + ' ' + '목적' + '식';
    for (const phrase of ['그림 설명', 'Figure explanation under image', `Main ${'method'} figure`, awkwardObjective, `목적${'식'} — Eq. (6)`]) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should remove headings/provenance/awkward terms: ${phrase}`);
    }
    for (const phrase of ['주황색 생성 분포', '개념 / 방법 역할', '보는 법', '그림 속 수식 / 기호', '흐름 / 순서', '관찰할 점', '연결되는 수식 / 주장', 'Training objective — Eq. (6)', 'training objective', 'gradient']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should keep structured Korean explanation content and standard English terms: ${phrase}`);
    }
    if ((koreanHtml.match(/class="block"/g) || []).length !== 2) failures.push('Korean report should render two ordered report blocks');
    if ((koreanHtml.match(/<ol>/g) || []).length < 1) failures.push('Korean report should render ordered dependency lists structurally');
    if (koreanCards.cards?.length !== 2 || koreanCards.cards?.[0]?.type !== 'paper-map' || koreanCards.cards?.[1]?.type !== 'equation') failures.push('Korean cards.json should keep ordered structured card types');
    if (!koreanNotes.includes('보는 법') || koreanNotes.includes('## 그림 설명')) failures.push('Korean notes.md should mirror figure explanation under the image without the heading');
    const exportZip = join(temp, 'korean-report-export.zip');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'export', '--session', 'korean-report', '--output', exportZip, '--overwrite'], { cwd: temp, stdio: 'pipe' });
    if (!existsSync(exportZip) || statSync(exportZip).size < 1000) failures.push('export command should write a non-empty portable report zip');
    const zipList = execFileSync('python3', ['-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', exportZip], { encoding: 'utf8' });
    for (const rel of ['index.html', 'assets/mathjax/tex-svg.js', 'assets/fonts/pretendard/PretendardVariable.woff2', 'cards.json', 'notes.md', 'state.json']) {
      if (!zipList.includes(rel)) failures.push(`export zip missing ${rel}`);
    }
    if (zipList.includes('paper.pdf') || zipList.includes('source.pdf')) failures.push('export zip should not include original source PDF by default');
  } catch (error) {
    failures.push(`session helper smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateSourceModes() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-modes-'));
  try {
    const slideText = join(temp, 'slides.txt');
    const paperText = join(temp, 'paper.txt');
    writeFileSync(slideText, `Slide 1: Sequence Modeling and Transformers
- Robot learning needs policies over observation-action histories.
- Attention lets a model select relevant tokens.

Slide 2: Decision Transformer
- Treat reinforcement learning as sequence modeling.
- Return-to-go conditions the action sequence.
- Return-to-go is G_t = r_t + r_{t+1} + ...
- Citation: Chen et al., 2021.

Slide 3: Transformer Policy Diagram
- image tokens -> encoder -> action decoder
- arrows show information flow
- robot trajectory visual

Slide 4: Missing Narration
- Why this matters for imitation learning
- How the architecture connects to behavior cloning`);
    writeFileSync(paperText, `Abstract
We propose a method for generative modeling.

1. Introduction
This paper introduces a pushforward distribution and a drift field.

2. Method
The pushforward distribution is q=f#p. (1) The training objective uses stopgrad. (6)

3. Experiments
FID and ablations evaluate sample quality.`);

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Robot Learning Transformer Slides', '--source', 'lecture-slides.pdf', '--slug', 'robot-slides'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'robot-slides', '--paper-text-file', slideText], { cwd: temp, stdio: 'pipe' });
    let state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.sourceMode !== 'slide') failures.push(`slide source mode not detected: ${state.sourceMode}`);
    const slideActions = Object.values(state.sectionActions || {}).flat();
    for (const phrase of ['Reconstruct the', 'builds on the earlier slides', 'Continue to the next slide', 'Chat about this slide']) {
      if (!slideActions.some((action) => action.includes(phrase))) failures.push(`slide actions missing ${phrase}`);
    }
    const slideTui = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'robot-slides', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    if (!slideTui.includes('Slides') || !slideTui.includes('PaperMentor Skill') || !slideTui.includes('command palette')) failures.push('slide TUI should show the slide command palette');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'robot-slides', '--index', '2'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'robot-slides', '--index', '3'], { cwd: temp, stdio: 'pipe' });
    const slidePendingActionPrompt = readFileSync(join(temp, '.papermentor', 'sessions', 'robot-slides', 'pending-prompt.md'), 'utf8');
    if (!slidePendingActionPrompt.includes('Source excerpt for this selected range') || !slidePendingActionPrompt.includes('G_t = r_t')) failures.push('slide action prompt should include the selected slide range text/equation preview');
    const slideBodyPath = join(temp, 'slide-explanation.md');
    writeFileSync(slideBodyPath, '## Slide role\n\nExplain the Transformer policy diagram.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'robot-slides', '--type', 'slide-explanation', '--title', 'Slide explanation — Transformer policy diagram', '--body-file', slideBodyPath], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.readingPath?.find((item) => item.key === 'slides')?.status !== 'done') failures.push('slide slide explanation should complete the slides reading-path step');
    if (state.readingPath?.find((item) => item.key === 'narration')?.status !== 'current') failures.push('slide slide explanation should advance to missing narration');

    const numberedOnlySlideText = join(temp, 'numbered-only-slides.txt');
    writeFileSync(numberedOnlySlideText, `Slide 1: Convex Optimization
- Why convexity matters.

Slide 2: 1. Introduction
- Optimization problem form.

Slide 3: Optimization problem
- minimize f_0(x) subject to f_i(x) <= 0.

Slide 4: Summary
- Convex problems can be solved reliably.

Slide 5: 2. Convex sets
- Sets closed under convex combinations.

Slide 6: Convex set
- theta x + (1-theta)y stays in C.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Numbered Only Slides', '--source', 'numbered-only-slides.pdf', '--slug', 'numbered-only-slides', '--mode', 'slide'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'numbered-only-slides', '--mode', 'slide', '--paper-text-file', numberedOnlySlideText], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'numbered-only-slides', 'state.json'), {});
    if (state.paperSections?.some((section) => /^Slides 2–4 — 1\. Introduction|^Slides 5–6 — 2\. Convex sets/.test(section))) failures.push('slide grouping should not infer semantic sections from numbered titles; the LLM regroup prompt owns that judgment');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Method Paper', '--source', 'paper.pdf', '--slug', 'method-paper'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'method-paper', '--paper-text-file', paperText], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'method-paper', 'state.json'), {});
    if (state.sourceMode !== 'paper') failures.push(`paper source mode not detected: ${state.sourceMode}`);

    const repoText = ['README.md', 'SKILL.md', 'skills/papermentor/SKILL.md', 'skills/papermentor/commands.md'].map((rel) => readFileSync(join(root, rel), 'utf8')).join('\n').toLowerCase();
  } catch (error) {
    failures.push(`source mode smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function commandAvailable(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function pythonPackageAvailable(packageName) {
  try {
    execFileSync('python3', ['-c', `import ${packageName}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function validatePptxExtractionWhenAvailable() {
  if (!commandAvailable('soffice') || !pythonPackageAvailable('pptx')) return;

  const temp = mkdtempSync(join(tmpdir(), 'papermentor-pptx-'));
  try {
    const pptxPath = join(temp, 'papermentor-smoke.pptx');
    const makeSlidePath = join(temp, 'make_slides.py');
    writeFileSync(makeSlidePath, `from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
slide = prs.slides.add_slide(prs.slide_layouts[6])

bg = slide.background
fill = bg.fill
fill.solid()
fill.fore_color.rgb = RGBColor(251, 250, 246)

title = slide.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12.0), Inches(0.7))
tf = title.text_frame
tf.text = "PaperMentor PPTX Smoke: Method Slide"
p = tf.paragraphs[0]
p.font.size = Pt(30)
p.font.bold = True
p.font.color.rgb = RGBColor(34, 34, 34)

items = [
    ("Upload paper / slides", 0.8),
    ("Detect section / slide", 3.7),
    ("Choose action in TUI", 6.6),
    ("Append HTML block", 9.5),
]
for text, left in items:
    box = slide.shapes.add_shape(1, Inches(left), Inches(2.35), Inches(2.35), Inches(1.25))
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(255, 255, 255)
    box.line.color.rgb = RGBColor(64, 64, 64)
    frame = box.text_frame
    frame.text = text
    frame.paragraphs[0].font.size = Pt(16)
    frame.paragraphs[0].font.bold = True
    frame.paragraphs[0].font.color.rgb = RGBColor(31, 31, 31)

for left in [3.25, 6.15, 9.05]:
    arrow = slide.shapes.add_shape(33, Inches(left), Inches(2.72), Inches(0.35), Inches(0.4))
    arrow.fill.solid()
    arrow.fill.fore_color.rgb = RGBColor(74, 74, 74)
    arrow.line.color.rgb = RGBColor(74, 74, 74)

footer = slide.shapes.add_textbox(Inches(0.85), Inches(5.3), Inches(11.6), Inches(0.7))
footer.text_frame.text = "This slide verifies real PPTX → PDF → PNG extraction through LibreOffice soffice."
footer.text_frame.paragraphs[0].font.size = Pt(16)
footer.text_frame.paragraphs[0].font.color.rgb = RGBColor(80, 80, 80)

prs.save(${JSON.stringify(pptxPath)})
`);
    execFileSync('python3', [makeSlidePath], { cwd: temp, stdio: 'pipe' });

    execFileSync('node', [
      join(root, 'scripts', 'papermentor-session.mjs'),
      'start',
      '--title',
      'PPTX Smoke Slide',
      '--slug',
      'pptx-smoke',
      '--source',
      pptxPath,
      '--mode',
      'slide'
    ], { cwd: temp, stdio: 'pipe' });

    const previewOutput = execFileSync('node', [
      join(root, 'scripts', 'papermentor-session.mjs'),
      'preview-crops',
      '--session',
      'pptx-smoke',
      '--source',
      pptxPath,
      '--page',
      '1',
      '--title',
      'Slide 1 — Full method pipeline',
      '--overwrite'
    ], { cwd: temp, encoding: 'utf8' });
    const previewHtmlPath = join(temp, '.papermentor', 'sessions', 'pptx-smoke', 'crop-preview.html');
    const previewJsonPath = join(temp, '.papermentor', 'sessions', 'pptx-smoke', 'crop-previews.json');
    const previewHtml = readFileSync(previewHtmlPath, 'utf8');
    const previewData = readJson(previewJsonPath, { previews: [] });
    if (!previewOutput.includes('Crop preview written')) failures.push('preview-crops should print the preview path');
    if (!previewHtml.includes('Crop preview') || !previewHtml.includes('Full page / slide')) failures.push('preview-crops should render a visual preview HTML');
    if (previewHtml.includes(temp) || previewHtml.includes(pptxPath)) failures.push('crop preview HTML should not leak absolute local source paths');
    if (!previewData.previews?.length || !previewData.previews?.[0]?.command?.includes('extract-figure')) failures.push('preview-crops should persist recrop commands');
    if (JSON.stringify(previewData).includes(temp) || JSON.stringify(previewData).includes(pptxPath)) failures.push('crop preview metadata should use relative/session source paths, not absolute paths');

    execFileSync('node', [
      join(root, 'scripts', 'papermentor-session.mjs'),
      'extract-figure',
      '--session',
      'pptx-smoke',
      '--source',
      pptxPath,
      '--page',
      '1',
      '--title',
      'Slide 1 — Full method pipeline',
      '--caption',
      'Slide 1. Full method pipeline.',
      '--body',
      '## Slide explanation\n\n- **Question:** What does this slide verify?\n- **Concept:** PPTX-to-reading-room extraction.\n- **What to observe:** the entire slide is preserved without clipping.\n- **Conclusion:** slide sessions can attach real converted visuals.'
    ], { cwd: temp, stdio: 'pipe' });

    const sessionDir = join(temp, '.papermentor', 'sessions', 'pptx-smoke');
    const htmlPath = join(sessionDir, 'index.html');
    const cardsPath = join(sessionDir, 'cards.json');
    const assetsDir = join(sessionDir, 'assets');
    const html = readFileSync(htmlPath, 'utf8');
    const data = readJson(cardsPath, { cards: [] });
    const pngs = readdirSync(assetsDir).filter((name) => name.endsWith('.png') && !name.startsWith('crop-preview-'));
    if (pngs.length !== 1) failures.push(`pptx extraction should create one PNG asset, got ${pngs.length}`);
    if (pngs.length === 1) {
      const pngPath = join(assetsDir, pngs[0]);
      const fileOutput = execFileSync('file', [pngPath], { encoding: 'utf8' });
      if (!fileOutput.includes('PNG image data')) failures.push('pptx extraction asset should be a PNG image');
      const dims = fileOutput.match(/PNG image data,\s*(\d+)\s*x\s*(\d+)/);
      if (!dims) failures.push(`pptx extraction should expose PNG dimensions: ${fileOutput.trim()}`);
      else if (Number(dims[1]) < 1600 || Number(dims[2]) < 900) failures.push(`pptx extraction PNG unexpectedly small: ${dims[1]}x${dims[2]}`);
    }
    if (!html.includes('class="paper-figure"')) failures.push('pptx extraction should render the converted slide as a paper figure');
    if (!html.includes('Slide 1 — Full method pipeline')) failures.push('pptx extraction HTML should include the slide explanation title');
    if (!html.includes('assets/mathjax/tex-svg.js')) failures.push('pptx extraction report should use local MathJax');
    if (data.cards?.length !== 1 || data.cards?.[0]?.type !== 'slide-explanation') failures.push('pptx extraction should persist a slide-explanation card for slide mode');

    execFileSync('soffice', ['--headless', '--convert-to', 'ppt', '--outdir', temp, pptxPath], { cwd: temp, stdio: 'pipe' });
    const pptPath = join(temp, 'papermentor-smoke.ppt');
    if (!existsSync(pptPath)) failures.push('legacy .ppt fixture conversion should create a .ppt file');
    else {
      execFileSync('node', [
        join(root, 'scripts', 'papermentor-session.mjs'),
        'start',
        '--title',
        'Legacy PPT Smoke Slide',
        '--slug',
        'legacy-ppt-smoke',
        '--source',
        pptPath,
        '--mode',
        'slide'
      ], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [
        join(root, 'scripts', 'papermentor-session.mjs'),
        'extract-figure',
        '--session',
        'legacy-ppt-smoke',
        '--source',
        pptPath,
        '--page',
        '1',
        '--title',
        'Legacy PPT slide',
        '--caption',
        'Slide 1. Legacy PPT smoke.',
        '--body',
        '## Slide explanation\n\n- **Question:** Does legacy PPT extraction work?\n- **Concept:** LibreOffice converts PPT to PDF, then PaperMentor renders a slide image.\n- **What to observe:** the full slide is preserved.\n- **Conclusion:** PPT works through the same extraction path.'
      ], { cwd: temp, stdio: 'pipe' });
      const legacySessionDir = join(temp, '.papermentor', 'sessions', 'legacy-ppt-smoke');
      const legacyHtml = readFileSync(join(legacySessionDir, 'index.html'), 'utf8');
      const legacyCards = readJson(join(legacySessionDir, 'cards.json'), { cards: [] });
      const legacyPngs = readdirSync(join(legacySessionDir, 'assets')).filter((name) => name.endsWith('.png') && !name.startsWith('crop-preview-'));
      if (legacyPngs.length !== 1) failures.push(`legacy .ppt extraction should create one PNG asset, got ${legacyPngs.length}`);
      if (legacyPngs.length === 1) {
        const fileOutput = execFileSync('file', [join(legacySessionDir, 'assets', legacyPngs[0])], { encoding: 'utf8' });
        const dims = fileOutput.match(/PNG image data,\s*(\d+)\s*x\s*(\d+)/);
        if (!fileOutput.includes('PNG image data')) failures.push('legacy .ppt extraction asset should be a PNG image');
        else if (dims && (Number(dims[1]) < 1600 || Number(dims[2]) < 900)) failures.push(`legacy .ppt extraction PNG unexpectedly small: ${dims[1]}x${dims[2]}`);
      }
      if (!legacyHtml.includes('Legacy PPT slide') || !legacyHtml.includes('class="paper-figure"')) failures.push('legacy .ppt extraction should render a slide figure block');
      if (legacyCards.cards?.length !== 1 || legacyCards.cards?.[0]?.type !== 'slide-explanation') failures.push('legacy .ppt extraction should persist a slide-explanation card');
    }
  } catch (error) {
    failures.push(`pptx extraction smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateAllBlockTypes() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-all-blocks-'));
  try {
    const figurePath = join(temp, 'representative-figure.svg');
    writeFileSync(figurePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 260"><rect width="720" height="260" fill="#fffef9"/><rect x="50" y="52" width="150" height="74" fill="#eef2f8" stroke="#405f9f"/><rect x="286" y="52" width="150" height="74" fill="#fff" stroke="#405f9f"/><rect x="520" y="52" width="150" height="74" fill="#eef2f8" stroke="#405f9f"/><path d="M214 89h58M450 89h58" stroke="#405f9f" stroke-width="4"/><text x="125" y="95" text-anchor="middle" font-family="Arial" font-size="18">prior</text><text x="361" y="95" text-anchor="middle" font-family="Arial" font-size="18">generator</text><text x="595" y="95" text-anchor="middle" font-family="Arial" font-size="18">data</text><text x="54" y="210" font-family="Times New Roman" font-size="16">Figure 1: representative method fixture</text></svg>');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Block Coverage Report', '--source', 'fixture-paper.pdf', '--slug', 'block-coverage-report'], { cwd: temp, stdio: 'pipe' });
    const bodies = {
      'paper-map': '## What this paper is doing\n\nThe paper trains a generator by moving samples toward a target distribution.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the method flow rather than experiment results.\n- What it shows: prior samples pass through a generator and approach the data distribution.\n- Flow or sequence: prior sample → generator → pushforward distribution → data target.\n- What to observe: training changes the generator, not an inference-time sampler.\n- Equations or claims it supports: Eq. (6).',
      prerequisite: '## Target concept\n\nDrift field $V_{p,q}(x)$.\n\n## Ladder\n\n### 1. Distribution $q$\n\nUnderstand a distribution $q$.\n\n### 2. Pushforward $q=f_{\\#}p_{\\mathrm{prior}}$\n\nUnderstand how a function moves a prior distribution.\n\n### 3. Vector field $V_{p,q}(x)$\n\nUnderstand the direction assigned to each generated sample.\n\n## Readiness check\n\nYou should be able to say what object moves and what defines the direction.',
      method: '## Method mechanism\n\n1. Sample $z\\sim p_{\\mathrm{prior}}$.\n2. Produce $x=f(z)$.\n3. Estimate $V_{p,q}(x)$.\n4. Update $f$ against the training objective.\n\n## Method-level final insight\n\nThe method learns a one-pass generator by turning distribution matching into a drift target.',
      equation: '## Equation role\n\nThis training objective makes the generator output imitate a stop-gradient drift target.\n\n## Symbol roles\n\n- $x$ — generated sample.\n- $V_{p,q}(x)$ — drift vector.\n- $\\operatorname{stopgrad}$ — fixed target operator.',
      derivation: '## Transition\n\n### Previous equation\n\n$$x^{+}=x+V_{p,q}(x)$$\n\n### Next equation\n\n$$\\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x^{+})\\right\\|_2^2\\right]$$\n\n- Operation: substitute $x^{+}$.\n- Property used: definition of the drift target.\n- Assumption invoked: target is fixed by $\\operatorname{stopgrad}$.\n- Why valid: the target branch should not receive gradient.',
      dependency: '## Backward dependencies\n\n- Definition of pushforward.\n- Definition of drift field.\n- Stop-gradient training target.\n\n## Forward dependencies\n\n- Training objective.\n- Equilibrium claim.\n\n## Missing dependency check\n\nThe reader must know why $q=p_{\\mathrm{data}}$ implies near-zero drift.',
      proof: '## Proof strategy\n\nShow that when the generated distribution equals the data distribution, the expected drift vanishes.\n\n## Line-by-line proof table\n\n| Line | Claim | Dependency |\n| --- | --- | --- |\n| 1 | $q=p_{\\mathrm{data}}$ | equilibrium assumption |\n| 2 | $V_{p,q}(x)\\approx 0$ | drift definition |\n| 3 | objective is minimized | squared norm nonnegativity |',
      confusion: '## Paused location\n\nEq. (6), inside $\\operatorname{stopgrad}(x+V_{p,q}(x))$.\n\n## Missing dependency\n\nThe user is missing why the target branch is frozen.\n\n## Minimal example\n\nIf both prediction and target move together, the loss can collapse without learning the intended direction.\n\n## Resume point\n\nReturn to Eq. (6) and trace which side receives gradient.',
      'recursive-why': '## Recursive why\n\n| Layer | Why question | Answer | Missing dependency | Stop? |\n| --- | --- | --- | --- | --- |\n| 1 | Why stopgrad? | Freeze target. | gradient flow | no |\n| 2 | Why freeze target? | Avoid chasing a moving target. | optimization objective | yes |\n\n## Root dependency\n\nUnderstand which computational graph branch receives gradient.',
      visualization: '## Visualization card\n\n- Question: Why does drift move samples toward data?\n- Concept: vector field on generated samples.\n- Visual encoding: arrows from generated points to nearby data structure.\n- What to observe: arrows shrink as distributions match.\n- Conclusion: the field is a conceptual guide for training.\n- Limitation: this does not prove convergence.',
      'final-insight': '## One-sentence final insight\n\nThe paper trains a one-pass generator by converting distribution mismatch into a stop-gradient drift target.\n\n## Equation map\n\n- $q=f_{\\#}p_{\\mathrm{prior}}$ defines generated distribution.\n- Eq. (6) trains against the drift target.\n\n## Dependency chain\n\nPushforward → drift field → stop-gradient target → training objective → final generator.'
    };
    const cards = [
      ['paper-map', 'Paper map', bodies['paper-map'], ['--figure-file', figurePath, '--figure-caption', 'Figure 1. Method flow.']],
      ['prerequisite', 'Prerequisite ladder — Drift field', bodies.prerequisite, []],
      ['method', 'Method dissection — Drifting Model', bodies.method, []],
      ['equation', 'Training objective — Eq. (6)', bodies.equation, ['--latex', '\\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x+V_{p,q}(x))\\right\\|_2^2\\right]']],
      ['derivation', 'Derivation trace — Drift target to Eq. (6)', bodies.derivation, []],
      ['dependency', 'Dependency trace — Eq. (6)', bodies.dependency, []],
      ['proof', 'Proof walkthrough — Zero drift claim', bodies.proof, []],
      ['confusion', 'Confusion repair — stopgrad', bodies.confusion, ['--user-question', 'Why is stopgrad used here?', '--origin-turn', 'turn-009']],
      ['recursive-why', 'Recursive why — stopgrad', bodies['recursive-why'], []],
      ['visualization', 'Visualization card — Drift field', bodies.visualization, []],
      ['final-insight', 'Final insight', bodies['final-insight'], []]
    ];
    for (const [type, title, body, extra] of cards) {
      const bodyPath = join(temp, `${type}.md`);
      writeFileSync(bodyPath, body);
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'block-coverage-report', '--type', type, '--title', title, '--body-file', bodyPath, '--choices', 'Continue|Ask confusion', ...extra], { cwd: temp, stdio: 'pipe' });
    }
    const dir = join(temp, '.papermentor', 'sessions', 'block-coverage-report');
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const data = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((html.match(/class="block"/g) || []).length !== cards.length) failures.push(`all-block report should render ${cards.length} blocks`);
    if (data.cards?.length !== cards.length) failures.push(`all-block cards.json should persist ${cards.length} cards`);
    for (const [type, title] of cards) {
      if (!data.cards?.some((card) => card.type === type && card.title === title)) failures.push(`all-block cards.json missing ${type}: ${title}`);
      if (!html.includes(title)) failures.push(`all-block HTML missing title: ${title}`);
    }
    for (const phrase of ['Prerequisite ladder', 'Method dissection', 'Training objective', 'Derivation trace', 'Dependency trace', 'Proof walkthrough', 'Confusion repair', 'Recursive why', 'Visualization card', 'Final insight']) {
      if (!html.includes(phrase)) failures.push(`all-block HTML missing stage phrase: ${phrase}`);
    }
    for (const phrase of ['MathJax', 'assets/mathjax/tex-svg.js', '<ol>', '<table>', '<th>Line</th>', 'User question', 'Why is stopgrad used here?', 'class="paper-figure"', 'assets/fonts/satoshi/Satoshi-400.woff2', 'assets/fonts/pretendard/PretendardVariable.woff2']) {
      if (!html.includes(phrase)) failures.push(`all-block HTML missing structural phrase: ${phrase}`);
    }
    if (!html.includes('class="ladder-heading"')) failures.push('all-block HTML should style numbered ladder headings for long prerequisite ladders');
    if (html.includes('학습' + ' ' + '목적' + '식')) failures.push('all-block HTML should not contain awkward Korean technical phrasing');
    if (html.includes('Block 01') || /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(html)) failures.push('all-block HTML should not display block badges or ISO timestamps');
  } catch (error) {
    failures.push(`all-block report smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validatePaperStageRunnerPrompts() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-paper-stages-'));
  try {
    const paperTextPath = join(temp, 'stage-paper.txt');
    writeFileSync(paperTextPath, `Stage Runner Verification Paper
Ada Verifier

Abstract
This paper learns a calibrated retrieval scorer with a margin objective, a projected update, and a proof that the margin gap decreases.

1. Introduction
The reader needs a map of why retrieval scoring, calibration, and a margin gap are connected.

2. Method
The encoder h_theta maps a query q and document d to vectors. Equation (1) defines the margin objective L(theta)=E[max(0, m - s(q,d+) + s(q,d-))]. Equation (2) updates theta_{t+1}=Pi_C(theta_t - eta grad L(theta_t)). Algorithm 1 alternates scoring positives and negatives, then applying the projected update.

3. Theory
Proposition 1 states that the projected update decreases the margin gap under a Lipschitz gradient assumption. Proof. By convexity, L(theta') >= L(theta)+grad L(theta)^T(theta'-theta). The projection step and the step-size bound give the one-step decrease.

4. Discussion
The final insight is that calibration is not a post-processing trick; it is enforced by the training objective and the proof assumptions.`);
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Stage Runner Verification Paper', '--source', 'stage-paper.pdf', '--slug', 'paper-stage-runner'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'paper-stage-runner', '--paper-text-file', paperTextPath], { cwd: temp, stdio: 'pipe' });
    const sessionDir = join(temp, '.papermentor', 'sessions', 'paper-stage-runner');
    const cases = [
      ['Build concept ladder from first principles for the margin objective', 'prerequisite', 'templates/prerequisite_ladder.md', 'L(theta)=E', '2. Method'],
      ['Explain the method pipeline in 2. Method', 'method', 'templates/method_dissection.md', 'Algorithm 1', '2. Method'],
      ['Explain Eq. (1) margin objective symbol by symbol', 'equation', 'templates/equation_card.md', 'Eq. (1)', '2. Method'],
      ['Trace derivation from Eq. (1) to Eq. (2)', 'derivation', 'templates/derivation_trace.md', 'Eq. (2)', '2. Method'],
      ['Connect dependencies for Proposition 1', 'dependency', 'templates/dependency_trace.md', 'Proposition 1', '3. Theory'],
      ['Walk through proof of Proposition 1 line by line', 'proof', 'templates/proof_walkthrough.md', 'Proof. By convexity', '3. Theory'],
      ['Ask anything about why projection is allowed', 'confusion', 'templates/confusion_response.md', 'missing dependency', '3. Theory'],
      ['Recursive why chain for the projection assumption', 'recursive-why', 'templates/recursive_why.md', 'projection', '3. Theory'],
      ['Draw dependency diagram for Eq. (1) to Proposition 1', 'visualization', 'templates/visualization_card.md', 'Proposition 1', '3. Theory'],
      ['Extract final insight one-sentence', 'final-insight', 'templates/final_insight.md', 'final insight', '4. Discussion']
    ];

    for (const [action, expectedType, expectedTemplate, expectedLocalSignal, section] of cases) {
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'section', '--session', 'paper-stage-runner', '--section', section], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'mode', '--session', 'paper-stage-runner', '--mode', expectedType, '--items', action], { cwd: temp, stdio: 'pipe' });
      execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'run', '--session', 'paper-stage-runner', '--index', '1'], { cwd: temp, stdio: 'pipe' });
      const state = readJson(join(sessionDir, 'state.json'), {});
      const prompt = readFileSync(join(sessionDir, 'pending-prompt.md'), 'utf8');
      if (state.sourceMode !== 'paper') failures.push(`paper-stage runner should stay in paper mode for ${expectedType}`);
      if (state.pendingBlockType !== expectedType) failures.push(`paper-stage runner mapped "${action}" to ${state.pendingBlockType}, expected ${expectedType}`);
      for (const phrase of [
        'PaperMentor HTML Block Runner Prompt',
        `--type '${expectedType}'`,
        expectedTemplate,
        'Mode: Paper',
        section,
        'Equation / notation preview from this selected range',
        'Source excerpt for this selected range',
        'Show every non-trivial equation in LaTeX',
        expectedLocalSignal
      ]) {
        if (!prompt.includes(phrase)) failures.push(`paper-stage pending prompt for ${expectedType} missing phrase: ${phrase}`);
      }
      if (prompt.includes('Mode: Slides') || prompt.includes('templates/slide_')) failures.push(`paper-stage pending prompt for ${expectedType} should not leak slide-mode templates`);
    }
  } catch (error) {
    failures.push(`paper-stage runner prompt smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

validatePaperStageRunnerPrompts();
validateInstalledArtifact();
validateSessionHelper();
validateSourceModes();
validatePptxExtractionWhenAvailable();
validateAllBlockTypes();

if (failures.length) {
  console.error('PaperMentor validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PaperMentor validation passed (${required.length} required files checked).`);

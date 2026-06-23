import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'README.md','SKILL.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','install.sh','install.ps1','package.json','assets/papermentor-hero.svg','assets/papermentor-demo.svg','assets/social-preview.svg','assets/fonts/README.md','assets/fonts/satoshi/Satoshi-300.woff2','assets/fonts/satoshi/Satoshi-400.woff2','assets/fonts/satoshi/Satoshi-500.woff2','assets/fonts/satoshi/Satoshi-700.woff2','assets/fonts/satoshi/Satoshi-900.woff2','assets/fonts/pretendard/PretendardVariable.woff2','assets/mathjax/README.md','assets/mathjax/LICENSE.txt','assets/mathjax/tex-svg.js','scripts/papermentor-session.mjs',
  'prompts/paper-scanner.md','prompts/source-mode-detector.md','prompts/lecture-note-scanner.md','prompts/slide-deck-scanner.md','prompts/prerequisite-analyzer.md','prompts/equation-analyzer.md','prompts/derivation-tracer.md','prompts/dependency-tracer.md','prompts/proof-analyzer.md','prompts/method-analyzer.md','prompts/confusion-resolver.md','prompts/final-insight-extractor.md','prompts/visualization-planner.md',
  'skills/papermentor/SKILL.md','skills/papermentor/commands.md','skills/papermentor/examples.md',
  'templates/start_here.md','templates/lecture_note_start_here.md','templates/slide_deck_start_here.md','templates/paper_map.md','templates/prerequisite_ladder.md','templates/equation_card.md','templates/derivation_trace.md','templates/dependency_trace.md','templates/proof_walkthrough.md','templates/method_dissection.md','templates/confusion_response.md','templates/recursive_why.md','templates/final_insight.md','templates/visualization_card.md','templates/conceptual_diagram.md','templates/concept_ladder.md','templates/example_walkthrough.md','templates/slide_explanation.md','templates/missing_narration.md','templates/slide_transition.md','templates/interactive_console.md','templates/session_state.json','templates/reading_dashboard.md',
  'examples/korean_equation_explanation.md','examples/derivation_trace_example.md','examples/dependency_trace_example.md','examples/confusion_sign_magnitude_example.md','examples/final_insight_example.md','examples/interactive_session_example.md','examples/turboquant_prerequisite_ladder_example.md',
  'tests/latex_quality_checklist.md','tests/atomic_equation_checklist.md','tests/derivation_trace_checklist.md','tests/dependency_trace_checklist.md','tests/no_handwave_checklist.md','tests/korean_support_checklist.md','tests/visualization_checklist.md','tests/figure_explanation_checklist.md','tests/report_rendering_checklist.md','tests/source_mode_checklist.md','tests/lecture_note_mode_checklist.md','tests/slide_deck_mode_checklist.md','tests/prerequisite_depth_checklist.md',
  'demo/sample-paper.md','demo/sample-session.md','demo/outputs/paper_map.md','demo/outputs/equation_card.md','demo/outputs/derivation_trace.md','demo/outputs/final_insight.md'
];

const failures = [];

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return fallback; }
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
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Claude Code', 'assets/papermentor-demo.svg', 'HTML-first reading room', 'Try the sample paper', 'Trace a derivation', 'Map a dependency chain', 'Plan a visualization', 'Product boundaries']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const sessionScript = readFileSync(join(root, 'scripts/papermentor-session.mjs'), 'utf8');
for (const phrase of ['Satoshi-400.woff2', 'PretendardVariable.woff2', '@font-face', 'copyBundledReportAssets', 'paper-figure', 'assets/mathjax/tex-svg.js', 'extractFigure', 'pendingBlockPrompt', 'pdftoppm', 'soffice']) {
  if (!sessionScript.includes(phrase)) failures.push(`session renderer missing phrase: ${phrase}`);
}
for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css', 'cdn.jsdelivr.net/npm/mathjax']) {
  if (sessionScript.includes(phrase)) failures.push(`session renderer should not rely on remote font CSS: ${phrase}`);
}

for (const phrase of ['auto crop could not locate Figure', 'boundedInteger', 'uniqueOutputPath', 'clearPendingPrompt', 'shellQuote']) {
  if (!sessionScript.includes(phrase)) failures.push(`session helper missing hardened flow phrase: ${phrase}`);
}


const mathjaxReadme = readFileSync(join(root, 'assets/mathjax/README.md'), 'utf8');
for (const phrase of ['MathJax v3.2.2', 'Apache License 2.0', 'SHA-256', 'LICENSE.txt']) {
  if (!mathjaxReadme.includes(phrase)) failures.push(`MathJax vendor README missing phrase: ${phrase}`);
}

const prerequisitePrompt = readFileSync(join(root, 'prompts/prerequisite-analyzer.md'), 'utf8');
for (const phrase of ['Primitive vocabulary', 'Notation decoding', 'concrete example', 'one-sentence reconstruction', 'bit', 'binary string', 'unbiased estimator']) {
  if (!prerequisitePrompt.toLowerCase().includes(phrase.toLowerCase())) failures.push(`prerequisite analyzer missing depth phrase: ${phrase}`);
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

for (const command of ['start', 'analyze', 'tui', 'sections', 'section', 'mode', 'choose', 'run', 'diagram', 'extract-figure', 'render', 'state', 'pause', 'resume', 'turn', 'promote']) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
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
    execFileSync(join(root, 'install.sh'), ['codex'], { cwd: root, env: { ...process.env, CODEX_HOME: codexHome }, stdio: 'pipe' });
    assertInstalledArtifact(join(codexHome, 'skills', 'papermentor'), 'codex');

    const claudeHome = join(temp, '.claude');
    execFileSync(join(root, 'install.sh'), ['claude'], { cwd: root, env: { ...process.env, CLAUDE_HOME: claudeHome }, stdio: 'pipe' });
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
    if (!helpOutput.includes('Usage:')) failures.push('start --help should print usage');
    if (existsSync(join(temp, '.papermentor'))) failures.push('start --help should not create a session directory');
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
    writeFileSync(mapPath, '## One-sentence paper model\n\nThe paper trains a generator by moving samples with a drifting field.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the training-time generator-to-drift-target loop rather than experiment results.\n- What it shows: the generator, generated samples, real samples, and the drift field.\n- Components: prior samples, generator, generated distribution, target distribution.\n- Flow or sequence: sample, generate, drift, train.\n- What to observe: the field points generated samples toward data structure.\n- Equations or claims it supports: Eq. (6).\n\n## Preliminary ladder\n\n| Prerequisite | Minimal explanation | Used in |\n| --- | --- | --- |\n| Pushforward | $q=f_{\\#}p_{\\epsilon}$ is the generated distribution. | Eq. (1) |\n| Drift field | $V_{p,q}(x)$ moves samples during training. | Eq. (2) |\n\n## CLI-only likely confusion points\n\n- This should stay in CLI/state, not rendered HTML.\n');
    writeFileSync(equationPath, '- **Symbol:** $V_{p,q}$ is the drifting field.\n- **Checkpoint:** explain the update target.\n\n## Likely blockers\n\n- This should also stay in CLI/state, not rendered HTML.\n');
    writeFileSync(paperTextPath, '1. Introduction\nGenerative modeling learns a mapping f such that the pushforward distribution matches the data distribution. The paper proposes Drifting Models, a training-time drifting field, one-step inference, and a contrast with diffusion/flow models.\n\n2. Related Work\nDiffusion-/Flow-based Models. Sohl-Dickstein et al., 2015 and Lipman et al., 2022 formulate iterative mappings. Generative Adversarial Networks. Goodfellow et al., 2014 train a generator adversarially. Variational Autoencoders. Kingma & Welling, 2013 optimize ELBO.\n\n3. Drifting Models for Generation\nWe denote the pushforward distribution as q = f# p epsilon. (1) A sample drifts as xi+1 = xi + Vp,q(xi). (2) Proposition 3.1 uses an anti-symmetric drifting field. The training objective uses stopgrad. (6)\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Generative Modeling via Drifting', '--source', 'paper.pdf', '--sections', '1. Introduction|2. Related Work|3. Drifting Models for Generation', '--body-file', mapPath, '--figure-file', figurePath, '--figure-caption', 'Exact crop of Figure 1 from the paper.'], { cwd: temp, stdio: 'pipe' });
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
    if (!navState.sectionActions?.['1-introduction']?.some((choice) => choice.includes('pushforward distribution'))) failures.push('analyze should generate Introduction actions from section concepts');
    if (!navState.sectionActions?.['2-related-work']?.some((choice) => choice.includes('Sohl-Dickstein et al., 2015'))) failures.push('analyze should generate Related Work actions from citations');
    if (!navState.sectionActions?.['3-drifting-models-for-generation']?.some((choice) => choice.includes('Eq. (6) training objective'))) failures.push('analyze should generate method equation actions from section equations');
    if (!navState.sectionActions?.['3-drifting-models-for-generation']?.some((choice) => choice.includes('Map equation dependencies'))) failures.push('analyze should suggest visual repair diagram actions for equation-heavy method sections');
    const tuiSnapshot = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'generative-modeling-via-drifting', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    for (const phrase of ['PaperMentor Live', 'Claude-like start surface', '↑/↓ select', 'Enter choose', 'Ask/chat are first-class choices']) {
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
    if ((html.match(/class="block"/g) || []).length < 1) failures.push('session helper should render at least one block after first card');
    if (!html.includes('assets/mathjax/tex-svg.js') || html.includes('cdn.jsdelivr.net/npm/mathjax')) failures.push('session HTML should use local bundled MathJax, not CDN');
    if (!existsSync(join(dir, 'assets', 'mathjax', 'tex-svg.js'))) failures.push('session should copy local MathJax bundle into report assets');
    for (const phrase of [`Main ${'method'} figure`, 'Figure explanation under image']) {
      if (html.includes(phrase)) failures.push(`session paper map should move the figure explanation under the image and remove the body heading: ${phrase}`);
    }
    if (!html.includes('class="paper-figure"') || !html.includes('<img src="assets/')) failures.push('session paper map should render the actual method figure image');
    if (!(html.indexOf('One-sentence paper model') < html.indexOf('class="paper-figure"') && html.indexOf('class="paper-figure"') < html.indexOf('Preliminary ladder'))) failures.push('Start Here should render one-sentence model first, then representative figure, then preliminaries');
    for (const phrase of ['Figure 1', 'Read it as', 'The key observation', 'This visual anchors']) {
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
    writeFileSync(koreanMapPath, '## 이 논문이 하는 일\n\n이 논문은 생성 분포 $q_i$가 학습 중에 데이터 분포 $p_{\\mathrm{data}}$ 쪽으로 이동하도록 generator $f$를 훈련한다.\n\n## 그림 설명\n\n- 그림 / 위치: Figure 1, Drifting Model.\n- 무엇을 보여주는가: 주황색 생성 분포 $q_i$가 학습 반복마다 파란색 데이터 분포 $p_{\\mathrm{data}}$에 가까워지는 과정을 보여준다.\n- 흐름 / 순서: prior에서 샘플을 뽑고 → $f$로 pushforward 분포를 만들고 → drift field로 이동 방향을 정하고 → $f$를 업데이트한다.\n- 관찰할 점: inference 때 반복 샘플러를 돌리는 것이 아니라, 학습 중 $f$ 자체가 반복적으로 바뀐다는 점이다.\n- 연결되는 수식 / 주장: $q=f_{\\#}p_{\\mathrm{prior}}$, 분포열 $\\{q_i\\}$, 그리고 drift가 0에 가까워지게 만드는 training objective.\n\n## 핵심 객체\n\n- $p_{\\mathrm{prior}}$ — 생성 전에 샘플링하는 source distribution.\n- $f$ — prior sample을 데이터 공간으로 보내는 generator.\n- $V_{p,q}(x)$ — 현재 샘플 $x$를 어느 방향으로 움직일지 알려주는 drift field.\n\n## 의존성 체인\n\n1. pushforward $q=f_{\\#}p_{\\mathrm{prior}}$를 이해한다.\n2. 학습을 분포열 $q_1,q_2,\\ldots$의 변화로 본다.\n3. drift field $V_{p,q}(x)$가 왜 필요한지 연결한다.\n');
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
    for (const phrase of ['주황색 생성 분포', '읽는 법:', '핵심 관찰:', '연결되는 내용:', 'Training objective — Eq. (6)', 'training objective', 'gradient']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should keep structured Korean explanation content and standard English terms: ${phrase}`);
    }
    if ((koreanHtml.match(/class="block"/g) || []).length !== 2) failures.push('Korean report should render two ordered report blocks');
    if ((koreanHtml.match(/<ol>/g) || []).length < 1) failures.push('Korean report should render ordered dependency lists structurally');
    if (koreanCards.cards?.length !== 2 || koreanCards.cards?.[0]?.type !== 'paper-map' || koreanCards.cards?.[1]?.type !== 'equation') failures.push('Korean cards.json should keep ordered structured card types');
    if (!koreanNotes.includes('읽는 법:') || koreanNotes.includes('## 그림 설명')) failures.push('Korean notes.md should mirror figure explanation under the image without the heading');
  } catch (error) {
    failures.push(`session helper smoke failed: ${error.message}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateSourceModes() {
  const temp = mkdtempSync(join(tmpdir(), 'papermentor-modes-'));
  try {
    const lectureText = join(temp, 'lecture-note.txt');
    const slideText = join(temp, 'deck.txt');
    const paperText = join(temp, 'paper.txt');
    writeFileSync(lectureText, `A Brief Introduction to Causal Inference in Machine Learning

This lecture note is aimed at students without prior exposure to causal inference.

1. Introduction
Causal inference asks what changes under intervention. A structural causal model and a DAG encode assumptions.

2. Potential Outcomes and Interventions
Definition 2.1 Potential outcomes. Example 2.2 A treatment variable changes an outcome. Exercise 2.3 asks the reader to check ignorability. Equation (1) defines the average treatment effect.

3. Causal Representation Learning
Out-of-distribution generalization uses causal reasoning and invariance. Theorem 3.1 states when stable mechanisms transfer.`);
    writeFileSync(slideText, `Slide 1: Sequence Modeling and Transformers
- Robot learning needs policies over observation-action histories.
- Attention lets a model select relevant tokens.

Slide 2: Decision Transformer
- Treat reinforcement learning as sequence modeling.
- Return-to-go conditions the action sequence.
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
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Causal Inference Notes', '--source', 'https://arxiv.org/abs/2405.08793', '--slug', 'causal-note', '--mode', 'auto'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'causal-note', '--mode', 'auto', '--paper-text-file', lectureText], { cwd: temp, stdio: 'pipe' });
    let state = readJson(join(temp, '.papermentor', 'sessions', 'causal-note', 'state.json'), {});
    if (state.sourceMode !== 'lecture-note') failures.push(`lecture note source mode not detected: ${state.sourceMode}`);
    const lectureActions = Object.values(state.sectionActions || {}).flat();
    for (const phrase of ['Build the concept ladder', 'Run a readiness checkpoint', 'Ask anything about']) {
      if (!lectureActions.some((action) => action.includes(phrase))) failures.push(`lecture note actions missing ${phrase}`);
    }
    const lectureTui = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'causal-note', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    if (!lectureTui.includes('Source mode:') || !lectureTui.includes('Lecture note sections')) failures.push('lecture note TUI should show source mode and lecture note sections');
    const conceptBodyPath = join(temp, 'concept-ladder.md');
    writeFileSync(conceptBodyPath, '## Target concept\n\nIntervention.\n\n## Ladder\n\n### 1. Observational distribution\n\n- Why needed: separates seeing from doing.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'causal-note', '--type', 'concept-ladder', '--title', 'Concept ladder — intervention', '--body-file', conceptBodyPath], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'causal-note', 'state.json'), {});
    if (state.readingPath?.find((item) => item.key === 'prerequisites')?.status !== 'done') failures.push('lecture-note concept ladder should complete the prerequisites reading-path step');
    if (state.readingPath?.find((item) => item.key === 'notation')?.status !== 'current') failures.push('lecture-note concept ladder should advance to notation, not paper derivations');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Robot Learning Transformer Slides', '--source', 'lecture-slides.pdf', '--slug', 'robot-slides', '--mode', 'auto'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'robot-slides', '--mode', 'auto', '--paper-text-file', slideText], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.sourceMode !== 'slide-deck') failures.push(`slide deck source mode not detected: ${state.sourceMode}`);
    const slideActions = Object.values(state.sectionActions || {}).flat();
    for (const phrase of ['Reconstruct the missing narration', 'Connect Slide', 'Chat about this slide']) {
      if (!slideActions.some((action) => action.includes(phrase))) failures.push(`slide deck actions missing ${phrase}`);
    }
    const slideTui = execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'tui', '--session', 'robot-slides', '--snapshot'], { cwd: temp, encoding: 'utf8' });
    if (!slideTui.includes('Slide deck sections') || !slideTui.includes('HTML-first slide deck navigator')) failures.push('slide deck TUI should show slide-deck navigator');
    const slideBodyPath = join(temp, 'slide-explanation.md');
    writeFileSync(slideBodyPath, '## Slide role\n\nExplain the Transformer policy diagram.');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'robot-slides', '--type', 'slide-explanation', '--title', 'Slide explanation — Transformer policy diagram', '--body-file', slideBodyPath], { cwd: temp, stdio: 'pipe' });
    state = readJson(join(temp, '.papermentor', 'sessions', 'robot-slides', 'state.json'), {});
    if (state.readingPath?.find((item) => item.key === 'slides')?.status !== 'done') failures.push('slide-deck slide explanation should complete the slides reading-path step');
    if (state.readingPath?.find((item) => item.key === 'narration')?.status !== 'current') failures.push('slide-deck slide explanation should advance to missing narration');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Method Paper', '--source', 'paper.pdf', '--slug', 'method-paper', '--mode', 'auto'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'analyze', '--session', 'method-paper', '--mode', 'auto', '--paper-text-file', paperText], { cwd: temp, stdio: 'pipe' });
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
    const makeDeckPath = join(temp, 'make_deck.py');
    writeFileSync(makeDeckPath, `from pptx import Presentation
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
    ("Upload paper / deck", 0.8),
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
    execFileSync('python3', [makeDeckPath], { cwd: temp, stdio: 'pipe' });

    execFileSync('node', [
      join(root, 'scripts', 'papermentor-session.mjs'),
      'start',
      '--title',
      'PPTX Smoke Deck',
      '--slug',
      'pptx-smoke',
      '--source',
      pptxPath,
      '--mode',
      'slide-deck'
    ], { cwd: temp, stdio: 'pipe' });

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
      '## Slide explanation\n\n- **Question:** What does this slide verify?\n- **Concept:** PPTX-to-reading-room extraction.\n- **What to observe:** the entire slide is preserved without clipping.\n- **Conclusion:** slide-deck sessions can attach real converted visuals.'
    ], { cwd: temp, stdio: 'pipe' });

    const sessionDir = join(temp, '.papermentor', 'sessions', 'pptx-smoke');
    const htmlPath = join(sessionDir, 'index.html');
    const cardsPath = join(sessionDir, 'cards.json');
    const assetsDir = join(sessionDir, 'assets');
    const html = readFileSync(htmlPath, 'utf8');
    const data = readJson(cardsPath, { cards: [] });
    const pngs = readdirSync(assetsDir).filter((name) => name.endsWith('.png'));
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
    if (data.cards?.length !== 1 || data.cards?.[0]?.type !== 'slide-explanation') failures.push('pptx extraction should persist a slide-explanation card for slide-deck mode');
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

import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'README.md','SKILL.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','install.sh','install.ps1','package.json','assets/papermentor-hero.svg','assets/papermentor-demo.svg','assets/social-preview.svg','assets/fonts/README.md','assets/fonts/satoshi/Satoshi-300.woff2','assets/fonts/satoshi/Satoshi-400.woff2','assets/fonts/satoshi/Satoshi-500.woff2','assets/fonts/satoshi/Satoshi-700.woff2','assets/fonts/satoshi/Satoshi-900.woff2','assets/fonts/pretendard/PretendardVariable.woff2','scripts/papermentor-session.mjs',
  'prompts/paper-scanner.md','prompts/prerequisite-analyzer.md','prompts/equation-analyzer.md','prompts/derivation-tracer.md','prompts/dependency-tracer.md','prompts/proof-analyzer.md','prompts/method-analyzer.md','prompts/confusion-resolver.md','prompts/final-insight-extractor.md','prompts/visualization-planner.md',
  'skills/papermentor/SKILL.md','skills/papermentor/commands.md','skills/papermentor/examples.md',
  'templates/paper_map.md','templates/prerequisite_ladder.md','templates/equation_card.md','templates/derivation_trace.md','templates/dependency_trace.md','templates/proof_walkthrough.md','templates/method_dissection.md','templates/confusion_response.md','templates/recursive_why.md','templates/final_insight.md','templates/visualization_card.md','templates/interactive_console.md','templates/session_state.json','templates/reading_dashboard.md',
  'examples/korean_equation_explanation.md','examples/derivation_trace_example.md','examples/dependency_trace_example.md','examples/confusion_sign_magnitude_example.md','examples/final_insight_example.md','examples/interactive_session_example.md',
  'tests/latex_quality_checklist.md','tests/atomic_equation_checklist.md','tests/derivation_trace_checklist.md','tests/dependency_trace_checklist.md','tests/no_handwave_checklist.md','tests/korean_support_checklist.md','tests/visualization_checklist.md','tests/figure_explanation_checklist.md','tests/report_rendering_checklist.md',
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
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Claude Code', 'assets/papermentor-demo.svg', 'Append-only reading document', 'Try the sample paper', 'Trace a derivation', 'Map a dependency chain', 'Plan a visualization', 'Product boundaries']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const sessionScript = readFileSync(join(root, 'scripts/papermentor-session.mjs'), 'utf8');
for (const phrase of ['Satoshi-400.woff2', 'PretendardVariable.woff2', '@font-face', 'copyBundledReportAssets', 'paper-figure']) {
  if (!sessionScript.includes(phrase)) failures.push(`session renderer missing phrase: ${phrase}`);
}
for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css']) {
  if (sessionScript.includes(phrase)) failures.push(`session renderer should not rely on remote font CSS: ${phrase}`);
}

const skill = readFileSync(join(root, 'skills/papermentor/SKILL.md'), 'utf8');
for (const phrase of ['LaTeX', 'derivation', 'dependency', 'recursive why', 'Korean', 'visualization', 'Reading Path', 'index.html', 'Satoshi', 'Pretendard', 'Report structure']) {
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
  ['visualize', 'templates/visualization_card.md', 'prompts/visualization-planner.md']
];
const commandsText = readFileSync(join(root, 'skills/papermentor/commands.md'), 'utf8');
for (const [command, template, prompt] of commandCoverage) {
  if (!commandsText.includes(`/papermentor ${command}`)) failures.push(`commands.md missing /papermentor ${command}`);
  if (!existsSync(join(root, template))) failures.push(`missing template for ${command}: ${template}`);
  if (!existsSync(join(root, prompt))) failures.push(`missing prompt for ${command}: ${prompt}`);
}

for (const command of ['start', 'choose', 'render', 'state', 'pause', 'resume']) {
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
    const figurePath = join(temp, 'exact-pdf-crop-fixture.svg');
    const mapPath = join(temp, 'map.md');
    const equationPath = join(temp, 'equation.md');
    // This is a test fixture for attachment/copy/render behavior only. Product guidance rejects
    // Mermaid/redrawn schematics for real papers; real sessions must pass an actual PDF crop.
    writeFileSync(figurePath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 280"><rect width="720" height="280" fill="#fbfaf6"/><rect x="26" y="24" width="668" height="210" rx="2" fill="#fff" stroke="#d8d0c3"/><text x="50" y="58" font-family="Times New Roman, serif" font-size="18" fill="#1f2937">Exact PDF crop fixture — replace with actual paper figure in real sessions</text><path d="M68 190 C150 88, 260 92, 338 170 S520 226, 626 112" fill="none" stroke="#222" stroke-width="2.5"/><circle cx="68" cy="190" r="4" fill="#222"/><circle cx="338" cy="170" r="4" fill="#222"/><circle cx="626" cy="112" r="4" fill="#222"/><line x1="68" y1="216" x2="626" y2="216" stroke="#222"/><line x1="68" y1="86" x2="68" y2="216" stroke="#222"/><text x="330" y="254" font-family="Times New Roman, serif" font-size="14" fill="#374151">Figure 1: fixture crop region</text></svg>');
    writeFileSync(mapPath, '## What this paper is doing\n\nThe paper trains a generator by moving samples with a drifting field.\n\n## Figure explanation under image\n\n- Figure / location: Figure 1.\n- Why this is the representative figure: it shows the training-time generator-to-drift-target loop rather than experiment results.\n- What it shows: the generator, generated samples, real samples, and the drift field.\n- Components: prior samples, generator, generated distribution, target distribution.\n- Flow or sequence: sample, generate, drift, train.\n- What to observe: the field points generated samples toward data structure.\n- Equations or claims it supports: Eq. (6).\n\n## CLI-only likely confusion points\n\n- This should stay in CLI/state, not rendered HTML.\n');
    writeFileSync(equationPath, '- **Symbol:** $V_{p,q}$ is the drifting field.\n- **Checkpoint:** explain the update target.\n\n## Likely blockers\n\n- This should also stay in CLI/state, not rendered HTML.\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', 'Generative Modeling via Drifting', '--source', 'paper.pdf'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'paper-map', '--title', 'Paper map', '--figure-file', figurePath, '--figure-caption', 'Exact crop of Figure 1 from the paper.', '--body-file', mapPath, '--choices', 'Explain symbols|Trace derivation|Explain stopgrad'], { cwd: temp, stdio: 'pipe' });
    const dir = join(temp, '.papermentor', 'sessions', 'generative-modeling-via-drifting');
    for (const rel of ['index.html', 'state.json', 'cards.json', 'notes.md']) {
      if (!existsSync(join(dir, rel))) failures.push(`session helper missing ${rel}`);
    }
    const htmlFilesAfterFirst = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFilesAfterFirst.length !== 1 || htmlFilesAfterFirst[0] !== 'index.html') failures.push(`session helper should create exactly one HTML file, got ${htmlFilesAfterFirst.join(',')}`);
    let html = readFileSync(join(dir, 'index.html'), 'utf8');
    let cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((html.match(/class="block"/g) || []).length !== 1) failures.push('session helper should render one block after first card');
    for (const phrase of ['Main method figure', 'Figure explanation under image']) {
      if (html.includes(phrase)) failures.push(`session paper map should move the figure explanation under the image and remove the body heading: ${phrase}`);
    }
    if (!html.includes('class="paper-figure"') || !html.includes('<img src="assets/')) failures.push('session paper map should render the actual method figure image');
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
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css']) {
      if (html.includes(phrase)) failures.push(`session HTML should not depend on remote font CSS: ${phrase}`);
    }
    if (!cardData.cards?.[0]?.figure?.src?.startsWith('assets/')) failures.push('session card should persist copied figure asset metadata');
    if (!existsSync(join(dir, cardData.cards?.[0]?.figure?.src || 'missing'))) failures.push('session helper should copy figure file into session assets');
    const notes = readFileSync(join(dir, 'notes.md'), 'utf8');
    if (!notes.includes('![Paper map figure](assets/')) failures.push('session notes should include the attached figure link');
    if (notes.includes('Exact crop of Figure 1 from the paper.')) failures.push('session notes should suppress provenance-only figure captions');
    if (notes.includes('## Figure explanation under image')) failures.push('session notes should move the figure explanation under the image and remove the heading');

    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'generative-modeling-via-drifting', '--type', 'equation', '--title', 'Equation (6)', '--latex', '\mathcal{L}=\mathbb{E}\|x-\operatorname{stopgrad}(x+V_{p,q}(x))\|^2', '--body-file', equationPath, '--choices', 'Trace derivation|Explain stopgrad'], { cwd: temp, stdio: 'pipe' });
    const htmlFiles = readdirSync(dir).filter((name) => name.endsWith('.html'));
    if (htmlFiles.length !== 1 || htmlFiles[0] !== 'index.html') failures.push(`session helper should keep exactly one HTML file, got ${htmlFiles.join(',')}`);
    html = readFileSync(join(dir, 'index.html'), 'utf8');
    cardData = readJson(join(dir, 'cards.json'), { cards: [] });
    if ((cardData.cards || []).length !== 2) failures.push('session helper should persist two cards after second card');
    for (const requiredField of ['id', 'type', 'title', 'location', 'body', 'choices', 'createdAt']) {
      if (!(requiredField in (cardData.cards?.[0] || {}))) failures.push(`session card should keep structured report field: ${requiredField}`);
    }
    if (!cardData.schema || !cardData.cards?.[0]?.figure?.src) failures.push('session cards.json should keep schema and figure asset data');
    if ((html.match(/class="block"/g) || []).length !== 2) failures.push('session helper should render two blocks after second card');
    for (const phrase of ['MathJax', 'Generative Modeling via Drifting', 'Equation block — Eq. (6)', 'class="paper-title"', 'class="block"', 'class="paper-figure"', 'data-index="1"', 'data-index="2"']) {
      if (!html.includes(phrase)) failures.push(`session block document missing ${phrase}`);
    }
    for (const phrase of ['Reading Path', 'Choose next', 'class="sidebar"', 'class="topbar"', 'session-head', 'CLI-only likely confusion points', 'Likely blockers', 'This should stay in CLI/state', 'This should also stay in CLI/state']) {
      if (html.includes(phrase)) failures.push(`session block document should not render CLI-only content or dashboard chrome: ${phrase}`);
    }

    const koreanMapPath = join(temp, 'korean-map.md');
    const koreanEquationPath = join(temp, 'korean-equation.md');
    writeFileSync(koreanMapPath, '## 이 논문이 하는 일\n\n이 논문은 생성 분포 $q_i$가 학습 중에 데이터 분포 $p_{\\mathrm{data}}$ 쪽으로 이동하도록 generator $f$를 훈련한다.\n\n## 그림 설명\n\n- 그림 / 위치: Figure 1, Drifting Model.\n- 무엇을 보여주는가: 주황색 생성 분포 $q_i$가 학습 반복마다 파란색 데이터 분포 $p_{\\mathrm{data}}$에 가까워지는 과정을 보여준다.\n- 흐름 / 순서: prior에서 샘플을 뽑고 → $f$로 pushforward 분포를 만들고 → drift field로 이동 방향을 정하고 → $f$를 업데이트한다.\n- 관찰할 점: inference 때 반복 샘플러를 돌리는 것이 아니라, 학습 중 $f$ 자체가 반복적으로 바뀐다는 점이다.\n- 연결되는 수식 / 주장: $q=f_{\\#}p_{\\mathrm{prior}}$, 분포열 $\\{q_i\\}$, 그리고 drift가 0에 가까워지게 만드는 학습 목적식.\n\n## 핵심 객체\n\n- $p_{\\mathrm{prior}}$ — 생성 전에 샘플링하는 source distribution.\n- $f$ — prior sample을 데이터 공간으로 보내는 generator.\n- $V_{p,q}(x)$ — 현재 샘플 $x$를 어느 방향으로 움직일지 알려주는 drift field.\n\n## 의존성 체인\n\n1. pushforward $q=f_{\\#}p_{\\mathrm{prior}}$를 이해한다.\n2. 학습을 분포열 $q_1,q_2,\\ldots$의 변화로 본다.\n3. drift field $V_{p,q}(x)$가 왜 필요한지 연결한다.\n');
    writeFileSync(koreanEquationPath, '## 수식이 하는 일\n\n이 블록은 학습 목적식이 왜 등장하는지 설명한다. $V_{p,q}(x)$는 이동 목표를 만들고, $\\operatorname{stopgrad}$는 그 목표 쪽으로 gradient가 새지 않도록 고정한다.\n\n## 기호 역할\n\n- $x$ — 현재 generator가 만든 sample.\n- $V_{p,q}(x)$ — sample을 이동시키는 drift vector.\n- $\\|\\cdot\\|_2^2$ — 이동 목표와 현재 sample 사이의 제곱 거리.\n');
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'start', '--title', '드리프팅을 통한 생성 모델링', '--source', 'https://arxiv.org/pdf/2602.04770', '--slug', 'korean-report'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'paper-map', '--title', '논문 지도', '--figure-file', figurePath, '--figure-caption', 'Figure 1. Drifting Model.', '--body-file', koreanMapPath, '--choices', '수식 (6) 설명|stopgrad 설명|의존성 추적'], { cwd: temp, stdio: 'pipe' });
    execFileSync('node', [join(root, 'scripts', 'papermentor-session.mjs'), 'card', '--session', 'korean-report', '--type', 'equation', '--title', '학습 목적식 — Eq. (6)', '--latex', '\mathcal{L}=\\mathbb{E}\\left[\\left\\|x-\\operatorname{stopgrad}(x+V_{p,q}(x))\\right\\|_2^2\\right]', '--body-file', koreanEquationPath, '--choices', '유도 추적|기호 설명'], { cwd: temp, stdio: 'pipe' });
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
    for (const phrase of ['api.fontshare.com', 'orioncactus/pretendard/dist/web/static/pretendard.css']) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should not depend on remote font CSS: ${phrase}`);
    }
    for (const phrase of ['그림 설명', 'Figure explanation under image', 'Main method figure']) {
      if (koreanHtml.includes(phrase)) failures.push(`Korean report should move figure section under image and remove heading: ${phrase}`);
    }
    for (const phrase of ['주황색 생성 분포', '읽는 법:', '핵심 관찰:', '연결되는 내용:', '학습 목적식 — Eq. (6)']) {
      if (!koreanHtml.includes(phrase)) failures.push(`Korean report should keep structured Korean explanation content: ${phrase}`);
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

validateInstalledArtifact();
validateSessionHelper();

if (failures.length) {
  console.error('PaperMentor validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PaperMentor validation passed (${required.length} required files checked).`);

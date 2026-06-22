import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'README.md','SKILL.md','LICENSE','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','install.sh','install.ps1','package.json','assets/papermentor-hero.svg','assets/papermentor-demo.svg','assets/social-preview.svg',
  'prompts/paper-scanner.md','prompts/prerequisite-analyzer.md','prompts/equation-analyzer.md','prompts/derivation-tracer.md','prompts/dependency-tracer.md','prompts/proof-analyzer.md','prompts/method-analyzer.md','prompts/confusion-resolver.md','prompts/final-insight-extractor.md','prompts/visualization-planner.md',
  'skills/papermentor/SKILL.md','skills/papermentor/commands.md','skills/papermentor/examples.md',
  'templates/paper_map.md','templates/prerequisite_ladder.md','templates/equation_card.md','templates/derivation_trace.md','templates/dependency_trace.md','templates/proof_walkthrough.md','templates/method_dissection.md','templates/confusion_response.md','templates/recursive_why.md','templates/final_insight.md','templates/visualization_card.md',
  'examples/korean_equation_explanation.md','examples/derivation_trace_example.md','examples/dependency_trace_example.md','examples/confusion_sign_magnitude_example.md','examples/final_insight_example.md',
  'tests/latex_quality_checklist.md','tests/atomic_equation_checklist.md','tests/derivation_trace_checklist.md','tests/dependency_trace_checklist.md','tests/no_handwave_checklist.md','tests/korean_support_checklist.md','tests/visualization_checklist.md',
  'demo/sample-paper.md','demo/sample-session.md','demo/outputs/paper_map.md','demo/outputs/equation_card.md','demo/outputs/derivation_trace.md','demo/outputs/final_insight.md'
];

const failures = [];
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
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Claude Code', 'assets/papermentor-demo.svg', 'Try the sample paper', 'Trace a derivation', 'Map a dependency chain', 'Plan a visualization', 'Product boundaries']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const skill = readFileSync(join(root, 'skills/papermentor/SKILL.md'), 'utf8');
for (const phrase of ['LaTeX', 'derivation', 'dependency', 'recursive why', 'Korean', 'visualization']) {
  if (!skill.toLowerCase().includes(phrase.toLowerCase())) failures.push(`skill missing policy phrase: ${phrase}`);
}

for (const rel of ['SKILL.md', 'README.md', 'skills/papermentor/commands.md', 'prompts/visualization-planner.md', 'tests/visualization_checklist.md']) {
  const text = readFileSync(join(root, rel), 'utf8').toLowerCase();
  for (const phrase of ['question', 'concept', 'visual encoding', 'what to observe', 'conclusion', 'limitation']) {
    if (!text.includes(phrase)) failures.push(`${rel} missing visualization contract phrase: ${phrase}`);
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

function expectedInstalledResources() {
  return [
    'SKILL.md',
    'commands.md',
    'examples.md',
    ...required
      .filter((rel) => rel.startsWith('prompts/') || rel.startsWith('templates/') || rel.startsWith('examples/') || rel.startsWith('tests/'))
  ];
}

function assertInstalledArtifact(dest, label) {
  const installedRequired = expectedInstalledResources();
  for (const rel of installedRequired) {
    if (!existsSync(join(dest, rel))) failures.push(`${label} installed artifact missing ${rel}`);
  }

  for (const dir of ['prompts', 'templates', 'examples', 'tests']) {
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

validateInstalledArtifact();

if (failures.length) {
  console.error('PaperMentor validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PaperMentor validation passed (${required.length} required files checked).`);

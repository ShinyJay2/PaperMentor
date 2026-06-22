import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const required = [
  'README.md','SKILL.md','LICENSE','CONTRIBUTING.md','SECURITY.md','install.sh','install.ps1','package.json',
  'prompts/paper-scanner.md','prompts/prerequisite-analyzer.md','prompts/equation-analyzer.md','prompts/derivation-tracer.md','prompts/dependency-tracer.md','prompts/proof-analyzer.md','prompts/method-analyzer.md','prompts/confusion-resolver.md','prompts/mental-model-extractor.md','prompts/visualization-planner.md',
  'skills/papermentor/SKILL.md','skills/papermentor/commands.md','skills/papermentor/examples.md',
  'templates/paper_map.md','templates/prerequisite_ladder.md','templates/equation_card.md','templates/derivation_trace.md','templates/dependency_trace.md','templates/proof_walkthrough.md','templates/method_dissection.md','templates/confusion_response.md','templates/recursive_why.md','templates/mental_model.md','templates/visualization_card.md',
  'examples/korean_equation_explanation.md','examples/derivation_trace_example.md','examples/dependency_trace_example.md','examples/confusion_sign_magnitude_example.md','examples/mental_model_example.md',
  'tests/latex_quality_checklist.md','tests/atomic_equation_checklist.md','tests/derivation_trace_checklist.md','tests/dependency_trace_checklist.md','tests/no_handwave_checklist.md','tests/korean_support_checklist.md','tests/visualization_checklist.md'
];

const failures = [];
for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) failures.push(`missing ${rel}`);
  else if (statSync(p).isFile() && readFileSync(p, 'utf8').trim().length < 40) failures.push(`too little content ${rel}`);
}

for (const rel of ['SKILL.md', 'skills/papermentor/SKILL.md']) {
  const text = readFileSync(join(root, rel), 'utf8');
  if (!text.startsWith('---\n')) failures.push(`${rel} missing YAML frontmatter`);
  if (!/name:\s*papermentor/.test(text)) failures.push(`${rel} missing name`);
  if (!/description:\s*.+/.test(text)) failures.push(`${rel} missing description`);
}

const readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const phrase of ['Do not summarize papers. Debug understanding.', 'Korean support', 'Derivation trace example', 'Dependency trace example', 'Visualization example', 'Roadmap']) {
  if (!readme.includes(phrase)) failures.push(`README missing phrase: ${phrase}`);
}

const skill = readFileSync(join(root, 'skills/papermentor/SKILL.md'), 'utf8');
for (const phrase of ['LaTeX', 'derivation', 'dependency', 'recursive why', 'Korean', 'visualization']) {
  if (!skill.toLowerCase().includes(phrase.toLowerCase())) failures.push(`skill missing policy phrase: ${phrase}`);
}

if (failures.length) {
  console.error('PaperMentor validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PaperMentor validation passed (${required.length} required files checked).`);
